"""Cut a diff into atoms.

One atom per ``-U0`` hunk. New, deleted, renamed, binary and mode-only files are
one whole-file atom each. Atom ids are ``sha256(file + "\\0" + patch)[:12]``, so the
same diff always yields the same ids.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py (parse).
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from .models import Atom, AtomsFile

TEST_PATTERNS = ("tests/", "test_", "_test.py", "conftest.py")


def atom_id(file: str, patch: str) -> str:
    return hashlib.sha256(f"{file}\0{patch}".encode()).hexdigest()[:12]


def is_test_path(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return "/tests/" in f"/{path}" or name.startswith("test_") or name.endswith("_test.py") or name == "conftest.py"


def atomize(repo: Path, base: str, head: str) -> AtomsFile:
    """Diff ``base..head`` and return every atom, in diff order.

    Raises ``ValueError`` if the working tree is dirty or the refs don't resolve.
    """
    raise NotImplementedError


def patch_for(atoms: list[Atom]) -> str:
    """Reassemble a patch ``git apply --cached --unidiff-zero`` accepts from any subset of atoms.

    Adds the ``diff --git`` / ``---`` / ``+++`` headers each file needs, keeps hunks of a
    file in ascending ``old_start`` order, and emits whole-file atoms as-is.
    """
    raise NotImplementedError
