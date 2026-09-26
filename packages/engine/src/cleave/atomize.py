"""Cut a diff into atoms.

One atom per ``-U0`` hunk. New, deleted, renamed, binary and mode-only files are
one whole-file atom each. Atom ids are ``sha256(file + "\\0" + patch)[:12]``, so the
same diff always yields the same ids.

Spec: tests/test_atomize_build.py. Starting point: research/kill-tests/cleave_prototype.py (parse).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .gitio import diff, is_clean, rev_parse, tree_of
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
    if not is_clean(repo):
        raise ValueError(f"Working tree at {repo} is dirty")

    try:
        base_sha = rev_parse(repo, base)
        head_sha = rev_parse(repo, head)
        head_tree = tree_of(repo, head_sha)
    except Exception as e:
        raise ValueError(f"Failed to resolve refs: {e}") from e

    raw_diff = diff(repo, base_sha, head_sha)
    raw_blocks = re.split(r"(?=^diff --git )", raw_diff, flags=re.MULTILINE)
    atoms: list[Atom] = []

    for block in raw_blocks:
        if not block.strip():
            continue
        header = block.splitlines()[0]
        m = re.match(r"^diff --git a/(.*?) b/(.*?)$", header)
        if not m:
            continue
        old_p, new_p = m.group(1), m.group(2)
        lines = block.splitlines()

        if "GIT binary patch" in block or "Binary files" in block:
            aid = atom_id(new_p, block)
            atoms.append(
                Atom(
                    id=aid,
                    file=new_p,
                    kind="binary",
                    added=0,
                    removed=0,
                    patch=block,
                    is_test=is_test_path(new_p),
                )
            )
        elif "rename from" in block and not any(l.startswith("@@ ") for l in lines):
            m_old = re.search(r"^rename from (.*)$", block, re.MULTILINE)
            m_new = re.search(r"^rename to (.*)$", block, re.MULTILINE)
            old_file = m_old.group(1) if m_old else old_p
            new_file = m_new.group(1) if m_new else new_p
            aid = atom_id(new_file, block)
            atoms.append(
                Atom(
                    id=aid,
                    file=new_file,
                    old_file=old_file,
                    kind="rename",
                    added=0,
                    removed=0,
                    patch=block,
                    is_test=is_test_path(new_file),
                )
            )
        elif "deleted file mode" in block:
            rem = sum(1 for l in lines if l.startswith("-") and not l.startswith("---"))
            aid = atom_id(old_p, block)
            atoms.append(
                Atom(
                    id=aid,
                    file=old_p,
                    kind="deleted_file",
                    added=0,
                    removed=rem,
                    patch=block,
                    is_test=is_test_path(old_p),
                )
            )
        elif "new file mode" in block:
            add = sum(1 for l in lines if l.startswith("+") and not l.startswith("+++"))
            aid = atom_id(new_p, block)
            atoms.append(
                Atom(
                    id=aid,
                    file=new_p,
                    kind="new_file",
                    added=add,
                    removed=0,
                    patch=block,
                    is_test=is_test_path(new_p),
                )
            )
        elif ("old mode" in block or "new mode" in block) and not any(l.startswith("@@ ") for l in lines):
            aid = atom_id(new_p, block)
            atoms.append(
                Atom(
                    id=aid,
                    file=new_p,
                    kind="mode",
                    added=0,
                    removed=0,
                    patch=block,
                    is_test=is_test_path(new_p),
                )
            )
        else:
            hunk_blocks = re.split(r"(?=^@@ )", block, flags=re.MULTILINE)
            for h in hunk_blocks[1:]:
                h_lines = h.splitlines()
                hm = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", h_lines[0])
                if not hm:
                    continue
                old_start = int(hm.group(1))
                old_len = int(hm.group(2)) if hm.group(2) is not None else 1
                new_start = int(hm.group(3))
                new_len = int(hm.group(4)) if hm.group(4) is not None else 1
                add = sum(1 for l in h_lines if l.startswith("+") and not l.startswith("+++"))
                rem = sum(1 for l in h_lines if l.startswith("-") and not l.startswith("---"))
                aid = atom_id(new_p, h)
                atoms.append(
                    Atom(
                        id=aid,
                        file=new_p,
                        kind="hunk",
                        old_start=old_start,
                        old_len=old_len,
                        new_start=new_start,
                        new_len=new_len,
                        added=add,
                        removed=rem,
                        patch=h,
                        is_test=is_test_path(new_p),
                    )
                )

    return AtomsFile(base_sha=base_sha, head_sha=head_sha, head_tree=head_tree, atoms=atoms)


def patch_for(atoms: list[Atom]) -> str:
    """Reassemble a patch ``git apply --cached --unidiff-zero`` accepts from any subset of atoms.

    Adds the ``diff --git`` / ``---`` / ``+++`` headers each file needs, keeps hunks of a
    file in ascending ``old_start`` order, and emits whole-file atoms as-is.
    """
    parts: list[str] = []
    hunks_by_file: dict[str, list[Atom]] = {}
    file_order: list[str] = []

    for a in atoms:
        if a.kind == "hunk":
            if a.file not in hunks_by_file:
                hunks_by_file[a.file] = []
                file_order.append(a.file)
            hunks_by_file[a.file].append(a)
        else:
            parts.append(a.patch.rstrip("\n") + "\n")

    for f in file_order:
        h_list = sorted(hunks_by_file[f], key=lambda x: (x.old_start, x.new_start))
        header = f"diff --git a/{f} b/{f}\n--- a/{f}\n+++ b/{f}\n"
        body = "\n".join(h.patch.rstrip("\n") for h in h_list) + "\n"
        parts.append(header + body)

    return "\n".join(parts)

