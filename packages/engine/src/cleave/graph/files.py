"""File-order edges (kind ``file_order``).

- Create before edit: any atom touching a file needs that file's ``new_file`` atom.
- Same file: hunks of one file keep their relative order across layers (a later hunk needs
  the one before it only when their line ranges would shift each other; adjacent or
  overlapping ``-U0`` hunks must stay ordered).
- Delete after use: a ``deleted_file`` atom needs every atom that edits that file.
"""

from __future__ import annotations

from ..models import AtomsFile, Edge


def edges(atoms: AtomsFile) -> list[Edge]:
    raise NotImplementedError
