"""Layer plans: check, version and revise.

Every proposal and every move is saved as a new ``plan.vN.json`` with its violations,
so the Verification and Activity tabs can replay how the plan evolved.

Spec: tests/test_plan.py.
"""

from __future__ import annotations

from .models import AtomsFile, Graph, Label, Plan, PlanLayer, Violation
from .runs import RunDir


def check_plan(plan: Plan, atoms: AtomsFile, graph: Graph, max_layer_lines: int | None = None) -> list[Violation]:
    """All violations, in this order of kinds:

    - ``unknown_atom``: an id not in atoms.json
    - ``duplicate_atom``: an id in more than one layer (or twice in one)
    - ``missing_atom``: an atom in no layer
    - ``empty_layer``: a layer with no atoms
    - ``group_split``: a forced group spread over 2+ layers
    - ``order``: an edge whose ``to`` sits in a later layer than its ``from``
    - ``layer_too_large``: added + removed over ``max_layer_lines`` (only when given)

    An empty list means coverage and order both hold.
    """
    raise NotImplementedError


class PlanStore:
    """Plan versions for one run, on disk."""

    def __init__(self, run: RunDir, atoms: AtomsFile, graph: Graph, max_layer_lines: int | None = None) -> None:
        self.run = run
        self.atoms = atoms
        self.graph = graph
        self.max_layer_lines = max_layer_lines

    def latest(self) -> Plan | None:
        raise NotImplementedError

    def propose(self, layers: list[PlanLayer], labels: dict[str, Label] | None = None, author: str = "bob", reason: str | None = None) -> Plan:
        """Save the next version (v0 first) with its violations and return it."""
        raise NotImplementedError

    def move_atoms(self, atom_ids: list[str], to_layer: int, reason: str) -> Plan:
        """Copy the latest plan, move the atoms to ``to_layer`` (1-based), drop layers left empty,
        save the next version with fresh violations and return it.

        Raise ``ValueError`` for unknown atoms or a layer index out of range.
        """
        raise NotImplementedError

    def merge_layers(self, into: int, from_: int, name: str, reason: str) -> Plan:
        """Merge layer ``from_`` into ``into`` (adjacent layers only). Used after the repair limit."""
        raise NotImplementedError
