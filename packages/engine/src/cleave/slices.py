"""Slices for the explore subagents.

Split the atoms into 3-5 slices of related files (by directory, then size) and write each as
``slices/<n>.md``: the atoms' ids, files and patches, plus the question every subagent answers:
a concern label (<= 60 chars) and an intent (<= 200 chars) per atom.
"""

from __future__ import annotations

from pathlib import Path

from .models import AtomsFile, Graph
from .runs import RunDir


def write_slices(run: RunDir, atoms: AtomsFile, graph: Graph, count: int | None = None) -> list[Path]:
    raise NotImplementedError
