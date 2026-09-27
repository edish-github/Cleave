"""Metrics per run, as /results shows them: valid stack, green k/k, foreign lines, largest
layer, and agreement with the ground truth.

agreement is the Rand index over pairs of atoms: the share of pairs that the run groups the
same way as the original commits (same layer and same commit, or different layer and
different commit). None without ground truth. A stack is valid when all five checks pass
and every layer is green.

Spec: tests/test_eval.py.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from itertools import combinations
from typing import Any

from ..models import Report


@dataclass(frozen=True)
class RunMetrics:
    valid: bool
    green: int
    layers: int
    foreign_lines: int
    largest_layer: int
    agreement: float | None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def agreement(layer_of: dict[str, int], ground_truth: dict[str, str]) -> float | None:
    """Rand index between the run's layers and the original commits, over atoms both know."""
    atoms = sorted(a for a in layer_of if a in ground_truth)
    pairs = list(combinations(atoms, 2))
    if not pairs:
        return None
    same = sum(1 for a, b in pairs if (layer_of[a] == layer_of[b]) == (ground_truth[a] == ground_truth[b]))
    return same / len(pairs)


def metrics(report: Report, ground_truth: dict[str, str] | None = None) -> RunMetrics:
    layers = report.layers
    green = sum(1 for layer in layers if layer.status == "pass")
    valid = all(c.status == "pass" for c in report.checks) and green == len(layers) and bool(layers)
    layer_of = {atom: layer.index for layer in layers for atom in layer.atoms}
    return RunMetrics(
        valid=valid,
        green=green,
        layers=len(layers),
        foreign_lines=report.foreign_lines,
        largest_layer=max((layer.added + layer.removed for layer in layers), default=0),
        agreement=agreement(layer_of, ground_truth) if ground_truth else None,
    )
