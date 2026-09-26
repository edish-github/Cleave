"""Dependency graph over atoms.

Merges edges from the three analyzers, then collapses strongly connected components
into forced groups (atoms that must share a layer).

Spec: tests/test_graph.py.
"""

from __future__ import annotations

from pathlib import Path

from ..models import AtomsFile, Edge, Graph


def build_graph(repo: Path, atoms: AtomsFile) -> Graph:
    """Edges from ``python_ast``, ``pytest_fixtures`` and ``files``, de-duplicated, plus SCC groups.

    Also fills ``atom.symbols`` on the atoms passed in, so atoms.json can be rewritten with
    them and ``cleave_atoms`` can show Bob what each atom defines and uses.
    """
    raise NotImplementedError


def strongly_connected_groups(atom_ids: list[str], edges: list[Edge]) -> list[list[str]]:
    """Components with 2+ atoms (Tarjan or Kosaraju), each sorted, the list sorted."""
    raise NotImplementedError


def add_runtime_edge(graph: Graph, from_atom: str, to_atom: str, symbol: str | None) -> Graph:
    """Record a dependency found by a failing layer (``kind="runtime"``, ``source="verification"``)."""
    raise NotImplementedError
