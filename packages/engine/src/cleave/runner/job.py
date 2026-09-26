"""One runner job (P1): clone -> overlay bob_config -> bob run -> events -> complete.

    heartbeat(job_id) now and every 15 s          # 409 -> JobCancelled
    checkout = prepare_checkout(job, workdir)     # clone, fetch both branches, cleave init
    run bobshell.command(job) in checkout with CLEAVE_RUN_ID=job.job_id
    forward new lines of .cleave/runs/<job_id>/events.ndjson every few seconds
    exit 0  -> complete(job_id, bundle=load_bundle(..., source="runner"))
    exit ≠ 0 or no run directory -> complete(job_id, error="bob run exited with code N: <tail of stderr>")
    JobCancelled from the server -> stop bob and return

Spec: tests/test_runner.py.
"""

from __future__ import annotations

from pathlib import Path

from ..models import Job
from .client import RunnerClient


def prepare_checkout(job: Job, workdir: Path) -> Path:
    """Clone ``job.repo.clone_url`` into ``workdir/<job_id>``, fetch head and base branches,
    check out the head branch, and install the Cleave mode and config exactly like
    ``cleave init`` with the job's config (check, setup, working directory, limits)."""
    raise NotImplementedError


def run_job(job: Job, client: RunnerClient, workdir: Path, bob_command: list[str] | None = None) -> str:
    """Run one job to the end and report it. Returns the final status: succeeded, failed or cancelled.
    ``bob_command`` replaces ``bobshell.command(job)`` (tests pass a stand-in)."""
    raise NotImplementedError


def serve(client: RunnerClient, workdir: Path, once: bool = False) -> None:
    """Heartbeat, claim, run, repeat. ``once`` stops after one claim (with or without a job)."""
    raise NotImplementedError
