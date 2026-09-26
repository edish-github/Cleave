"""Pytest edges: a test that takes a fixture parameter needs the atom defining that fixture.

Fixtures are resolved by name from ``conftest.py`` files and test modules, the way pytest
resolves them. Kind: ``fixture``.
"""

from __future__ import annotations

from pathlib import Path

from ..models import AtomsFile, Edge


def edges(repo: Path, atoms: AtomsFile) -> list[Edge]:
    raise NotImplementedError
