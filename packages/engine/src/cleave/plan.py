"""Layer plans: check, version and revise.

Every proposal and every move is saved as a new ``plan.vN.json`` with its violations,
so the Verification and Activity tabs can replay how the plan evolved.

Spec: tests/test_plan.py.
"""

from __future__ import annotations

import json
from pathlib import Path

from .models import AtomsFile, Graph, Label, Plan, PlanLayer, Violation, dump
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
    violations: list[Violation] = []
    known_atoms = {a.id: a for a in atoms.atoms}

    # 1. unknown_atom
    for i, layer in enumerate(plan.layers, 1):
        for aid in layer.atoms:
            if aid not in known_atoms:
                violations.append(
                    Violation(kind="unknown_atom", atom=aid, layer=i, detail=f"Atom {aid} not found in diff")
                )

    # 2. duplicate_atom
    seen: set[str] = set()
    dup_seen: set[str] = set()
    for i, layer in enumerate(plan.layers, 1):
        for aid in layer.atoms:
            if aid in seen and aid not in dup_seen:
                dup_seen.add(aid)
                violations.append(
                    Violation(kind="duplicate_atom", atom=aid, layer=i, detail=f"Atom {aid} is duplicated")
                )
            seen.add(aid)

    # 3. missing_atom
    plan_atoms = {aid for layer in plan.layers for aid in layer.atoms}
    for aid in known_atoms:
        if aid not in plan_atoms:
            violations.append(
                Violation(kind="missing_atom", atom=aid, layer=None, detail=f"Atom {aid} is missing from plan")
            )

    # 4. empty_layer
    for i, layer in enumerate(plan.layers, 1):
        if not layer.atoms:
            violations.append(
                Violation(kind="empty_layer", atom=None, layer=i, detail=f"Layer {i} ({layer.name}) is empty")
            )

    # 5. group_split
    layer_of = plan.layer_of()
    for group in graph.groups:
        group_layers = {layer_of[aid] for aid in group if aid in layer_of}
        if len(group_layers) > 1:
            first_layer = min(group_layers)
            violations.append(
                Violation(
                    kind="group_split",
                    atom=group[0],
                    layer=first_layer,
                    detail=f"Group {group} split across layers {group_layers}",
                )
            )

    # 6. order
    for e in graph.edges:
        if e.from_ in layer_of and e.to in layer_of:
            from_l = layer_of[e.from_]
            to_l = layer_of[e.to]
            if to_l > from_l:
                violations.append(
                    Violation(
                        kind="order",
                        atom=e.from_,
                        layer=from_l,
                        detail=f"Order violation: {e.from_} in L{from_l} needs {e.to} in L{to_l}",
                    )
                )

    # 7. layer_too_large
    if max_layer_lines is not None:
        for i, layer in enumerate(plan.layers, 1):
            total_lines = sum(
                known_atoms[aid].added + known_atoms[aid].removed for aid in layer.atoms if aid in known_atoms
            )
            if total_lines > max_layer_lines:
                violations.append(
                    Violation(
                        kind="layer_too_large",
                        atom=None,
                        layer=i,
                        detail=f"Layer {i} has {total_lines} lines (limit {max_layer_lines})",
                    )
                )

    return violations


class PlanStore:
    """Plan versions for one run, on disk."""

    def __init__(self, run: RunDir, atoms: AtomsFile, graph: Graph, max_layer_lines: int | None = None) -> None:
        self.run = run
        self.atoms = atoms
        self.graph = graph
        self.max_layer_lines = max_layer_lines

    def latest(self) -> Plan | None:
        versions = self.run.plan_versions()
        if not versions:
            return None
        return Plan.model_validate_json(self.run.plan(versions[-1]).read_text())

    def propose(
        self,
        layers: list[PlanLayer],
        labels: dict[str, Label] | None = None,
        author: str = "bob",
        reason: str | None = None,
    ) -> Plan:
        """Save the next version (v0 first) with its violations and return it."""
        versions = self.run.plan_versions()
        next_v = 0 if not versions else versions[-1] + 1
        plan = Plan(
            version=next_v,
            author=author,  # type: ignore[arg-type]
            reason=reason,
            layers=layers,
            labels=labels,
        )
        plan.violations = check_plan(plan, self.atoms, self.graph, self.max_layer_lines)
        self.run.plan(next_v).write_text(json.dumps(dump(plan), indent=2))
        return plan

    def move_atoms(self, atom_ids: list[str], to_layer: int, reason: str) -> Plan:
        """Copy the latest plan, move the atoms to ``to_layer`` (1-based), drop layers left empty,
        save the next version with fresh violations and return it.

        Raise ``ValueError`` for unknown atoms or a layer index out of range.
        """
        current = self.latest()
        if not current:
            raise ValueError("No plan exists to modify")

        if to_layer < 1 or to_layer > len(current.layers):
            raise ValueError(f"Layer {to_layer} out of range (1..{len(current.layers)})")

        known_atoms = self.atoms.by_id()
        for aid in atom_ids:
            if aid not in known_atoms:
                raise ValueError(f"Unknown atom: {aid}")

        target_layer = current.layers[to_layer - 1]

        new_layers: list[PlanLayer] = []
        for l in current.layers:
            new_atom_list = [a for a in l.atoms if a not in atom_ids]
            if l == target_layer:
                new_atom_list.extend(atom_ids)
            if new_atom_list:
                new_layers.append(PlanLayer(name=l.name, rationale=l.rationale, atoms=new_atom_list))

        next_v = current.version + 1
        plan = Plan(
            version=next_v,
            author=current.author,
            reason=reason,
            layers=new_layers,
            labels=current.labels,
        )
        plan.violations = check_plan(plan, self.atoms, self.graph, self.max_layer_lines)
        self.run.plan(next_v).write_text(json.dumps(dump(plan), indent=2))
        return plan

    def merge_layers(self, into: int, from_: int, name: str, reason: str) -> Plan:
        """Merge layer ``from_`` into ``into`` (adjacent layers only). Used after the repair limit."""
        current = self.latest()
        if not current:
            raise ValueError("No plan exists to modify")

        if not (1 <= into <= len(current.layers) and 1 <= from_ <= len(current.layers)):
            raise ValueError("Layer index out of range")
        if abs(into - from_) != 1:
            raise ValueError("Can only merge adjacent layers")

        into_idx = into - 1
        from_idx = from_ - 1

        l_into = current.layers[into_idx]
        l_from = current.layers[from_idx]

        if into_idx < from_idx:
            merged_atoms = [*l_into.atoms, *l_from.atoms]
        else:
            merged_atoms = [*l_from.atoms, *l_into.atoms]

        merged_layer = PlanLayer(name=name, rationale=reason, atoms=merged_atoms)

        new_layers: list[PlanLayer] = []
        for i, l in enumerate(current.layers):
            if i == into_idx:
                new_layers.append(merged_layer)
            elif i == from_idx:
                continue
            else:
                new_layers.append(l)

        next_v = current.version + 1
        plan = Plan(
            version=next_v,
            author=current.author,
            reason=reason,
            layers=new_layers,
            labels=current.labels,
        )
        plan.violations = check_plan(plan, self.atoms, self.graph, self.max_layer_lines)
        self.run.plan(next_v).write_text(json.dumps(dump(plan), indent=2))
        return plan

