"""Assemble ``report.json`` and ``report.md`` from a finished run.

The five checks, in this order and with these ids: coverage, order, fidelity,
shippability, partition. ``status`` is ``verified`` when all five pass, ``review`` when
only shippability needs attention after the repair limit, ``failed`` on an error.

Spec: tests/test_report.py.
"""

from __future__ import annotations

from pathlib import Path

from datetime import datetime

from .build import BuiltLayer
from .config import RunConfig
from .models import AtomsFile, BobStats, Graph, HookCounts, Issue, Plan, Repair, Report, Round
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
    raise NotImplementedError


def render_markdown(report: Report) -> str:
    """A reviewer-facing summary: checks table, layers table, rounds, repairs."""
    raise NotImplementedError


def write_report(run: RunDir, report: Report) -> Path:
    raise NotImplementedError
