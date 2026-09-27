"""Constructed diffs: squash 3-5 real commits into one tangled diff and keep the ground truth.

    load_datasets(eval/datasets.toml) -> [Dataset]
    build(repo, dataset) -> Built       # branch cleave-eval/<name>, ground truth per atom

The constructed head is one commit whose parent is ``dataset.base`` and whose tree is the
base tree with ``dataset.paths`` taken from the last commit (all paths when empty). Built
with plumbing only (temporary index, commit-tree, update-ref): the working tree and HEAD
are never touched, and building twice gives the same commit (fixed author, committer and
dates). The ground truth maps every atom of base..head to the commit that introduced it:
replay the commits one by one (limited to the paths) and attribute each atom to the first
step whose diff touches it.

Spec: tests/test_eval.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Dataset:
    name: str
    repo: str
    base: str
    commits: list[str]
    check: str
    paths: list[str] = field(default_factory=list)
    setup: str | None = None
    working_directory: str = "."


@dataclass(frozen=True)
class Built:
    dataset: Dataset
    branch: str
    base_sha: str
    head_sha: str
    ground_truth: dict[str, str]
    """atom id -> sha of the original commit it came from."""


def load_datasets(path: Path) -> list[Dataset]:
    """Read ``[[datasets]]`` from a TOML file (tomllib)."""
    raise NotImplementedError


def build(repo: Path, dataset: Dataset) -> Built:
    raise NotImplementedError
