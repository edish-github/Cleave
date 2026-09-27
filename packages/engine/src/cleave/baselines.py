"""B1 baseline: measure a stack of branches someone else made, with Cleave's five checks.

B1 is one prompt to Bob in Agent mode (``bob run``) asking it to split the change into
branches ``b1/1 … b1/k`` by itself. ``measure_baseline`` turns those branches into a normal
run directory (atoms, graph, plan, report, events, check logs), so ``cleave push --kind
baseline_b1`` sends it like any Cleave run and /results can compare the two.

How each check reads a baseline stack:

- coverage: atoms of the change that the top branch contains exactly as the head has them.
  An atom is contained at a branch when ``git diff <branch> <head>`` doesn't touch the
  head lines the atom produced (whole-file atoms: when the file matches the head).
- order: every branch builds on the previous one (the first on the merge base), and every
  dependency edge between covered atoms points to the same or an earlier layer.
- fidelity: the top branch's tree equals the head's tree.
- shippability: the check command passes on every branch.
- partition: lines of the top branch that differ from the head (foreign lines).

Each covered atom belongs to the first branch from which it stays contained, so the plan
shows what each branch contributed. Only git plumbing and temporary worktrees are used:
HEAD, the index and the working tree are never touched.

Spec: tests/test_baselines.py.
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .atomize import atomize
from .build import foreign_lines as count_foreign_lines
from .config import RunConfig
from .events import EventLog
from .gitio import GitError, git, merge_base, resolve_ref, tree_of
from .graph import build_graph
from .models import (
    Atom,
    AtomsFile,
    Check,
    CheckResult,
    Graph,
    LayerResult,
    Plan,
    PlanLayer,
    Report,
    Round,
    Violation,
    dump,
)
from .report import write_report
from .runs import RunDir, new_run_id
from .verify import run_check

_HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", re.MULTILINE)


@dataclass(frozen=True)
class _Diff:
    """Where a branch still differs from the head: per head path, the head-side hunks."""

    hunks: dict[str, list[tuple[int, int]]]
    missing: set[str]
    """Head paths the branch doesn't have yet."""
    touched: set[str]
    """Every path in the diff (either side)."""


def branch_list(repo: Path, pattern: str) -> list[str]:
    """Local branches matching a glob (``b1/*``), in natural order: b1/2 before b1/10."""
    out = git(
        repo, "for-each-ref", "--format=%(refname:short)", f"refs/heads/{pattern}"
    )
    names = [line.strip() for line in out.splitlines() if line.strip()]

    def key(name: str) -> list[object]:
        return [
            int(part) if part.isdigit() else part for part in re.split(r"(\d+)", name)
        ]

    return sorted(names, key=key)


def _diff_to_head(repo: Path, commit: str, head: str) -> _Diff:
    raw = git(
        repo, "diff", "--no-color", "--no-ext-diff", "-U0", "--no-renames", commit, head
    )
    hunks: dict[str, list[tuple[int, int]]] = {}
    missing: set[str] = set()
    touched: set[str] = set()
    for block in re.split(r"(?=^diff --git )", raw, flags=re.MULTILINE):
        header = re.match(r"^diff --git a/(.*?) b/(.*?)$", block, flags=re.MULTILINE)
        if not header:
            continue
        path = header.group(2)
        touched.add(path)
        if re.search(r"^new file mode", block, flags=re.MULTILINE):
            missing.add(path)
        hunks[path] = [
            (int(m.group(1)), int(m.group(2)) if m.group(2) is not None else 1)
            for m in _HUNK.finditer(block)
        ]
    return _Diff(hunks=hunks, missing=missing, touched=touched)


def _span(start: int, length: int, widen: bool) -> tuple[int, int]:
    """Head lines as half-line positions: line n is 2n, the gap after line n is 2n + 1.
    ``widen`` adds the gaps on both sides (a hunk that replaces lines next to a removal)."""
    if length == 0:
        return (2 * start + 1, 2 * start + 1)
    lo, hi = 2 * start, 2 * (start + length - 1)
    return (lo - 1, hi + 1) if widen else (lo, hi)


def contained(atom: Atom, diff: _Diff) -> bool:
    """True when the branch has this atom's change exactly as the head does."""
    if atom.kind == "hunk":
        if atom.file in diff.missing:
            return False
        lo, hi = _span(atom.new_start, atom.new_len, widen=False)
        for start, length in diff.hunks.get(atom.file, []):
            h_lo, h_hi = _span(start, length, widen=True)
            if h_lo <= hi and lo <= h_hi:
                return False
        return True
    paths = {atom.file} | ({atom.old_file} if atom.old_file else set())
    return not (paths & diff.touched)


def _numstat(repo: Path, a: str, b: str) -> tuple[int, int, list[str]]:
    added = removed = 0
    files: list[str] = []
    for line in git(repo, "diff", "--numstat", "--no-renames", a, b).splitlines():
        parts = line.split("\t", 2)
        if len(parts) < 3:
            continue
        if parts[0] != "-":
            added += int(parts[0])
            removed += int(parts[1])
        files.append(parts[2])
    return added, removed, sorted(files)


def _is_ancestor(repo: Path, a: str, b: str) -> bool:
    try:
        git(repo, "merge-base", "--is-ancestor", a, b)
        return True
    except GitError:
        return False


def _subject(repo: Path, commit: str) -> str:
    return git(repo, "log", "-1", "--format=%s", commit).strip()


def _checks(
    atoms: AtomsFile,
    graph: Graph,
    layer_of: dict[str, int],
    stacked: int,
    branches: int,
    top_tree: str,
    green: int,
    foreign: int,
) -> list[Check]:
    total = len(atoms.atoms)
    covered = len(layer_of)
    edges = graph.edges
    respected = sum(
        1
        for e in edges
        if e.from_ in layer_of
        and e.to in layer_of
        and layer_of[e.to] <= layer_of[e.from_]
    )
    order_ok = respected == len(edges) and stacked == branches
    identical = top_tree == atoms.head_tree
    return [
        Check(
            id="coverage",
            status="pass" if covered == total else "attention",
            value=f"{covered} / {total}",
            detail=f"{covered} of {total} atoms in stack",
        ),
        Check(
            id="order",
            status="pass" if order_ok else "attention",
            value=f"{respected} / {len(edges)}",
            detail=f"{respected} of {len(edges)} dependencies respected; {stacked} of {branches} branches build on the previous one",
        ),
        Check(
            id="fidelity",
            status="pass" if identical else "attention",
            value="Identical" if identical else "Differs",
            detail="Top layer tree equals head tree"
            if identical
            else "Top tree differs from head tree",
        ),
        Check(
            id="shippability",
            status="pass" if green == branches else "attention",
            value=f"{green} / {branches}",
            detail=f"{green} of {branches} layers passing tests",
        ),
        Check(
            id="partition",
            status="pass" if foreign == 0 else "attention",
            value=f"{foreign} lines",
            detail="0 foreign lines in stack"
            if foreign == 0
            else f"{foreign} foreign lines found",
        ),
    ]


def measure_baseline(
    repo: Path,
    base: str,
    head: str,
    branches: list[str],
    config: RunConfig,
    run_id: str | None = None,
) -> RunDir:
    """Measure ``branches`` (bottom first) as a stack for ``base..head`` and write the run."""
    if not branches:
        raise ValueError(
            "No branches to measure. Pass the B1 branches, e.g. --branches 'b1/*'."
        )
    started_at = datetime.now(timezone.utc)
    head_sha = resolve_ref(repo, head)
    base_sha = merge_base(repo, resolve_ref(repo, base), head_sha)
    commits = [resolve_ref(repo, b) for b in branches]
    atoms = atomize(repo, base_sha, head_sha, require_clean=False)
    if not atoms.atoms:
        raise ValueError(
            f"{head} adds nothing on top of {base}; there is no change to measure."
        )
    graph = build_graph(repo, atoms)

    # Which atoms each branch contains; an atom belongs to the first branch it stays in.
    diffs = [_diff_to_head(repo, c, head_sha) for c in commits]
    inside = [{a.id for a in atoms.atoms if contained(a, d)} for d in diffs]
    layer_of: dict[str, int] = {}
    for atom in atoms.atoms:
        for i in range(len(commits), 0, -1):
            if atom.id not in inside[i - 1]:
                break
            layer_of[atom.id] = i
    if not layer_of:
        raise ValueError(
            f"The top branch {branches[-1]} contains none of the change as {head} has it, so there is no stack to measure."
        )
    per_layer = {
        i: [a.id for a in atoms.atoms if layer_of.get(a.id) == i]
        for i in range(1, len(commits) + 1)
    }

    run = RunDir(repo, run_id or new_run_id()).create()
    log = EventLog(run.events, run.run_id)
    log.emit(
        "engine",
        "run.started",
        {
            "base": base,
            "head": head,
            "head_branch": head,
            "baseline": "b1",
            "branches": branches,
        },
    )
    run.atoms.write_text(json.dumps(dump(atoms), indent=2))
    log.emit(
        "engine",
        "atoms.cut",
        {"atoms": len(atoms.atoms), "files": len({a.file for a in atoms.atoms})},
    )
    run.graph.write_text(json.dumps(dump(graph), indent=2))
    log.emit(
        "engine",
        "graph.built",
        {"edges": len(graph.edges), "groups": len(graph.groups)},
    )

    violations = [
        Violation(
            kind="missing_atom",
            atom=a.id,
            detail=f"{a.file}: not in the top branch as the head has it",
        )
        for a in atoms.atoms
        if a.id not in layer_of
    ] + [
        Violation(
            kind="empty_layer",
            layer=i,
            detail=f"{branches[i - 1]} completes none of the change's atoms",
        )
        for i, ids in per_layer.items()
        if not ids
    ]
    plan_layers = [
        PlanLayer(
            name=(_subject(repo, commits[i - 1]) or branches[i - 1])[:80],
            rationale=branches[i - 1],
            atoms=ids,
        )
        for i, ids in per_layer.items()
        if ids
    ]
    plan = Plan(
        version=0,
        author="engine",
        reason="B1 baseline: the branches as made",
        layers=plan_layers,
        violations=violations,
    )
    run.plan(0).write_text(json.dumps(dump(plan), indent=2))
    log.emit(
        "engine",
        "plan.proposed",
        {"version": 0, "layers": len(plan_layers), "violations": len(violations)},
    )

    # The check on every branch, in parallel like verification.
    def check(i: int) -> tuple[int, CheckResult]:
        return i, run_check(repo, commits[i - 1], config, run.check_log(1, i), layer=i)

    workers = max(1, min(len(commits), config.parallel))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = dict(pool.map(check, range(1, len(commits) + 1)))
    ordered = [results[i] for i in range(1, len(commits) + 1)]
    for i, result in enumerate(ordered, start=1):
        name = _subject(repo, commits[i - 1]) or branches[i - 1]
        if result.status == "pass":
            log.emit(
                "engine",
                "layer.passed",
                {
                    "round": 1,
                    "layer": i,
                    "name": name,
                    "tests_passed": result.tests_passed,
                    "duration_ms": result.duration_ms,
                },
            )
        else:
            log.emit(
                "engine",
                "layer.failed",
                {
                    "round": 1,
                    "layer": i,
                    "name": name,
                    "status": result.status,
                    "failure": dump(result.failure) if result.failure else None,
                    "duration_ms": result.duration_ms,
                },
            )

    layers: list[LayerResult] = []
    parent = base_sha
    stacked = 0
    for i, (branch, commit, result) in enumerate(
        zip(branches, commits, ordered), start=1
    ):
        stacked += _is_ancestor(repo, parent, commit)
        added, removed, files = _numstat(repo, parent, commit)
        layers.append(
            LayerResult(
                index=i,
                name=_subject(repo, commit) or branch,
                rationale=f"Branch {branch}",
                atoms=per_layer[i],
                added=added,
                removed=removed,
                files=files,
                branch=branch,
                commit_sha=commit,
                tree_sha=tree_of(repo, commit),
                status="pass" if result.status == "pass" else "fail",
                tests_passed=result.tests_passed,
                tests_failed=result.tests_failed,
                duration_ms=result.duration_ms,
            )
        )
        parent = commit

    top_tree = tree_of(repo, commits[-1])
    foreign = count_foreign_lines(repo, atoms, top_tree)
    green = sum(1 for layer in layers if layer.status == "pass")
    checks = _checks(
        atoms, graph, layer_of, stacked, len(commits), top_tree, green, foreign
    )
    report = Report(
        run_id=run.run_id,
        status="verified" if all(c.status == "pass" for c in checks) else "review",
        command=config.check_command,
        setup_command=config.setup_command,
        working_directory=config.working_directory,
        base_sha=atoms.base_sha,
        head_sha=atoms.head_sha,
        head_tree=atoms.head_tree,
        top_tree=top_tree,
        foreign_lines=foreign,
        plan_version=0,
        checks=checks,
        layers=layers,
        rounds=[Round(round=1, plan_version=0, results=ordered)],
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
    )
    write_report(run, report)
    log.emit(
        "engine",
        "run.finished",
        {"status": report.status, "run_id": run.run_id, "baseline": "b1"},
    )
    return run
