"""Git plumbing. Nothing here may touch the user's working tree or index.

Build trees with a throwaway index (``GIT_INDEX_FILE``) seeded from the base tree,
``git apply --cached --unidiff-zero``, ``write-tree`` and ``commit-tree``. Verification
runs in ``git worktree`` checkouts under a temp dir, removed afterwards.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py.
"""

from __future__ import annotations

from pathlib import Path


class GitError(RuntimeError):
    """A git command failed. ``stderr`` holds git's message."""

    def __init__(self, args: list[str], stderr: str) -> None:
        super().__init__(f"git {' '.join(args)}: {stderr.strip()}")
        self.stderr = stderr


def git(repo: Path, *args: str, input: bytes | None = None, env: dict[str, str] | None = None) -> str:
    """Run git in ``repo`` and return stdout (text). Raise GitError on a non-zero exit."""
    raise NotImplementedError


def rev_parse(repo: Path, ref: str) -> str:
    """Full 40-char sha for a ref or sha."""
    raise NotImplementedError


def tree_of(repo: Path, commit: str) -> str:
    """Tree sha of a commit (``<commit>^{tree}``)."""
    raise NotImplementedError


def is_clean(repo: Path) -> bool:
    """True when the working tree has no uncommitted changes. atomize refuses a dirty tree."""
    raise NotImplementedError


def diff(repo: Path, base: str, head: str) -> str:
    """``git diff --no-color --no-ext-diff -U0 --find-renames --binary base head``."""
    raise NotImplementedError


def build_tree(repo: Path, base: str, patch: str) -> str:
    """Apply ``patch`` on top of ``base``'s tree in a temporary index and return the new tree sha.

    Raise GitError when the patch does not apply. Never touches the working tree.
    """
    raise NotImplementedError


def commit_tree(repo: Path, tree: str, parent: str, message: str) -> str:
    """Create a commit object for ``tree`` with one parent; return its sha."""
    raise NotImplementedError


def update_ref(repo: Path, ref: str, sha: str) -> None:
    """Point ``ref`` (e.g. ``refs/heads/cleave/<slug>/1-models``) at ``sha``."""
    raise NotImplementedError


def add_worktree(repo: Path, path: Path, commit: str) -> None:
    """Detached ``git worktree add`` of ``commit`` at ``path``."""
    raise NotImplementedError


def remove_worktree(repo: Path, path: Path) -> None:
    """``git worktree remove --force`` and prune."""
    raise NotImplementedError
