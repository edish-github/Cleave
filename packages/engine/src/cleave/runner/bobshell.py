"""Spawn ``bob run --mode cleave --format stream-json --max-cost <cap>`` for a job (P1).

The runner passes CLEAVE_RUN_ID=<job_id> in the environment so the run Bob starts through
``cleave_start`` uses the job id as its run id (the bundle's run_id must equal job_id).
Whether ``--mode cleave`` loads the project mode is open check C4; the stream-json event
shape is open check C5. The runner saves the stream as it is and parses none of it.

Spec: tests/test_runner.py.
"""

from __future__ import annotations

import subprocess

from ..models import Job


def prompt_for(job: Job) -> str:
    """The same request a person types in Bob IDE: ``Cleave <head> onto <base>``."""
    return f"Cleave {job.pull_request.head_branch} onto {job.pull_request.base_branch}"


def _cap(value: float) -> str:
    return f"{value:g}"


def command(job: Job, bob: str = "bob") -> list[str]:
    """``[bob, "run", "--mode", job.mode, "--format", "stream-json", "--max-cost", <cap>, <prompt>]``."""
    return [
        bob,
        "run",
        "--mode",
        job.mode,
        "--format",
        "stream-json",
        "--max-cost",
        _cap(job.config.bobcoin_cap),
        prompt_for(job),
    ]


def bob_version(bob: str = "bob") -> str | None:
    """``bob --version``'s first line, or None when Bob Shell isn't installed."""
    try:
        out = subprocess.run(
            [bob, "--version"],
            capture_output=True,
            text=True,
            timeout=20,
            stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    text = (out.stdout or out.stderr).strip()
    return text.splitlines()[0][:100] if out.returncode == 0 and text else None
