"""Runner protocol client (P1): claim · heartbeat · events · complete.

Talks to the web app's /api/runner/* with a runner token (``Authorization: Bearer clv_…``).
Shapes: /schemas/job.schema.json (Job, $defs/heartbeat, $defs/completion) and
/schemas/event.schema.json. Server side: apps/web/src/server/jobs.ts.

    POST /api/runner/claim                   200 Job | 204 nothing queued (long poll, ≤ 25 s)
    POST /api/runner/heartbeat               RunnerHeartbeat -> 204 (409 if its job_id isn't running)
    POST /api/runner/runs/<job_id>/events    NDJSON of Event, ≤ 500 per request -> 204
    POST /api/runner/runs/<job_id>/complete  JobCompletion (gzip) -> 200 {stack_id, …} | 204

409 from heartbeat/events/complete means the job was cancelled in the browser (or has
finished): stop. While a job runs, heartbeat with its job_id at least every 15 s.

Spec: tests/test_runner.py.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..models import Bundle, Event, Job

CLAIM_TIMEOUT_S = 40.0
"""Longer than the server's 25 s long poll."""

EVENTS_PER_REQUEST = 500


class RunnerAuthError(RuntimeError):
    """401: the token is missing, wrong or revoked."""


class JobCancelled(RuntimeError):
    """409: the job isn't running any more (cancelled in the browser, or already finished)."""


class RunnerClient:
    def __init__(self, url: str, token: str, transport: httpx.BaseTransport | None = None) -> None:
        """``transport`` lets tests pass ``httpx.MockTransport``."""
        raise NotImplementedError

    def claim(self) -> Job | None:
        """Wait for a job. None when the server answers 204."""
        raise NotImplementedError

    def heartbeat(self, job_id: str | None = None, bob_version: str | None = None) -> None:
        """Send runner_version (cleave.__version__), os (platform.system().lower()), bob_version, job_id."""
        raise NotImplementedError

    def send_events(self, job_id: str, events: list[Event]) -> None:
        """POST as NDJSON (``application/x-ndjson``), in chunks of EVENTS_PER_REQUEST. No request for an empty list."""
        raise NotImplementedError

    def complete(self, job_id: str, bundle: Bundle | None = None, error: str | None = None) -> dict[str, Any] | None:
        """Succeeded with a bundle, or failed with an error. gzip body. Returns the server's JSON, or None on 204."""
        raise NotImplementedError

    def close(self) -> None:
        raise NotImplementedError
