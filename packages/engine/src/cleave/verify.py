"""Verify every prefix of the stack in parallel.

For each layer i: build the prefix tree, check it out in its own worktree, run the setup
command then the check command in ``working_directory`` with a timeout, save the full log to
``checks/r<round>-l<i>.log`` and keep an excerpt (the failing test and its message).

Spec: tests/test_verify.py (parse functions) and tests/test_galaxium.py (end to end).
Starting point: research/kill-tests/cleave_verify.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .config import RunConfig
from .events import EventLog
from .models import AtomsFile, Failure, Plan, Round
from .runs import RunDir


@dataclass(frozen=True)
class PytestSummary:
    passed: int | None
    failed: int | None
    first_failure: Failure | None


def parse_pytest(output: str) -> PytestSummary:
    """Read counts from pytest's final summary line (``3 failed, 41 passed in 2.1s``,
    ``1 error in 0.4s``) and the first ``FAILED``/``ERROR`` node id with its message."""
    raise NotImplementedError


def excerpt(output: str, limit: int = 4000) -> str:
    """The part of a log a reviewer needs: the short test summary info section, else the tail."""
    raise NotImplementedError


def verify(repo: Path, atoms: AtomsFile, plan: Plan, config: RunConfig, run: RunDir, round_: int, log: EventLog | None = None) -> Round:
    """Run one verification round over all layers of ``plan`` and return its results.

    Emits ``verify.started``, one ``layer.passed`` / ``layer.failed`` per layer and
    ``verify.passed`` when every layer is green.
    """
    raise NotImplementedError
