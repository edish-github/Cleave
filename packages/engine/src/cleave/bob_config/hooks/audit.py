#!/usr/bin/env python3
"""Bob PostToolUse audit hook for Cleave mode.

Logs every completed tool call to the active run's events.ndjson as hook.allowed.
Remains completely silent if no Cleave run is active.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except Exception:
        sys.exit(0)

    active_marker = Path.cwd() / ".cleave" / "active"
    if not active_marker.exists():
        sys.exit(0)

    run_id = active_marker.read_text().strip()
    if not run_id:
        sys.exit(0)

    tool = data.get("tool") or data.get("tool_name") or ""
    args = data.get("input") if "input" in data else data.get("tool_input", {})
    if not isinstance(args, dict):
        args = {}

    events_file = Path.cwd() / ".cleave" / "runs" / run_id / "events.ndjson"
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": "hook",
        "type": "hook.allowed",
        "run_id": run_id,
        "tool": tool,
        "payload": args,
    }
    try:
        events_file.parent.mkdir(parents=True, exist_ok=True)
        with events_file.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, separators=(",", ":")) + "\n")
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
