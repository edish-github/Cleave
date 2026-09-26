"""Build the stack: one commit per layer, each a prefix of the change.

Layer i's tree = base + atoms of layers 1..i. The top layer's tree must equal the head
tree (fidelity). Branches are ``cleave/<slug>/<i>-<layer-slug>``.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py (rebuild).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from .atomize import patch_for
from .gitio import build_tree, commit_tree, git, update_ref
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
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", norm.lower()).strip("-")
    if len(slug) > max_len:
        slug = slug[:max_len].rstrip("-")
    return slug


def prefix_trees(repo: Path, atoms: AtomsFile, plan: Plan) -> list[str]:
    """Tree sha for every prefix, in layer order. Writes no refs."""
    by_id = atoms.by_id()
    accum: list = []
    trees: list[str] = []
    for layer in plan.layers:
        for aid in layer.atoms:
            if aid in by_id:
                accum.append(by_id[aid])
        patch = patch_for(accum)
        tree = build_tree(repo, atoms.base_sha, patch)
        trees.append(tree)
    return trees


def build_stack(repo: Path, atoms: AtomsFile, plan: Plan, slug: str) -> list[BuiltLayer]:
    """Create one commit per layer (each parented on the previous) and its branch ref."""
    trees = prefix_trees(repo, atoms, plan)
    parent = atoms.base_sha
    built: list[BuiltLayer] = []
    for i, (spec, tree) in enumerate(zip(plan.layers, trees), start=1):
        branch = f"cleave/{slug}/{i}-{slugify(spec.name)}"
        commit = commit_tree(repo, tree, parent, f"{spec.name}\n\nLayer {i} of {len(plan.layers)} in {slug}.")
        update_ref(repo, f"refs/heads/{branch}", commit)
        parent = commit
        built.append(BuiltLayer(index=i, name=spec.name, tree=tree, commit=commit, branch=branch))
    return built


def foreign_lines(repo: Path, atoms: AtomsFile, top_tree: str) -> int:
    """Lines that differ between the top tree and the head tree. 0 when fidelity holds."""
    if top_tree == atoms.head_tree:
        return 0
    numstat = git(repo, "diff", "--numstat", top_tree, atoms.head_tree)
    total = 0
    for line in numstat.splitlines():
        parts = line.split("\t", 2)
        if len(parts) >= 2 and parts[0] != "-" and parts[1] != "-":
            total += int(parts[0]) + int(parts[1])
    return total

