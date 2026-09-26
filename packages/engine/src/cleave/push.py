"""``cleave push``: send a finished run to the Cleave web app.

Reads ``.cleave/runs/<id>/``, assembles one bundle (``/schemas/bundle.schema.json``) and
POSTs it gzip-encoded to ``<url>/api/ingest/bundle`` with a runner token. The web app
answers with the stack id and the proof URL.
"""

from __future__ import annotations

import gzip
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from .events import EventLog
from .models import AtomsFile, BobStats, Bundle, EvalRef, Graph, Plan, PullRequestRef, RepoRef, Report, dump
from .runs import RunDir

_REMOTE = re.compile(r"github\.com[:/](?P<name>[^/\s]+/[^/\s]+?)(?:\.git)?/?$")


def repo_full_name(repo: Path, remote: str = "origin") -> str:
    """``owner/name`` from the remote URL (https or ssh)."""
    url = subprocess.run(
        ["git", "-C", str(repo), "remote", "get-url", remote], capture_output=True, text=True, check=True
    ).stdout.strip()
    match = _REMOTE.search(url)
    if not match:
        raise ValueError(f"Can't read owner/name from remote URL {url!r}")
    return match.group("name")


def load_bundle(
    run: RunDir,
    *,
    repo_full: str,
    title: str,
    source: str = "ide",
    run_kind: str = "cleave",
    pull_request: PullRequestRef | None = None,
    eval_ref: EvalRef | None = None,
    bob: BobStats | None = None,
) -> Bundle:
    """Assemble and validate the bundle for ``run``. Raises if an artifact is missing or invalid."""
    report = Report.model_validate_json(run.report.read_text())
    if bob is not None:
        report = report.model_copy(update={"bob": bob})
    versions = run.plan_versions()
    if not versions:
        raise FileNotFoundError(f"No plan versions in {run.path}")
    return Bundle(
        run_id=run.run_id,
        source=source,  # type: ignore[arg-type]
        run_kind=run_kind,  # type: ignore[arg-type]
        title=title,
        repo=RepoRef(full_name=repo_full),
        pull_request=pull_request,
        eval=eval_ref,
        created_at=datetime.now(timezone.utc),
        atoms=AtomsFile.model_validate_json(run.atoms.read_text()),
        graph=Graph.model_validate_json(run.graph.read_text()),
        plans=[Plan.model_validate_json(run.plan(v).read_text()) for v in versions],
        report=report,
        events=EventLog(run.events).read(),
    )


def encode(bundle: Bundle) -> bytes:
    return gzip.compress(json.dumps(dump(bundle), separators=(",", ":")).encode("utf-8"))


def push(bundle: Bundle, url: str, token: str, timeout: float = 60.0) -> dict[str, Any]:
    """POST the bundle; return the server's JSON (``stack_id``, ``run_id``, ``proof_url``)."""
    response = httpx.post(
        f"{url.rstrip('/')}/api/ingest/bundle",
        content=encode(bundle),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
        },
        timeout=timeout,
    )
    if response.status_code >= 400:
        try:
            detail = response.json().get("error")
        except ValueError:
            detail = response.text[:500]
        raise RuntimeError(f"Push rejected ({response.status_code}): {detail}")
    return response.json()
