"""Build the stack: one commit per layer, each a prefix of the change.

Layer i's tree = base + atoms of layers 1..i. The top layer's tree must equal the head
tree (fidelity). Branches are ``cleave/<slug>/<i>-<layer-slug>``.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py (rebuild).
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
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


def _added_lines(repo: Path, a: str, b: str) -> dict[str, Counter[str]]:
    """Per path in ``b``, the lines ``a..b`` adds (as a multiset of their text)."""
    raw = git(repo, "diff", "--no-color", "--no-ext-diff", "-U0", "--find-renames", a, b)
    added: dict[str, Counter[str]] = {}
    for block in re.split(r"(?=^diff --git )", raw, flags=re.MULTILINE):
        header = re.match(r"^diff --git a/(.*?) b/(.*?)$", block, flags=re.MULTILINE)
        if not header:
            continue
        lines = added.setdefault(header.group(2), Counter())
        in_hunk = False
        for line in block.splitlines():
            if line.startswith("@@ "):
                in_hunk = True
            elif in_hunk and line.startswith("+"):
                lines[line[1:]] += 1
    return added


def foreign_lines(repo: Path, atoms: AtomsFile, top_tree: str) -> int:
    """Lines the stack adds that the original change doesn't add: new code. 0 when fidelity holds.

    Compares what ``base..top`` adds with what ``base..head`` adds, file by file. A stack
    that leaves part of the change out has no foreign lines for it (coverage and fidelity
    report that); a stack that writes code of its own does.
    """
    if top_tree == atoms.head_tree:
        return 0
    ours = _added_lines(repo, atoms.base_sha, top_tree)
    theirs = _added_lines(repo, atoms.base_sha, atoms.head_tree)
    return sum(
        max(0, n - theirs.get(path, Counter())[line]) for path, lines in ours.items() for line, n in lines.items()
    )
