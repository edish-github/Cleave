"""Verify every prefix of the stack in parallel.

For each layer i: build the prefix tree, check it out in its own worktree, run the setup
command then the check command in ``working_directory`` with a timeout, save the full log to
``checks/r<round>-l<i>.log`` and keep an excerpt (the failing test and its message).

Spec: tests/test_verify.py (parse functions) and tests/test_galaxium.py (end to end).
Starting point: research/kill-tests/cleave_verify.py.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from .build import prefix_trees
from .config import RunConfig
from .events import EventLog
from .gitio import add_worktree, commit_tree, remove_worktree
from .models import AtomsFile, CheckResult, Failure, Plan, PlanLayer, Round, dump
from .runs import RunDir

_GIT_LOCK = threading.Lock()


@dataclass(frozen=True)
class PytestSummary:
    passed: int | None
    failed: int | None
    first_failure: Failure | None


def parse_pytest(output: str) -> PytestSummary:
    """Read counts from pytest's final summary line (``3 failed, 41 passed in 2.1s``,
    ``1 error in 0.4s``) and the first ``FAILED``/``ERROR`` node id with its message."""
    lines = output.splitlines()
    first_failure: Failure | None = None
    for line in lines:
        m = re.match(r"^(?:FAILED|ERROR)\s+([^\s-]+)(?:\s+-\s+(.*))?$", line.strip())
        if m:
            test_node = m.group(1)
            msg = m.group(2) or ""
            first_failure = Failure(test=test_node, message=msg)
            break

    passed = None
    failed = None
    for line in reversed(lines):
        # `pytest -q` prints the summary bare ("3 failed, 41 passed in 2.1s"); other modes
        # wrap it in "=" rules. Accept both.
        line = line.strip().strip("=").strip()
        if re.search(r"\bin\s+[\d\.]+s\b", line) and re.search(r"\d+\s+(passed|failed|errors?|skipped|deselected)", line):
            p_m = re.search(r"(\d+)\s+passed", line)
            f_m = re.search(r"(\d+)\s+failed", line)
            e_m = re.search(r"(\d+)\s+error", line)

            p = int(p_m.group(1)) if p_m else None
            f = int(f_m.group(1)) if f_m else 0
            e = int(e_m.group(1)) if e_m else 0

            if p is not None or f_m is not None or e_m is not None:
                passed = p
                failed = f + e
                if passed is not None and f_m is None and e_m is None:
                    failed = 0
            break

    return PytestSummary(passed=passed, failed=failed, first_failure=first_failure)


def excerpt(output: str, limit: int = 4000) -> str:
    """The part of a log a reviewer needs: the short test summary info section, else the tail."""
    pos = output.find("short test summary info")
    if pos != -1:
        start = output.rfind("\n", 0, pos)
        start = 0 if start == -1 else start + 1
        res = output[start:]
    else:
        res = output[-limit:]
    if len(res) > limit:
        res = res[-limit:]
    return res


def check_env(repo: Path, work_dir: Path, config: RunConfig, tmp: Path) -> dict[str, str]:
    """The environment a check runs in: ours, plus the repository's virtualenv (the
    worktree's own, else the one in the repository) and a private temp dir."""
    env = os.environ.copy()
    env["TMPDIR"] = str(tmp)
    for candidate in [
        work_dir / ".venv",
        repo / (config.working_directory or "") / ".venv",
        repo / ".venv",
    ]:
        if candidate.is_dir() and (candidate / "bin").is_dir():
            env["VIRTUAL_ENV"] = str(candidate)
            env["PATH"] = f"{candidate / 'bin'}:{env.get('PATH', '')}"
            break
    return env


def run_check(repo: Path, commit: str, config: RunConfig, log_file: Path, layer: int = 1) -> CheckResult:
    """Check out ``commit`` in a temporary worktree, run the setup and check commands in
    ``working_directory``, save the full log to ``log_file`` and return the result.

    Checks may run at the same time (one per layer), so each gets its own worktree and temp
    dir, and stdin is closed: under MCP stdio, stdin is Bob's JSON-RPC stream.
    """
    with _GIT_LOCK:
        worktree_dir = Path(tempfile.mkdtemp(prefix=f"cleave_wt_l{layer}_"))
        add_worktree(repo, worktree_dir, commit)
    layer_tmp = Path(tempfile.mkdtemp(prefix=f"cleave_tmp_l{layer}_"))
    try:
        work_dir = (worktree_dir / config.working_directory) if config.working_directory else worktree_dir
        timeout = config.timeout_s
        env = check_env(repo, work_dir, config, layer_tmp)

        def sh(command: str) -> subprocess.CompletedProcess[str]:
            return subprocess.run(
                command,
                shell=True,
                cwd=str(work_dir),
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

        setup_output = ""
        start_time = time.time()
        try:
            if config.setup_command:
                sproc = sh(config.setup_command)
                setup_output = (sproc.stdout or "") + (sproc.stderr or "")
                # A setup that creates the worktree's own virtualenv: the check runs in it.
                env.update(check_env(repo, work_dir, config, layer_tmp))
            cproc = sh(config.check_command)
            exit_code = cproc.returncode
            output = (cproc.stdout or "") + (cproc.stderr or "")
            timed_out = False
        except subprocess.TimeoutExpired as e:
            def text(b: bytes | str | None) -> str:
                return b.decode("utf-8", "replace") if isinstance(b, bytes) else (b or "")

            exit_code = -1
            output = text(e.stdout) + text(e.stderr) + f"\nTimeout expired after {timeout}s"
            timed_out = True

        duration_ms = int((time.time() - start_time) * 1000)
        full_log = (setup_output + "\n" if setup_output else "") + output
        log_file.parent.mkdir(parents=True, exist_ok=True)
        log_file.write_text(full_log)

        summary = parse_pytest(output)
        if timed_out:
            status = "timeout"
        elif exit_code == 0:
            status = "pass"
        elif summary.failed:
            status = "fail"
        else:
            status = "error"

        return CheckResult(
            layer=layer,
            status=status,
            tests_passed=summary.passed,
            tests_failed=summary.failed,
            duration_ms=duration_ms,
            failure=summary.first_failure,
            log_excerpt=excerpt(full_log),
        )
    finally:
        with _GIT_LOCK:
            remove_worktree(repo, worktree_dir)
        if worktree_dir.exists():
            shutil.rmtree(worktree_dir, ignore_errors=True)
        shutil.rmtree(layer_tmp, ignore_errors=True)


def verify(
    repo: Path,
    atoms: AtomsFile,
    plan: Plan,
    config: RunConfig,
    run: RunDir,
    round_: int,
    log: EventLog | None = None,
) -> Round:
    """Run one verification round over all layers of ``plan`` and return its results.

    Emits ``verify.started``, one ``layer.passed`` / ``layer.failed`` per layer and
    ``verify.passed`` when every layer is green.
    """
    if log:
        log.emit(
            "engine",
            "verify.started",
            {"round": round_, "plan_version": plan.version, "layers": len(plan.layers)},
        )

    trees = prefix_trees(repo, atoms, plan)

    def verify_layer(idx: int, spec: PlanLayer, tree: str) -> CheckResult:
        with _GIT_LOCK:
            commit = commit_tree(repo, tree, atoms.base_sha, f"verification round {round_} layer {idx}")
        result = run_check(repo, commit, config, run.check_log(round_, idx), layer=idx)
        if log:
            if result.status == "pass":
                log.emit(
                    "engine",
                    "layer.passed",
                    {
                        "round": round_,
                        "layer": idx,
                        "name": spec.name,
                        "tests_passed": result.tests_passed,
                        "duration_ms": result.duration_ms,
                    },
                )
            else:
                log.emit(
                    "engine",
                    "layer.failed",
                    {
                        "round": round_,
                        "layer": idx,
                        "name": spec.name,
                        "status": result.status,
                        "failure": dump(result.failure) if result.failure else None,
                        "duration_ms": result.duration_ms,
                    },
                )
        return result

    max_workers = min(len(plan.layers), getattr(config, "parallel", 4)) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(verify_layer, idx, spec, tree)
            for idx, (spec, tree) in enumerate(zip(plan.layers, trees), start=1)
        ]
        results = [f.result() for f in futures]

    results.sort(key=lambda r: r.layer)

    if all(r.status == "pass" for r in results):
        if log:
            log.emit(
                "engine",
                "verify.passed",
                {"round": round_, "plan_version": plan.version, "layers": len(plan.layers)},
            )

    return Round(round=round_, plan_version=plan.version, results=results)

