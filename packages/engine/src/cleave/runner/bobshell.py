"""Spawn ``bob run --mode cleave --format stream-json --max-cost <cap>`` for a job (P1).

The runner passes CLEAVE_RUN_ID=<job_id> in the environment so the run Bob starts through
``cleave_start`` uses the job id as its run id (the bundle's run_id must equal job_id).
Whether ``--mode cleave`` loads the project mode is open check C4; the stream-json event
shape is open check C5. Don't parse more of the stream than you've seen in real output.

Spec: tests/test_runner.py.
"""

from __future__ import annotations

from ..models import Job


def prompt_for(job: Job) -> str:
    """The same request a person types in Bob IDE: ``Cleave <head> onto <base>``."""
    raise NotImplementedError


def command(job: Job, bob: str = "bob") -> list[str]:
    """``[bob, "run", "--mode", job.mode, "--format", "stream-json", "--max-cost", <cap>, <prompt>]``."""
    raise NotImplementedError
