"""Git plumbing. Nothing here may touch the user's working tree or index.

Build trees with a throwaway index (``GIT_INDEX_FILE``) seeded from the base tree,
``git apply --cached --unidiff-zero``, ``write-tree`` and ``commit-tree``. Verification
runs in ``git worktree`` checkouts under a temp dir, removed afterwards.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path


class GitError(RuntimeError):
    """A git command failed. ``stderr`` holds git's message."""

    def __init__(self, args: list[str], stderr: str) -> None:
        super().__init__(f"git {' '.join(args)}: {stderr.strip()}")
        self.stderr = stderr


def git(repo: Path, *args: str, input: bytes | None = None, env: dict[str, str] | None = None) -> str:
    """Run git in ``repo`` and return stdout (text). Raise GitError on a non-zero exit."""
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    proc = subprocess.run(
        ["git", *args],
        cwd=str(repo),
        input=input,
        env=run_env,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise GitError(list(args), proc.stderr.decode("utf-8", errors="replace"))
    return proc.stdout.decode("utf-8", errors="replace")


def rev_parse(repo: Path, ref: str) -> str:
    """Full 40-char sha for a ref or sha."""
    return git(repo, "rev-parse", ref).strip()


def tree_of(repo: Path, commit: str) -> str:
    """Tree sha of a commit (``<commit>^{tree}``)."""
    return git(repo, "rev-parse", f"{commit}^{{tree}}").strip()


def is_clean(repo: Path) -> bool:
    """True when the working tree has no uncommitted changes. atomize refuses a dirty tree."""
    out = git(repo, "status", "--porcelain", "--untracked-files=all")
    return len(out.strip()) == 0


def diff(repo: Path, base: str, head: str) -> str:
    """``git diff --no-color --no-ext-diff -U0 --find-renames --binary base head``."""
    return git(repo, "diff", "--no-color", "--no-ext-diff", "-U0", "--find-renames", "--binary", base, head)


def build_tree(repo: Path, base: str, patch: str) -> str:
    """Apply ``patch`` on top of ``base``'s tree in a temporary index and return the new tree sha.

    Raise GitError when the patch does not apply. Never touches the working tree.
    """
    with tempfile.NamedTemporaryFile(delete=False) as f:
        temp_idx = f.name
    try:
        env = {"GIT_INDEX_FILE": temp_idx}
        git(repo, "read-tree", base, env=env)
        if patch.strip():
            git(
                repo,
                "apply",
                "--cached",
                "--unidiff-zero",
                "--whitespace=nowarn",
                input=patch.encode("utf-8"),
                env=env,
            )
        return git(repo, "write-tree", env=env).strip()
    finally:
        if os.path.exists(temp_idx):
            os.remove(temp_idx)


def commit_tree(repo: Path, tree: str, parent: str, message: str) -> str:
    """Create a commit object for ``tree`` with one parent; return its sha."""
    return git(repo, "commit-tree", tree, "-p", parent, "-m", message).strip()


def update_ref(repo: Path, ref: str, sha: str) -> None:
    """Point ``ref`` (e.g. ``refs/heads/cleave/<slug>/1-models``) at ``sha``."""
    git(repo, "update-ref", ref, sha)


def add_worktree(repo: Path, path: Path, commit: str) -> None:
    """Detached ``git worktree add`` of ``commit`` at ``path``."""
    git(repo, "worktree", "add", "--detach", str(path), commit)


def remove_worktree(repo: Path, path: Path) -> None:
    """``git worktree remove --force`` and prune."""
    git(repo, "worktree", "remove", "--force", str(path))
    git(repo, "worktree", "prune")

