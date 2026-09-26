"""Spec for graph/: real edges from the code, not a hand-written dict (kill test K3's gap)."""

from __future__ import annotations

import pytest

from cleave.atomize import atomize
from cleave.graph import add_runtime_edge, build_graph, strongly_connected_groups
from cleave.graph import files as file_edges
from cleave.models import Atom, AtomsFile, Edge, Graph

from .conftest import FixtureRepo


def _atom(atoms: AtomsFile, file: str, contains: str | None = None) -> Atom:
    matches = [a for a in atoms.atoms if a.file == file and (contains is None or contains in a.patch)]
    assert len(matches) == 1, (file, contains, [a.patch[:40] for a in atoms.atoms if a.file == file])
    return matches[0]


def _has_edge(graph: Graph, frm: Atom, to: Atom, kinds: set[str] | None = None) -> bool:
    return any(e.from_ == frm.id and e.to == to.id and (kinds is None or e.kind in kinds) for e in graph.edges)


def _reaches(graph: Graph, frm: Atom, to: Atom) -> bool:
    """``frm`` needs ``to`` directly or through other atoms (needs is transitive)."""
    seen, stack = set(), [frm.id]
    while stack:
        node = stack.pop()
        for e in graph.edges:
            if e.from_ == node and e.to not in seen:
                if e.to == to.id:
                    return True
                seen.add(e.to)
                stack.append(e.to)
    return False


@pytest.fixture
def analyzed(repo: FixtureRepo) -> tuple[AtomsFile, Graph]:
    atoms = atomize(repo.path, repo.base, repo.head)
    return atoms, build_graph(repo.path, atoms)


def test_new_module_needs_the_class_it_imports(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    loyalty = _atom(atoms, "app/loyalty.py")
    tier = _atom(atoms, "app/models.py", "class Tier")
    assert _has_edge(graph, loyalty, tier, {"import", "model"})


def test_service_needs_the_function_it_calls(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    earned = _atom(atoms, "app/service.py", "def earned")
    loyalty = _atom(atoms, "app/loyalty.py")
    import_line = _atom(atoms, "app/service.py", "from app.loyalty import points_for")
    assert _has_edge(graph, import_line, loyalty, {"import"})
    assert _reaches(graph, earned, loyalty)


def test_test_needs_the_fixture_it_takes(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    test = _atom(atoms, "tests/test_loyalty.py")
    fixture = _atom(atoms, "tests/conftest.py", "def gold_member")
    assert _has_edge(graph, test, fixture, {"fixture"})
    assert _reaches(graph, test, _atom(atoms, "app/service.py", "def earned"))


def test_fixture_needs_the_class_it_uses(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    fixture = _atom(atoms, "tests/conftest.py", "def gold_member")
    tier = _atom(atoms, "app/models.py", "class Tier")
    assert _reaches(graph, fixture, tier)


@pytest.mark.xfail(reason="Stretch: keyword arguments to dataclass fields. Verification finds it otherwise.", strict=False)
def test_fixture_needs_the_dataclass_field_it_sets(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    fixture = _atom(atoms, "tests/conftest.py", "def gold_member")
    tier_field = _atom(atoms, "app/models.py", "tier: Tier")
    assert _has_edge(graph, fixture, tier_field, {"model"})


def test_edges_are_valid_unique_and_static(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, graph = analyzed
    ids = {a.id for a in atoms.atoms}
    keys = [(e.from_, e.to, e.kind) for e in graph.edges]
    assert graph.edges, "expected edges on the fixture repo"
    assert len(keys) == len(set(keys))
    for e in graph.edges:
        assert e.from_ in ids and e.to in ids
        assert e.from_ != e.to
        assert e.source == "static"


def test_symbols_are_recorded_on_atoms(analyzed: tuple[AtomsFile, Graph], repo: FixtureRepo) -> None:
    # build_graph fills Atom.symbols so cleave_atoms can show them to Bob.
    atoms, _ = analyzed
    loyalty = _atom(atoms, "app/loyalty.py")
    assert loyalty.symbols is not None
    assert "points_for" in loyalty.symbols.defines
    assert "Tier" in loyalty.symbols.references


def test_independent_hunks_of_a_file_have_no_order_edge(analyzed: tuple[AtomsFile, Graph]) -> None:
    atoms, _ = analyzed
    service = {a.id for a in atoms.atoms if a.file == "app/service.py"}
    for e in file_edges.edges(atoms):
        assert not (e.from_ in service and e.to in service), e


def test_cycles_become_forced_groups() -> None:
    a, b, c = "aaaaaaaaaaaa", "bbbbbbbbbbbb", "cccccccccccc"
    edges = [
        Edge(**{"from": a, "to": b, "kind": "call"}),
        Edge(**{"from": b, "to": a, "kind": "call"}),
        Edge(**{"from": c, "to": a, "kind": "import"}),
    ]
    assert strongly_connected_groups([a, b, c], edges) == [[a, b]]


def test_runtime_edges_are_marked_as_found_by_verification() -> None:
    a, b = "aaaaaaaaaaaa", "bbbbbbbbbbbb"
    graph = add_runtime_edge(Graph(), a, b, "refund_total")
    (edge,) = graph.edges
    assert (edge.from_, edge.to, edge.kind, edge.source, edge.symbol) == (a, b, "runtime", "verification", "refund_total")
    assert len(add_runtime_edge(graph, a, b, "refund_total").edges) == 1
