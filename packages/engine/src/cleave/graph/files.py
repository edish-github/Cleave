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
    res: list[Edge] = []
    seen: set[tuple[str, str, str]] = set()

    by_file: dict[str, list] = {}
    for a in atoms.atoms:
        by_file.setdefault(a.file, []).append(a)

    for f, f_atoms in by_file.items():
        new_file_atom = next((a for a in f_atoms if a.kind == "new_file"), None)
        deleted_file_atom = next((a for a in f_atoms if a.kind == "deleted_file"), None)

        if new_file_atom:
            for a in f_atoms:
                if a.id != new_file_atom.id:
                    key = (a.id, new_file_atom.id, "file_order")
                    if key not in seen:
                        seen.add(key)
                        res.append(Edge(**{"from": a.id, "to": new_file_atom.id, "kind": "file_order", "source": "static"}))

        if deleted_file_atom:
            for a in f_atoms:
                if a.id != deleted_file_atom.id:
                    key = (deleted_file_atom.id, a.id, "file_order")
                    if key not in seen:
                        seen.add(key)
                        res.append(Edge(**{"from": deleted_file_atom.id, "to": a.id, "kind": "file_order", "source": "static"}))

        hunks = [a for a in f_atoms if a.kind == "hunk"]
        hunks.sort(key=lambda x: (x.old_start, x.new_start))
        for h1, h2 in zip(hunks, hunks[1:]):
            if h2.old_start <= h1.old_start + max(h1.old_len, 1):
                key = (h2.id, h1.id, "file_order")
                if key not in seen:
                    seen.add(key)
                    res.append(Edge(**{"from": h2.id, "to": h1.id, "kind": "file_order", "source": "static"}))

    return res

