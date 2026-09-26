"""Build the stack: one commit per layer, each a prefix of the change.

Layer i's tree = base + atoms of layers 1..i. The top layer's tree must equal the head
tree (fidelity). Branches are ``cleave/<slug>/<i>-<layer-slug>``.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py (rebuild).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .models import AtomsFile, Plan


@dataclass(frozen=True)
class BuiltLayer:
    index: int
    name: str
    tree: str
    commit: str
    branch: str


def slugify(text: str, max_len: int = 48) -> str:
    """Lowercase, ASCII, words joined by '-', at most ``max_len`` chars."""
    raise NotImplementedError


def prefix_trees(repo: Path, atoms: AtomsFile, plan: Plan) -> list[str]:
    """Tree sha for every prefix, in layer order. Writes no refs."""
    raise NotImplementedError


def build_stack(repo: Path, atoms: AtomsFile, plan: Plan, slug: str) -> list[BuiltLayer]:
    """Create one commit per layer (each parented on the previous) and its branch ref."""
    raise NotImplementedError


def foreign_lines(repo: Path, atoms: AtomsFile, top_tree: str) -> int:
    """Lines that differ between the top tree and the head tree. 0 when fidelity holds."""
    raise NotImplementedError
