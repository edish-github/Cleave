"""Metrics per run, as /results shows them: valid stack, green k/k, foreign lines, largest
layer, and agreement with the ground truth.

agreement is the Rand index over pairs of atoms: the share of pairs that the run groups the
same way as the original commits (same layer and same commit, or different layer and
different commit). None without ground truth. A stack is valid when all five checks pass
and every layer is green.

Spec: tests/test_eval.py.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models import Report


@dataclass(frozen=True)
class RunMetrics:
    valid: bool
    green: int
    layers: int
    foreign_lines: int
    largest_layer: int
    agreement: float | None


def metrics(report: Report, ground_truth: dict[str, str] | None = None) -> RunMetrics:
    raise NotImplementedError
