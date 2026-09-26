"""Where a run lives: ``.cleave/runs/<run_id>/`` in the target repository.

Layout (see the directory map):

    atoms.json · graph.json · report.json · report.md
    plan.v0.json … plan.vN.json
    checks/r<round>-l<layer>.log
    slices/*.md
    events.ndjson

``.cleave/active`` holds the id of the run in progress. The guard hook only locks
Bob down while that file exists.
"""

from __future__ import annotations

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

CLEAVE_DIR = Path(".cleave")
ACTIVE_FILE = CLEAVE_DIR / "active"


def new_run_id(now: datetime | None = None) -> str:
    env_id = os.environ.get("CLEAVE_RUN_ID")
    if env_id:
        return env_id
    now = now or datetime.now(timezone.utc)
    return f"{now:%Y%m%d-%H%M%S}-{secrets.token_hex(3)}"


@dataclass(frozen=True)
class RunDir:
    repo: Path
    run_id: str

    @property
    def path(self) -> Path:
        return self.repo / CLEAVE_DIR / "runs" / self.run_id

    @property
    def atoms(self) -> Path:
        return self.path / "atoms.json"

    @property
    def graph(self) -> Path:
        return self.path / "graph.json"

    @property
    def report(self) -> Path:
        return self.path / "report.json"

    @property
    def report_md(self) -> Path:
        return self.path / "report.md"

    @property
    def events(self) -> Path:
        return self.path / "events.ndjson"

    @property
    def checks(self) -> Path:
        return self.path / "checks"

    @property
    def slices(self) -> Path:
        return self.path / "slices"

    def plan(self, version: int) -> Path:
        return self.path / f"plan.v{version}.json"

    def plan_versions(self) -> list[int]:
        return sorted(int(p.stem.split(".v")[1]) for p in self.path.glob("plan.v*.json"))

    def check_log(self, round_: int, layer: int) -> Path:
        return self.checks / f"r{round_}-l{layer}.log"

    def create(self) -> "RunDir":
        for p in (self.path, self.checks, self.slices):
            p.mkdir(parents=True, exist_ok=True)
        return self


def active_run(repo: Path) -> RunDir | None:
    marker = repo / ACTIVE_FILE
    if not marker.exists():
        return None
    run_id = marker.read_text().strip()
    return RunDir(repo, run_id) if run_id else None


def set_active(repo: Path, run_id: str | None) -> None:
    marker = repo / ACTIVE_FILE
    if run_id is None:
        marker.unlink(missing_ok=True)
        return
    marker.parent.mkdir(parents=True, exist_ok=True)
    marker.write_text(run_id + "\n")
