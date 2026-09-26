"""Assemble ``report.json`` and ``report.md`` from a finished run.

The five checks, in this order and with these ids: coverage, order, fidelity,
shippability, partition. ``status`` is ``verified`` when all five pass, ``review`` when
only shippability needs attention after the repair limit, ``failed`` on an error.

Spec: tests/test_report.py.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from .build import BuiltLayer
from .config import RunConfig
from .models import (
    AtomsFile,
    BobStats,
    Check,
    Graph,
    HookCounts,
    Issue,
    LayerResult,
    Plan,
    Repair,
    Report,
    Round,
    dump,
)
from .runs import RunDir


def make_report(
    *,
    run_id: str,
    atoms: AtomsFile,
    graph: Graph,
    plan: Plan,
    rounds: list[Round],
    config: RunConfig,
    built: list[BuiltLayer],
    top_tree: str | None,
    foreign_lines: int,
    started_at: datetime,
    finished_at: datetime,
    repairs: list[Repair] | None = None,
    hook: HookCounts | None = None,
    issue: Issue | None = None,
    bob: BobStats | None = None,
    error: str | None = None,
) -> Report:
    """Build the report for ``plan`` as verified by the last of ``rounds``.

    Layer results take tests and duration from the last round; ``built`` gives branch,
    commit and tree per layer. Check values: coverage ``"<n> / <n>"`` atoms, order
    ``"<n> / <n>"`` edges, fidelity ``"Identical"`` or ``"Differs"``, shippability
    ``"<passing> / <layers>"``, partition ``"<foreign_lines> lines"``.
    """
    total_atoms = len(atoms.atoms)
    plan_atoms = len({aid for l in plan.layers for aid in l.atoms if aid in atoms.by_id()})
    cov_status = "pass" if plan_atoms == total_atoms else "attention"
    cov_check = Check(
        id="coverage",
        status=cov_status,
        value=f"{plan_atoms} / {total_atoms}",
        detail=f"{plan_atoms} of {total_atoms} atoms in stack",
    )

    layer_of = plan.layer_of()
    total_edges = len(graph.edges)
    respected = sum(
        1
        for e in graph.edges
        if e.from_ in layer_of and e.to in layer_of and layer_of[e.to] <= layer_of[e.from_]
    )
    order_status = "pass" if respected == total_edges else "attention"
    order_check = Check(
        id="order",
        status=order_status,
        value=f"{respected} / {total_edges}",
        detail=f"{respected} of {total_edges} dependencies respected",
    )

    is_identical = (top_tree == atoms.head_tree)
    fid_status = "pass" if is_identical else "attention"
    fid_check = Check(
        id="fidelity",
        status=fid_status,
        value="Identical" if is_identical else "Differs",
        detail="Top layer tree equals head tree" if is_identical else "Top tree differs from head tree",
    )

    last_round = rounds[-1] if rounds else None
    passing_layers = sum(1 for r in last_round.results if r.status == "pass") if last_round else 0
    total_layers = len(plan.layers)
    ship_status = "pass" if passing_layers == total_layers else "attention"
    ship_check = Check(
        id="shippability",
        status=ship_status,
        value=f"{passing_layers} / {total_layers}",
        detail=f"{passing_layers} of {total_layers} layers passing tests",
    )

    part_status = "pass" if foreign_lines == 0 else "attention"
    part_check = Check(
        id="partition",
        status=part_status,
        value=f"{foreign_lines} lines",
        detail="0 foreign lines in stack" if foreign_lines == 0 else f"{foreign_lines} foreign lines found",
    )

    checks = [cov_check, order_check, fid_check, ship_check, part_check]

    if error:
        status = "failed"
    elif (
        cov_status == "attention"
        or order_status == "attention"
        or fid_status == "attention"
        or part_status == "attention"
    ):
        status = "failed"
    elif ship_status == "attention":
        status = "review"
    else:
        status = "verified"

    layers_res: list[LayerResult] = []
    by_id = atoms.by_id()
    for i, spec in enumerate(plan.layers, start=1):
        b = built[i - 1] if i - 1 < len(built) else None
        cr = last_round.results[i - 1] if last_round and i - 1 < len(last_round.results) else None
        layer_atoms = [by_id[aid] for aid in spec.atoms if aid in by_id]
        added = sum(a.added for a in layer_atoms)
        removed = sum(a.removed for a in layer_atoms)
        files = sorted(set(a.file for a in layer_atoms))
        layers_res.append(
            LayerResult(
                index=i,
                name=spec.name,
                rationale=spec.rationale,
                atoms=spec.atoms,
                added=added,
                removed=removed,
                files=files,
                branch=b.branch if b else "",
                commit_sha=b.commit if b else None,
                tree_sha=b.tree if b else None,
                status="pass" if (cr and cr.status == "pass") else "fail",
                tests_passed=cr.tests_passed if cr else None,
                tests_failed=cr.tests_failed if cr else None,
                duration_ms=cr.duration_ms if cr else None,
            )
        )

    return Report(
        run_id=run_id,
        status=status,
        error=error,
        command=config.check_command,
        setup_command=config.setup_command,
        working_directory=config.working_directory,
        base_sha=atoms.base_sha,
        head_sha=atoms.head_sha,
        head_tree=atoms.head_tree,
        top_tree=top_tree,
        foreign_lines=foreign_lines,
        plan_version=plan.version,
        checks=checks,
        layers=layers_res,
        rounds=rounds,
        repairs=repairs or [],
        issue=issue,
        hook=hook or HookCounts(),
        bob=bob,
        started_at=started_at,
        finished_at=finished_at,
    )


def render_markdown(report: Report) -> str:
    """A reviewer-facing summary: checks table, layers table, rounds, repairs."""
    lines = [
        f"# Cleave Report — `{report.run_id}`",
        "",
        f"- **Status**: `{report.status}`",
        f"- **Command**: `{report.command}`",
        f"- **Base**: `{report.base_sha[:8]}` · **Head**: `{report.head_sha[:8]}`",
        "",
        "## Checks",
        "",
        "| Check | Status | Value | Detail |",
        "| --- | --- | --- | --- |",
    ]
    check_titles = {
        "coverage": "Atom coverage",
        "order": "Dependency order",
        "fidelity": "Tree fidelity",
        "shippability": "Layer shippability",
        "partition": "No new code",
    }
    for c in report.checks:
        icon = "✅" if c.status == "pass" else "⚠️"
        title = check_titles.get(c.id, c.id)
        lines.append(f"| {title} | {icon} {c.status} | {c.value} | {c.detail} |")

    lines.extend(
        [
            "",
            "## Layers",
            "",
            "| # | Layer | Branch | Changes | Tests | Status |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
    )
    for l in report.layers:
        icon = "✅" if l.status == "pass" else "❌"
        tests_str = f"{l.tests_passed} passed" if l.tests_passed is not None else "-"
        lines.append(
            f"| {l.index} | {l.name} | `{l.branch}` | +{l.added} -{l.removed} ({len(l.files)} files) | {tests_str} | {icon} {l.status} |"
        )

    if report.issue:
        lines.extend(
            [
                "",
                "## Issue & Resolution",
                "",
                f"- **Layer**: {report.issue.layer}",
                f"- **Test**: `{report.issue.test}`",
                f"- **Explanation**: {report.issue.explanation}",
                f"- **Resolution**: Merge layer {report.issue.resolution.from_} into {report.issue.resolution.into} (`{report.issue.resolution.name}`)",
            ]
        )

    return "\n".join(lines) + "\n"


def write_report(run: RunDir, report: Report) -> Path:
    run.report.parent.mkdir(parents=True, exist_ok=True)
    run.report.write_text(json.dumps(dump(report), indent=2))
    run.report_md.write_text(render_markdown(report))
    return run.report

