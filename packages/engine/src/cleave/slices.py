"""Slices for the explore subagents.

Split the atoms into 3-5 slices of related files (by directory, then size) and write each as
``slices/<n>.md``: the atoms' ids, files and patches, plus the question every subagent answers:
a concern label (<= 60 chars) and an intent (<= 200 chars) per atom.
"""

from __future__ import annotations

import math
from pathlib import Path

from .models import Atom, AtomsFile, Graph
from .runs import RunDir


def write_slices(run: RunDir, atoms: AtomsFile, graph: Graph, count: int | None = None) -> list[Path]:
    run.slices.mkdir(parents=True, exist_ok=True)
    if not atoms.atoms:
        return []

    total_atoms = len(atoms.atoms)
    if count is not None:
        target_count = max(1, count)
    elif total_atoms <= 3:
        target_count = total_atoms
    elif total_atoms <= 10:
        target_count = 3
    elif total_atoms <= 25:
        target_count = 4
    else:
        target_count = 5

    target_count = min(target_count, total_atoms)

    # Group atoms by directory, then file, then line position
    def atom_sort_key(a: Atom) -> tuple[str, str, int]:
        p = Path(a.file)
        return (str(p.parent), p.name, a.new_start)

    sorted_atoms = sorted(atoms.atoms, key=atom_sort_key)

    chunk_size = math.ceil(total_atoms / target_count)
    chunks: list[list[Atom]] = []
    for i in range(0, total_atoms, chunk_size):
        chunks.append(sorted_atoms[i : i + chunk_size])

    slice_paths: list[Path] = []
    for idx, chunk in enumerate(chunks, start=1):
        slice_file = run.slices / f"{idx}.md"
        files_in_slice = sorted(set(a.file for a in chunk))

        content_lines = [
            f"# Explore Slice {idx} of {len(chunks)}",
            "",
            "Answer the following for each atom:",
            "- **Concern label** (<= 60 chars): What feature, area, or domain does this atom belong to?",
            "- **Intent** (<= 200 chars): Why is this change being made?",
            "",
            f"- Total files: {len(files_in_slice)}",
            f"- Total atoms: {len(chunk)}",
            "",
            "---",
            "",
        ]

        for a in chunk:
            content_lines.extend(
                [
                    f"## Atom `{a.id}` — `{a.file}`",
                    f"- Kind: `{a.kind}` (+{a.added} / -{a.removed})",
                    f"- Lines: {a.old_start}..{a.old_start + a.old_len} -> {a.new_start}..{a.new_start + a.new_len}",
                ]
            )
            if a.symbols:
                if a.symbols.defines:
                    content_lines.append(f"- Defines: {', '.join(a.symbols.defines)}")
                if a.symbols.references:
                    content_lines.append(f"- References: {', '.join(a.symbols.references)}")

            content_lines.extend(
                [
                    "",
                    "```diff",
                    a.patch.strip("\n"),
                    "```",
                    "",
                ]
            )

        slice_file.write_text("\n".join(content_lines) + "\n")
        slice_paths.append(slice_file)

    return slice_paths
