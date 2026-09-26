"""Spec for plan.py: coverage and order checks, and versioned plan changes."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from cleave.models import Atom, AtomsFile, Edge, Graph, Plan, PlanLayer
from cleave.plan import PlanStore, check_plan
from cleave.runs import RunDir

A, B, C, D = "aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc", "dddddddddddd"


def _atom(id_: str, added: int = 10) -> Atom:
    return Atom(id=id_, file=f"f/{id_[:3]}.py", kind="hunk", added=added, removed=0, patch="@@ -1,0 +1,1 @@\n+x\n", is_test=False)


ATOMS = AtomsFile(base_sha="1" * 40, head_sha="2" * 40, head_tree="3" * 40, atoms=[_atom(A), _atom(B), _atom(C), _atom(D, added=500)])
# B needs A; C and D form a cycle.
GRAPH = Graph(
    edges=[
        Edge(**{"from": B, "to": A, "kind": "import"}),
        Edge(**{"from": C, "to": D, "kind": "call"}),
        Edge(**{"from": D, "to": C, "kind": "call"}),
    ],
    groups=[[C, D]],
)


def _plan(*layers: list[str]) -> Plan:
    return Plan(version=0, author="bob", layers=[PlanLayer(name=f"L{i}", atoms=l) for i, l in enumerate(layers, 1)])


def _kinds(plan: Plan, **kw) -> list[str]:
    return [v.kind for v in check_plan(plan, ATOMS, GRAPH, **kw)]


def test_valid_plan_has_no_violations() -> None:
    assert check_plan(_plan([A], [B, C, D]), ATOMS, GRAPH) == []


def test_missing_atom() -> None:
    violations = check_plan(_plan([A], [B, C]), ATOMS, GRAPH)
    assert [(v.kind, v.atom) for v in violations if v.kind == "missing_atom"] == [("missing_atom", D)]


def test_duplicate_atom() -> None:
    assert "duplicate_atom" in _kinds(_plan([A, B], [B, C, D]))


def test_unknown_atom() -> None:
    violations = check_plan(_plan([A, "eeeeeeeeeeee"], [B, C, D]), ATOMS, GRAPH)
    assert [(v.kind, v.atom) for v in violations] == [("unknown_atom", "eeeeeeeeeeee")]


def test_order_violation_names_the_atom_and_its_layer() -> None:
    violations = check_plan(_plan([B], [A, C, D]), ATOMS, GRAPH)
    (v,) = violations
    assert (v.kind, v.atom, v.layer) == ("order", B, 1)


def test_forced_group_must_share_a_layer() -> None:
    assert "group_split" in _kinds(_plan([A, B, C], [D]))


def test_layer_size_limit_only_when_asked() -> None:
    plan = _plan([A], [B, C, D])
    assert "layer_too_large" not in _kinds(plan)
    assert "layer_too_large" in _kinds(plan, max_layer_lines=400)


@pytest.fixture
def store(tmp_path: Path) -> PlanStore:
    return PlanStore(RunDir(tmp_path, "20260927-030000-abc123").create(), ATOMS, GRAPH)


def test_propose_saves_version_zero_with_violations(store: PlanStore) -> None:
    plan = store.propose([PlanLayer(name="Base", atoms=[A]), PlanLayer(name="Rest", atoms=[B, C])])
    assert plan.version == 0
    assert [v.kind for v in plan.violations] == ["missing_atom"]
    saved = json.loads(store.run.plan(0).read_text())
    assert saved["version"] == 0 and saved["author"] == "bob"
    assert store.latest() == plan


def test_move_atoms_creates_the_next_version(store: PlanStore) -> None:
    store.propose([PlanLayer(name="Base", atoms=[A, C, D]), PlanLayer(name="Rest", atoms=[B])])
    moved = store.move_atoms([C, D], to_layer=2, reason="C and D only serve B")
    assert moved.version == 1
    assert moved.layers[1].atoms[-2:] == [C, D]
    assert moved.reason == "C and D only serve B"
    assert store.run.plan_versions() == [0, 1]


def test_move_that_empties_a_layer_drops_it(store: PlanStore) -> None:
    store.propose([PlanLayer(name="Base", atoms=[A]), PlanLayer(name="Middle", atoms=[C, D]), PlanLayer(name="Top", atoms=[B])])
    moved = store.move_atoms([C, D], to_layer=3, reason="fold")
    assert [layer.name for layer in moved.layers] == ["Base", "Top"]


def test_move_rejects_unknown_atoms_and_bad_layers(store: PlanStore) -> None:
    store.propose([PlanLayer(name="Base", atoms=[A, B, C, D])])
    with pytest.raises(ValueError):
        store.move_atoms(["eeeeeeeeeeee"], to_layer=1, reason="x")
    with pytest.raises(ValueError):
        store.move_atoms([A], to_layer=5, reason="x")
    assert store.run.plan_versions() == [0]


def test_merge_adjacent_layers(store: PlanStore) -> None:
    store.propose([PlanLayer(name="Base", atoms=[A]), PlanLayer(name="Two", atoms=[B]), PlanLayer(name="Three", atoms=[C, D])])
    merged = store.merge_layers(into=2, from_=3, name="Two and three", reason="Layer 2 can't pass without 3")
    assert [(l.name, l.atoms) for l in merged.layers] == [("Base", [A]), ("Two and three", [B, C, D])]
