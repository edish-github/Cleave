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

import gzip
import json
import platform
from typing import Any

import httpx

from .. import __version__
from ..models import Bundle, Event, Job, dump

CLAIM_TIMEOUT_S = 40.0
"""Longer than the server's 25 s long poll."""

EVENTS_PER_REQUEST = 500


class RunnerAuthError(RuntimeError):
    """401: the token is missing, wrong or revoked."""


class JobCancelled(RuntimeError):
    """409: the job isn't running any more (cancelled in the browser, or already finished)."""


class RunnerClient:
    def __init__(
        self, url: str, token: str, transport: httpx.BaseTransport | None = None
    ) -> None:
        """``transport`` lets tests pass ``httpx.MockTransport``."""
        self.url = url.rstrip("/")
        self._http = httpx.Client(
            base_url=self.url,
            headers={
                "Authorization": f"Bearer {token}",
                "User-Agent": f"cleave-runner/{__version__}",
            },
            timeout=httpx.Timeout(30.0),
            transport=transport,
        )

    def _post(
        self,
        path: str,
        *,
        content: bytes = b"",
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> httpx.Response:
        response = self._http.post(
            path,
            content=content,
            headers=headers or {},
            timeout=timeout if timeout is not None else httpx.USE_CLIENT_DEFAULT,
        )
        if response.status_code == 401:
            raise RunnerAuthError(
                f"The web app refused the runner token (401) at {self.url}. Create a new one in Settings → Bob & runners."
            )
        if response.status_code == 409:
            raise JobCancelled(_reason(response) or "The job isn't running any more.")
        if response.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"{path}: {response.status_code} {_reason(response)}",
                request=response.request,
                response=response,
            )
        return response

    def claim(self) -> Job | None:
        """Wait for a job. None when the server answers 204."""
        response = self._post("/api/runner/claim", timeout=CLAIM_TIMEOUT_S)
        if response.status_code == 204 or not response.content:
            return None
        return Job.model_validate(response.json())

    def heartbeat(
        self, job_id: str | None = None, bob_version: str | None = None
    ) -> None:
        """Send runner_version (cleave.__version__), os (platform.system().lower()), bob_version, job_id."""
        body = {
            "runner_version": __version__,
            "os": platform.system().lower() or None,
            "bob_version": bob_version,
            "job_id": job_id,
        }
        self._post(
            "/api/runner/heartbeat",
            content=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )

    def send_events(self, job_id: str, events: list[Event]) -> None:
        """POST as NDJSON (``application/x-ndjson``), in chunks of EVENTS_PER_REQUEST. No request for an empty list."""
        for start in range(0, len(events), EVENTS_PER_REQUEST):
            chunk = events[start : start + EVENTS_PER_REQUEST]
            text = "".join(
                json.dumps(dump(e), separators=(",", ":")) + "\n" for e in chunk
            )
            self._post(
                f"/api/runner/runs/{job_id}/events",
                content=text.encode(),
                headers={"Content-Type": "application/x-ndjson"},
            )

    def complete(
        self, job_id: str, bundle: Bundle | None = None, error: str | None = None
    ) -> dict[str, Any] | None:
        """Succeeded with a bundle, or failed with an error. gzip body. Returns the server's JSON, or None on 204."""
        if bundle is None and not error:
            raise ValueError(
                "complete() needs a bundle (succeeded) or an error (failed)."
            )
        body = (
            {"status": "succeeded", "bundle": dump(bundle), "error": None}
            if bundle is not None
            else {"status": "failed", "bundle": None, "error": error}
        )
        response = self._post(
            f"/api/runner/runs/{job_id}/complete",
            content=gzip.compress(json.dumps(body, separators=(",", ":")).encode()),
            headers={"Content-Type": "application/json", "Content-Encoding": "gzip"},
            timeout=120.0,
        )
        return (
            response.json()
            if response.status_code == 200 and response.content
            else None
        )

    def close(self) -> None:
        self._http.close()


def _reason(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        return response.text[:300]
    return str(data.get("error", "")) if isinstance(data, dict) else ""
