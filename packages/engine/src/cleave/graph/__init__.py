"""Dependency graph over atoms.

Merges edges from the three analyzers, then collapses strongly connected components
into forced groups (atoms that must share a layer).

Spec: tests/test_graph.py.
"""

from __future__ import annotations

from pathlib import Path

from ..models import AtomsFile, Edge, Graph
from . import files as file_edges
from . import pytest_fixtures
from . import python_ast


def build_graph(repo: Path, atoms: AtomsFile) -> Graph:
    """Edges from ``python_ast``, ``pytest_fixtures`` and ``files``, de-duplicated, plus SCC groups.

    Also fills ``atom.symbols`` on the atoms passed in, so atoms.json can be rewritten with
    them and ``cleave_atoms`` can show Bob what each atom defines and uses.
    """
    py_edges = python_ast.edges(repo, atoms)
    fix_edges = pytest_fixtures.edges(repo, atoms)
    f_edges = file_edges.edges(atoms)

    all_edges = [*py_edges, *fix_edges, *f_edges]
    ids = {a.id for a in atoms.atoms}

    deduped: list[Edge] = []
    seen: set[tuple[str, str, str]] = set()

    for e in all_edges:
        if e.from_ not in ids or e.to not in ids or e.from_ == e.to:
            continue
        key = (e.from_, e.to, e.kind)
        if key not in seen:
            seen.add(key)
            deduped.append(e)

    atom_ids = [a.id for a in atoms.atoms]
    groups = strongly_connected_groups(atom_ids, deduped)
    return Graph(version=1, edges=deduped, groups=groups)


def strongly_connected_groups(atom_ids: list[str], edges: list[Edge]) -> list[list[str]]:
    """Components with 2+ atoms (Tarjan or Kosaraju), each sorted, the list sorted."""
    adj: dict[str, list[str]] = {aid: [] for aid in atom_ids}
    for e in edges:
        if e.from_ in adj and e.to in adj and e.from_ != e.to:
            adj[e.from_].append(e.to)

    index = 0
    indices: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    sccs: list[list[str]] = []

    def strongconnect(v: str) -> None:
        nonlocal index
        indices[v] = index
        lowlinks[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in adj[v]:
            if w not in indices:
                strongconnect(w)
                lowlinks[v] = min(lowlinks[v], lowlinks[w])
            elif w in on_stack:
                lowlinks[v] = min(lowlinks[v], indices[w])

        if lowlinks[v] == indices[v]:
            scc: list[str] = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                scc.append(w)
                if w == v:
                    break
            if len(scc) >= 2:
                sccs.append(sorted(scc))

    for node in sorted(atom_ids):
        if node not in indices:
            strongconnect(node)

    return sorted(sccs)


def add_runtime_edge(graph: Graph, from_atom: str, to_atom: str, symbol: str | None) -> Graph:
    """Record a dependency found by a failing layer (``kind="runtime"``, ``source="verification"``)."""
    for e in graph.edges:
        if e.from_ == from_atom and e.to == to_atom and e.kind == "runtime" and e.symbol == symbol:
            return graph

    edge = Edge(
        **{
            "from": from_atom,
            "to": to_atom,
            "kind": "runtime",
            "source": "verification",
            "symbol": symbol,
        }
    )
    new_edges = [*graph.edges, edge]
    atom_ids = set()
    for e in new_edges:
        atom_ids.add(e.from_)
        atom_ids.add(e.to)
    for g in graph.groups:
        atom_ids.update(g)
    groups = strongly_connected_groups(sorted(atom_ids), new_edges)
    return Graph(version=1, edges=new_edges, groups=groups)

