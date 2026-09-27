"""Spec for cleave.runner: the client side of the runner protocol (task13, P1).

    uv run pytest -q -m runner

The server side is apps/web/src/server/jobs.ts and /api/runner/*. These tests never touch
the network: requests go to an httpx.MockTransport that plays the web app.
"""

from __future__ import annotations

import gzip
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest

from cleave import __version__
from cleave.config import load_config
from cleave.models import Event, Job, JobConfig, JobPullRequest, JobRepo
from cleave.runner import bobshell
from cleave.runner.client import JobCancelled, RunnerAuthError, RunnerClient
from cleave.runner.job import prepare_checkout, run_job

from .conftest import FixtureRepo, git

# Phase 7 (P1) spec, part of the default run and CI; -m runner runs it alone.
pytestmark = pytest.mark.runner

URL = "https://cleave.test"
TOKEN = "clv_" + "t" * 32
NOW = datetime(2026, 9, 27, 10, 15, tzinfo=timezone.utc)


def _job(clone_url: str = "https://github.com/edish-github/galaxium-travels.git", head: str = "feat/loyalty", base: str = "main") -> Job:
    return Job(
        job_id="20260927-101500-abc123",
        repo=JobRepo(full_name="edish-github/galaxium-travels", clone_url=clone_url, default_branch="main"),
        pull_request=JobPullRequest(number=1, head_branch=head, base_branch=base, title="Loyalty tiers"),
        config=JobConfig(
            check_command="pytest -q",
            setup_command="pip install -r requirements.txt",
            working_directory="app",
            max_layer_lines=300,
            max_repair_rounds=2,
            bobcoin_cap=2.5,
        ),
        created_at=NOW,
    )


class FakeServer:
    """Records requests and answers like the web app."""

    def __init__(self, claim: Job | None = None, status: dict[str, int] | None = None) -> None:
        self.claim = claim
        self.status = status or {}
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        forced = next((code for suffix, code in self.status.items() if path.endswith(suffix)), None)
        if forced:
            return httpx.Response(forced, json={"error": f"forced {forced}"})
        if path == "/api/runner/claim":
            if self.claim is None:
                return httpx.Response(204)
            job, self.claim = self.claim, None
            return httpx.Response(200, json=json.loads(job.model_dump_json()))
        if path.endswith("/complete"):
            body = json.loads(_body(request))
            if body["status"] == "failed":
                return httpx.Response(204)
            return httpx.Response(200, json={"stack_id": "galaxium-travels-1", "run_id": body["bundle"]["run_id"]})
        return httpx.Response(204)

    def client(self) -> RunnerClient:
        return RunnerClient(URL, TOKEN, transport=httpx.MockTransport(self.handler))

    def paths(self) -> list[str]:
        return [r.url.path for r in self.requests]


def _body(request: httpx.Request) -> str:
    raw = request.content
    return gzip.decompress(raw).decode() if raw[:2] == b"\x1f\x8b" else raw.decode()


def _event(i: int) -> Event:
    return Event(ts=NOW, source="engine", type="atoms.cut", payload={"i": i})


# --- client ----------------------------------------------------------------


def test_claim_returns_the_job_with_the_runner_token() -> None:
    server = FakeServer(claim=_job())
    job = server.client().claim()
    assert job == _job()
    request = server.requests[0]
    assert request.method == "POST" and request.url.path == "/api/runner/claim"
    assert request.headers["authorization"] == f"Bearer {TOKEN}"


def test_claim_returns_none_when_nothing_is_queued() -> None:
    assert FakeServer().client().claim() is None


def test_a_rejected_token_raises_runner_auth_error() -> None:
    with pytest.raises(RunnerAuthError):
        FakeServer(status={"/claim": 401}).client().claim()


def test_heartbeat_reports_versions_and_the_current_job() -> None:
    server = FakeServer()
    server.client().heartbeat(job_id="20260927-101500-abc123", bob_version="2.0.1")
    body = json.loads(_body(server.requests[0]))
    assert server.paths() == ["/api/runner/heartbeat"]
    assert body["runner_version"] == __version__
    assert body["bob_version"] == "2.0.1"
    assert body["job_id"] == "20260927-101500-abc123"
    assert isinstance(body["os"], str) and body["os"]


def test_events_go_as_ndjson_in_chunks_of_500() -> None:
    server = FakeServer()
    server.client().send_events("job-000001", [_event(i) for i in range(501)])
    assert server.paths() == ["/api/runner/runs/job-000001/events"] * 2
    first = _body(server.requests[0]).strip().split("\n")
    assert len(first) == 500
    assert json.loads(first[0])["type"] == "atoms.cut"
    assert server.requests[0].headers["content-type"].startswith("application/x-ndjson")


def test_no_request_for_no_events() -> None:
    server = FakeServer()
    server.client().send_events("job-000001", [])
    assert server.requests == []


def test_a_cancelled_job_raises_job_cancelled() -> None:
    with pytest.raises(JobCancelled):
        FakeServer(status={"/events": 409}).client().send_events("job-000001", [_event(1)])


def test_failure_is_reported_with_its_reason() -> None:
    server = FakeServer()
    assert server.client().complete("job-000001", error="bob run exited with code 3") is None
    assert json.loads(_body(server.requests[0])) == {"status": "failed", "bundle": None, "error": "bob run exited with code 3"}


def test_complete_needs_a_bundle_or_an_error() -> None:
    with pytest.raises(ValueError):
        FakeServer().client().complete("job-000001")


# --- bob run command -----------------------------------------------------------


def test_bob_command_runs_the_cleave_mode_with_the_cost_cap() -> None:
    job = _job()
    assert bobshell.prompt_for(job) == "Cleave feat/loyalty onto main"
    assert bobshell.command(job) == [
        "bob",
        "run",
        "--mode",
        "cleave",
        "--format",
        "stream-json",
        "--max-cost",
        "2.5",
        "Cleave feat/loyalty onto main",
    ]


# --- one job -------------------------------------------------------------------


@pytest.fixture
def remote(repo: FixtureRepo) -> FixtureRepo:
    """The fixture repo as a remote: main is the head, base-line is the base."""
    git(repo.path, "branch", "-f", "base-line", repo.base)
    return repo


def test_checkout_is_the_head_branch_with_the_mode_and_the_job_config(remote: FixtureRepo, tmp_path: Path) -> None:
    job = _job(clone_url=str(remote.path), head="main", base="base-line")
    checkout = prepare_checkout(job, tmp_path / "work")
    assert git(checkout, "rev-parse", "HEAD") == remote.head
    assert git(checkout, "rev-parse", "origin/base-line") == remote.base
    config = load_config(checkout)
    assert (config.check_command, config.setup_command, config.working_directory) == ("pytest -q", "pip install -r requirements.txt", "app")
    assert (config.max_layer_lines, config.max_repair_rounds, config.bobcoin_cap) == (300, 2, 2.5)
    assert (checkout / ".bob" / "custom_modes.yaml").exists()
    assert (checkout / ".bob" / "mcp.json").exists()
    # The run Bob starts takes the job id even if Bob doesn't pass CLEAVE_RUN_ID to `cleave mcp`.
    assert (checkout / ".cleave" / "run-id").read_text().strip() == job.job_id


def test_a_failing_bob_run_completes_the_job_as_failed(remote: FixtureRepo, tmp_path: Path) -> None:
    server = FakeServer()
    job = _job(clone_url=str(remote.path), head="main", base="base-line")
    stand_in = [sys.executable, "-c", "import sys; print('cap reached', file=sys.stderr); sys.exit(3)"]
    assert run_job(job, server.client(), tmp_path / "work", bob_command=stand_in) == "failed"
    complete = [r for r in server.requests if r.url.path.endswith("/complete")]
    assert len(complete) == 1
    body = json.loads(_body(complete[0]))
    assert body["status"] == "failed"
    assert "exited with code 3" in body["error"] and "cap reached" in body["error"]


def test_a_job_cancelled_in_the_browser_stops_without_completing(remote: FixtureRepo, tmp_path: Path) -> None:
    server = FakeServer(status={"/events": 409, "/heartbeat": 409})
    job = _job(clone_url=str(remote.path), head="main", base="base-line")
    stand_in = [sys.executable, "-c", "import time; time.sleep(30)"]
    assert run_job(job, server.client(), tmp_path / "work", bob_command=stand_in) == "cancelled"
    assert not any(r.url.path.endswith("/complete") for r in server.requests)
