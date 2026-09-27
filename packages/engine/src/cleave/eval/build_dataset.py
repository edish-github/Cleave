"""Constructed diffs: squash 3-5 real commits into one tangled diff and keep the ground truth.

    load_datasets(eval/datasets.toml) -> [Dataset]
    build(repo, dataset) -> Built       # branch cleave-eval/<name>, ground truth per atom

The constructed head is one commit whose parent is ``dataset.base`` and whose tree is the
base tree with ``dataset.paths`` taken from the last commit (all paths when empty). Built
with plumbing only (temporary index, commit-tree, update-ref): the working tree and HEAD
are never touched, and building twice gives the same commit (fixed author, committer and
dates). The ground truth maps every atom of base..head to the commit that introduced it:
replay the commits one by one (limited to the paths) as a private chain of commits, then
attribute each atom to the earliest step that produced its lines: blame for added lines,
reverse blame for removed ones, and the step that created (or deleted, or renamed) the file
for whole-file atoms.

Spec: tests/test_eval.py.
"""

from __future__ import annotations

import os
import tempfile
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from ..atomize import atomize
from ..gitio import GitError, git, rev_parse
from ..models import Atom

BRANCH_PREFIX = "cleave-eval/"
_FIXED = {
    "GIT_AUTHOR_NAME": "Cleave eval",
    "GIT_AUTHOR_EMAIL": "eval@cleave.invalid",
    "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z",
    "GIT_COMMITTER_NAME": "Cleave eval",
    "GIT_COMMITTER_EMAIL": "eval@cleave.invalid",
    "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z",
}


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
    """Read ``[[datasets]]`` from a TOML file."""
    data = tomllib.loads(Path(path).read_text())
    out: list[Dataset] = []
    for entry in data.get("datasets", []):
        out.append(
            Dataset(
                name=entry["name"],
                repo=entry["repo"],
                base=entry["base"],
                commits=list(entry["commits"]),
                check=entry["check"],
                paths=list(entry.get("paths", [])),
                setup=entry.get("setup"),
                working_directory=entry.get("working_directory", "."),
            )
        )
    return out


def _tree_with_paths(repo: Path, base: str, source: str, paths: list[str]) -> str:
    """``base``'s tree with each of ``paths`` replaced by ``source``'s version (all of it if no paths)."""
    if not paths:
        return git(repo, "rev-parse", f"{source}^{{tree}}").strip()
    fd, index = tempfile.mkstemp(prefix="cleave-eval-index-")
    os.close(fd)
    os.unlink(index)  # git creates it; an empty file isn't a valid index
    env = {"GIT_INDEX_FILE": index}
    try:
        git(repo, "read-tree", base, env=env)
        for path in paths:
            listed = git(repo, "ls-files", "-z", "--", path, env=env)
            names = [n for n in listed.split("\0") if n]
            if names:
                git(repo, "update-index", "--force-remove", "-z", "--stdin", input="\0".join(names).encode() + b"\0", env=env)
            try:
                git(repo, "rev-parse", "--verify", "-q", f"{source}:{path}")
            except GitError:
                continue  # the path doesn't exist at source: it stays removed
            kind = git(repo, "cat-file", "-t", f"{source}:{path}").strip()
            if kind == "tree":
                git(repo, "read-tree", f"--prefix={path}/", f"{source}:{path}", env=env)
            else:
                mode_sha = git(repo, "ls-tree", source, "--", path).split("\t")[0].split()
                git(repo, "update-index", "--add", "--cacheinfo", f"{mode_sha[0]},{mode_sha[2]},{path}", env=env)
        return git(repo, "write-tree", env=env).strip()
    finally:
        Path(index).unlink(missing_ok=True)


def _commit(repo: Path, tree: str, parent: str, message: str) -> str:
    return git(repo, "commit-tree", tree, "-p", parent, "-m", message, env=_FIXED).strip()


def _subject(repo: Path, sha: str) -> str:
    return git(repo, "log", "-1", "--format=%s", sha).strip()


def build(repo: Path, dataset: Dataset) -> Built:
    base = rev_parse(repo, dataset.base)
    commits = [rev_parse(repo, c) for c in dataset.commits]
    if not commits:
        raise ValueError(f"Dataset {dataset.name} has no commits.")

    # The private replay chain: one commit per original commit, limited to the paths.
    chain: list[str] = []
    parent = base
    for sha in commits:
        step = _commit(repo, _tree_with_paths(repo, base, sha, dataset.paths), parent, f"replay {sha[:12]}")
        chain.append(step)
        parent = step

    lines = [f"cleave-eval {dataset.name}: {len(commits)} commits squashed", ""]
    lines += [f"{sha[:12]} {_subject(repo, sha)}" for sha in commits]
    tree = git(repo, "rev-parse", f"{chain[-1]}^{{tree}}").strip()
    head = _commit(repo, tree, base, "\n".join(lines))
    branch = f"{BRANCH_PREFIX}{dataset.name}"
    git(repo, "update-ref", f"refs/heads/{branch}", head)

    atoms = atomize(repo, base, head, require_clean=False)
    step_of = {step: original for step, original in zip(chain, commits)}
    truth = {atom.id: step_of[_step_for(repo, base, chain, atom)] for atom in atoms.atoms}
    return Built(dataset=dataset, branch=branch, base_sha=base, head_sha=head, ground_truth=truth)


def _blame_steps(repo: Path, args: list[str]) -> list[str]:
    out = git(repo, "blame", "--porcelain", *args)
    return [line.split()[0] for line in out.splitlines() if len(line) > 40 and line[:40].isalnum() and " " in line[:41]]


def _step_for(repo: Path, base: str, chain: list[str], atom: Atom) -> str:
    """The earliest replay step that produced this atom."""
    order = {sha: i for i, sha in enumerate(chain)}
    candidates: list[int] = []

    if atom.kind == "hunk" and atom.new_len > 0:
        for sha in _blame_steps(repo, [f"-L{atom.new_start},+{atom.new_len}", f"{base}..{chain[-1]}", "--", atom.file]):
            if sha in order:
                candidates.append(order[sha])
    if atom.kind == "hunk" and atom.old_len > 0:
        # --reverse names the last step where each removed line still existed; the next step removed it.
        for sha in _blame_steps(repo, ["--reverse", f"-L{atom.old_start},+{atom.old_len}", f"{base}..{chain[-1]}", "--", atom.old_file or atom.file]):
            nxt = 0 if sha == base else order.get(sha, -1) + 1
            if 0 <= nxt < len(chain):
                candidates.append(nxt)
    if not candidates:
        # Whole-file atoms (and anything blame couldn't place): the first step that touches the file.
        prev = base
        for i, step in enumerate(chain):
            touched = git(repo, "diff", "--name-only", "-M", prev, step).split()
            if atom.file in touched or (atom.old_file and atom.old_file in touched):
                candidates.append(i)
                break
            prev = step
    if not candidates:
        raise ValueError(f"Couldn't attribute atom {atom.id} ({atom.file}) to a commit.")
    return chain[min(candidates)]
