"""One runner job (P1): clone -> overlay bob_config -> bob run -> events -> complete.

    heartbeat(job_id) now and every 15 s          # 409 -> JobCancelled
    checkout = prepare_checkout(job, workdir)     # clone, fetch both branches, cleave init
    run bobshell.command(job) in checkout with CLEAVE_RUN_ID=job.job_id
    forward new lines of .cleave/runs/<job_id>/events.ndjson every few seconds
    exit 0  -> complete(job_id, bundle=load_bundle(..., source="runner"))
    exit ≠ 0 or no run directory -> complete(job_id, error="bob run exited with code N: <tail of stderr>")
    JobCancelled from the server -> stop bob and return

Bob's stream-json output is saved as it is to ``.cleave/bob-stream.ndjson`` in the checkout
and not parsed (its shape is open check C5). The runner adds two events of its own to the
job's live view: ``runner.bob_started`` and ``runner.bob_exited``.

Spec: tests/test_runner.py.
"""

from __future__ import annotations

import os
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from ..config import CONFIG_PATH, load_config, render_config
from ..gitio import git
from ..models import BobStats, Event, Job, PullRequestRef
from ..push import load_bundle
from ..runs import RUN_ID_FILE, RunDir
from . import bobshell
from .client import JobCancelled, RunnerAuthError, RunnerClient

HEARTBEAT_S = 10.0
"""The server wants one at least every 15 s while a job runs."""
POLL_S = 2.0
JOB_TIMEOUT_S = 45 * 60
"""Wall-clock limit for one ``bob run``; --max-cost bounds what it spends."""
STDERR_TAIL = 1500


def prepare_checkout(job: Job, workdir: Path) -> Path:
    """Clone ``job.repo.clone_url`` into ``workdir/<job_id>``, fetch head and base branches,
    check out the head branch, and install the Cleave mode and config exactly like
    ``cleave init`` with the job's config (check, setup, working directory, limits)."""
    from ..cli import main as cli

    workdir.mkdir(parents=True, exist_ok=True)
    checkout = (workdir / job.job_id).resolve()
    if checkout.exists():
        shutil.rmtree(checkout)
    pr = job.pull_request
    git(workdir, "clone", "--quiet", job.repo.clone_url, str(checkout))
    git(
        checkout,
        "fetch",
        "--quiet",
        "origin",
        f"+refs/heads/{pr.head_branch}:refs/remotes/origin/{pr.head_branch}",
        f"+refs/heads/{pr.base_branch}:refs/remotes/origin/{pr.base_branch}",
    )
    git(
        checkout,
        "checkout",
        "--quiet",
        "-B",
        pr.head_branch,
        f"origin/{pr.head_branch}",
    )

    args = [
        "-C",
        str(checkout),
        "init",
        "--check",
        job.config.check_command,
        "--workdir",
        job.config.working_directory,
    ]
    if job.config.setup_command:
        args += ["--setup", job.config.setup_command]
    if cli(args) != 0:
        raise RuntimeError("cleave init failed in the checkout")
    config = load_config(checkout).model_copy(
        update={
            "max_layer_lines": job.config.max_layer_lines,
            "max_repair_rounds": job.config.max_repair_rounds,
            "bobcoin_cap": job.config.bobcoin_cap,
        }
    )
    (checkout / CONFIG_PATH).write_text(render_config(config))
    # The run Bob starts must carry the job's id. CLEAVE_RUN_ID is set for bob too, but MCP
    # clients may not pass it on to `cleave mcp`; this file reaches the server either way.
    (checkout / RUN_ID_FILE).write_text(job.job_id + "\n")
    return checkout


class _Forwarder:
    """Sends the lines appended to a run's events.ndjson since the last call."""

    def __init__(self, client: RunnerClient, job_id: str, path: Path) -> None:
        self.client, self.job_id, self.path, self.offset = client, job_id, path, 0

    def flush(self) -> None:
        if not self.path.exists():
            return
        with self.path.open("rb") as fh:
            fh.seek(self.offset)
            data = fh.read()
        end = data.rfind(b"\n") + 1  # only whole lines; a half-written one waits
        if not end:
            return
        events = [
            Event.model_validate_json(line)
            for line in data[:end].decode("utf-8").splitlines()
            if line.strip()
        ]
        self.client.send_events(self.job_id, events)
        self.offset += end


def _runner_event(job: Job, type_: str, payload: dict) -> Event:
    return Event(
        ts=datetime.now(timezone.utc),
        source="runner",
        type=type_,
        run_id=job.job_id,
        payload=payload,
    )


def _stop(proc: subprocess.Popen) -> None:
    """Stop bob and whatever it started (the cleave MCP server)."""
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except (AttributeError, ProcessLookupError, PermissionError):
        proc.terminate()
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (AttributeError, ProcessLookupError, PermissionError):
            proc.kill()
        proc.wait()


def _tail(path: Path) -> str:
    try:
        text = path.read_text(errors="replace").strip()
    except OSError:
        return ""
    return text[-STDERR_TAIL:]


def _fail(client: RunnerClient, job: Job, error: str) -> str:
    try:
        client.complete(job.job_id, error=error)
    except JobCancelled:
        return "cancelled"
    return "failed"


def run_job(
    job: Job,
    client: RunnerClient,
    workdir: Path,
    bob_command: list[str] | None = None,
    bob: str = "bob",
) -> str:
    """Run one job to the end and report it. Returns the final status: succeeded, failed or cancelled.
    ``bob_command`` replaces ``bobshell.command(job)`` (tests pass a stand-in); ``bob`` is the
    Bob Shell executable when it isn't ``bob`` on PATH."""
    version = bobshell.bob_version(bob) if bob_command is None else None
    try:
        client.heartbeat(job_id=job.job_id, bob_version=version)
    except JobCancelled:
        return "cancelled"

    try:
        checkout = prepare_checkout(job, workdir)
    except Exception as e:  # clone or init failed: the job can't run here
        return _fail(
            client, job, f"Couldn't prepare the checkout of {job.repo.full_name}: {e}"
        )

    cmd = bob_command or bobshell.command(job, bob=bob)
    state = checkout / ".cleave"
    stdout_path, stderr_path = state / "bob-stream.ndjson", state / "bob-stderr.log"
    run = RunDir(checkout, job.job_id)
    forwarder = _Forwarder(client, job.job_id, run.events)
    env = {**os.environ, "CLEAVE_RUN_ID": job.job_id}

    started = time.monotonic()
    with stdout_path.open("wb") as out, stderr_path.open("wb") as err:
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=checkout,
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=out,
                stderr=err,
                start_new_session=True,
            )
        except OSError as e:
            return _fail(
                client,
                job,
                f"Couldn't start {cmd[0]!r} on this runner: {e}. Install Bob Shell and sign in (bob --version).",
            )
        try:
            client.send_events(
                job.job_id,
                [
                    _runner_event(
                        job,
                        "runner.bob_started",
                        {"command": " ".join(cmd[:-1]), "prompt": cmd[-1]},
                    )
                ],
            )
            last_beat = time.monotonic()
            while proc.poll() is None:
                time.sleep(POLL_S)
                forwarder.flush()
                if time.monotonic() - last_beat >= HEARTBEAT_S:
                    client.heartbeat(job_id=job.job_id, bob_version=version)
                    last_beat = time.monotonic()
                if time.monotonic() - started > JOB_TIMEOUT_S:
                    _stop(proc)
                    return _fail(
                        client,
                        job,
                        f"bob run took longer than {JOB_TIMEOUT_S // 60} minutes and was stopped.",
                    )
            forwarder.flush()
            code = proc.returncode
            client.send_events(
                job.job_id,
                [_runner_event(job, "runner.bob_exited", {"exit_code": code})],
            )
        except JobCancelled:
            _stop(proc)
            return "cancelled"
        finally:
            _stop(proc)
    duration_ms = int((time.monotonic() - started) * 1000)

    if code != 0:
        tail = _tail(stderr_path) or _tail(stdout_path)
        return _fail(
            client,
            job,
            f"bob run exited with code {code}: {tail}"
            if tail
            else f"bob run exited with code {code}.",
        )
    if not run.report.exists():
        return _fail(
            client,
            job,
            f"bob run finished without a Cleave report (.cleave/runs/{job.job_id}/report.json). Did the Cleave mode load? (open check C4)",
        )

    pr = job.pull_request
    try:
        bundle = load_bundle(
            run,
            repo_full=job.repo.full_name,
            title=pr.title,
            source="runner",
            pull_request=PullRequestRef(
                number=pr.number,
                url=pr.url,
                head_branch=pr.head_branch,
                base_branch=pr.base_branch,
                author=pr.author,
            ),
            bob=BobStats(surface="bob_run", mode=job.mode, duration_ms=duration_ms),
        )
    except Exception as e:
        return _fail(client, job, f"The run's files don't make a valid bundle: {e}")
    try:
        client.complete(job.job_id, bundle=bundle)
    except JobCancelled:
        return "cancelled"
    except httpx.HTTPStatusError as e:
        return _fail(client, job, f"The web app refused the bundle: {e}")
    return "succeeded"


def serve(
    client: RunnerClient, workdir: Path, once: bool = False, bob: str = "bob"
) -> None:
    """Heartbeat, claim, run, repeat. ``once`` stops after one claim (with or without a job)."""
    version = bobshell.bob_version(bob)
    if version is None:
        print(
            f"Warning: `{bob} --version` failed, so jobs will fail until Bob Shell is installed and signed in.",
            file=sys.stderr,
        )
    backoff = 5.0
    while True:
        try:
            client.heartbeat(bob_version=version)
            job = client.claim()
            backoff = 5.0
        except RunnerAuthError:
            raise
        except (httpx.HTTPError, JobCancelled) as e:
            print(
                f"Can't reach {client.url}: {e}. Retrying in {backoff:.0f} s.",
                file=sys.stderr,
            )
            if once:
                return
            time.sleep(backoff)
            backoff = min(backoff * 2, 60.0)
            continue
        if job is not None:
            print(
                f"Job {job.job_id}: {job.repo.full_name} #{job.pull_request.number} ({bobshell.prompt_for(job)})"
            )
            status = run_job(job, client, workdir, bob=bob)
            print(f"Job {job.job_id}: {status}")
        if once:
            return
