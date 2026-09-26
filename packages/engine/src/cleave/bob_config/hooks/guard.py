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
    "list_code_definition_names",
    "codebase_search",
    "fetch_instructions",
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

QUESTION_COMPLETION_TOOLS = {
    "ask_followup_question",
    "attempt_completion",
}


def main() -> None:
    try:
        raw = sys.stdin.read()
        if not raw.strip():
            sys.exit(0)
        data = json.loads(raw)
    except Exception:
        sys.exit(0)

    def find_root() -> Path:
        cwd = Path.cwd()
        if (cwd / ".cleave" / "active").exists():
            return cwd
        try:
            import subprocess
            res = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=False)
            if res.returncode == 0 and res.stdout.strip():
                top = Path(res.stdout.strip())
                if (top / ".cleave" / "active").exists():
                    return top
        except Exception:
            pass
        return cwd

    root = find_root()
    active_marker = root / ".cleave" / "active"
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
    elif tool in QUESTION_COMPLETION_TOOLS:
        is_allowed = True
    elif tool in ("use_mcp_tool", "access_mcp_resource"):
        server_name = args.get("server_name")
        if server_name == "cleave":
            is_allowed = True
    elif tool.startswith("cleave_") or tool.startswith("cleave:") or tool.startswith("cleave/"):
        is_allowed = True

    if not is_allowed:
        events_file = root / ".cleave" / "runs" / run_id / "events.ndjson"
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
            "The ✂ Cleave mode only moves existing hunks. "
            "Plan changes go through cleave_* tools. 'rm .cleave/active' ends a stuck run.",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
