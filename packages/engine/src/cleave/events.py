"""Append-only event log (``events.ndjson``) behind the Activity tab.

The engine, the MCP server and the audit hook all write here through ``EventLog``.
One JSON object per line, validated against ``/schemas/event.schema.json``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import Event, EventSource, dump


class EventLog:
    def __init__(self, path: Path, run_id: str | None = None) -> None:
        self.path = path
        self.run_id = run_id

    def emit(self, source: EventSource, type_: str, payload: dict[str, Any] | None = None, tool: str | None = None) -> Event:
        event = Event(
            ts=datetime.now(timezone.utc),
            source=source,
            type=type_,
            run_id=self.run_id,
            tool=tool,
            payload=payload or {},
        )
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(dump(event), separators=(",", ":")) + "\n")
        return event

    def read(self) -> list[Event]:
        if not self.path.exists():
            return []
        return [Event.model_validate_json(line) for line in self.path.read_text().splitlines() if line.strip()]
