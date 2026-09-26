"""Python edges: an atom that uses a name needs the atom that defines or imports it.

For each atom, parse the head version of its file with ``ast`` and find which top-level
definitions, class attributes and imports its added lines touch (``Symbols``). An edge
A -> B exists when A references a name B defines. Kinds: ``import`` (from/import
statements), ``call`` (function use), ``model`` (class or attribute use).
"""

from __future__ import annotations

from pathlib import Path

from ..models import Atom, AtomsFile, Edge, Symbols


def symbols_for(source: str, atom: Atom) -> Symbols:
    """Names the atom's added lines define and reference, given the file's head source."""
    raise NotImplementedError


def edges(repo: Path, atoms: AtomsFile) -> list[Edge]:
    raise NotImplementedError
