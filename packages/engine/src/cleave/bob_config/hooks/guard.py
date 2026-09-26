#!/usr/bin/env python3
"""Bob PreToolUse guard hook for Cleave mode.

While .cleave/active exists, allows only read tools, explore subagents, todo updates,
and calls to the cleave MCP server. Exits 2 on anything else and logs hook.blocked.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

READ_TOOLS = {
    "read_file",
    "list_files",
    "search_files",
    "view_file",
    "list_dir",
    "grep_search",
    "find_files",
    "fetch_web_page",
    "web_search",
}

TODO_TOOLS = {
    "update_todo_list",
    "todo",
    "create_todo",
}

SUBAGENT_TOOLS = {
    "subagent",
    "spawn_subagent",
    "explore",
}


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except Exception:
        sys.exit(0)

    # Allow everything if there is no active Cleave run
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

    is_allowed = False
    if tool in READ_TOOLS:
        is_allowed = True
    elif tool in TODO_TOOLS:
        is_allowed = True
    elif tool in SUBAGENT_TOOLS:
        is_allowed = True
    elif tool == "use_mcp_tool":
        server_name = args.get("server_name")
        if server_name == "cleave":
            is_allowed = True
    elif tool.startswith("cleave_"):
        is_allowed = True

    if not is_allowed:
        # Log blocked event to active run's events.ndjson
        events_file = Path.cwd() / ".cleave" / "runs" / run_id / "events.ndjson"
        event = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "source": "hook",
            "type": "hook.blocked",
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

        print(
            f"Cleave: write tool '{tool}' is blocked while a ✂ Cleave run is active. "
            "Cleave only allows reads and cleave_* tools.",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
