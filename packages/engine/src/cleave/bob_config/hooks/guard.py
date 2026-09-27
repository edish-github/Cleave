#!/usr/bin/env python3
"""Bob PreToolUse guard for the ✂ Cleave mode: the second lock on writes.

While .cleave/active exists (a split is running) it lets through read tools, todo
updates, questions to the user, finishing the task, read-only subagents and calls to
the `cleave` MCP server. Anything else exits 2 with a reason for Bob, and is logged
as hook.blocked in the run's events.ndjson. Without an active run it allows everything.

Standard library only, and Python 3.9 compatible: Bob runs it with the system python3.
Bob's docs and runtime disagree on payload field names, so both shapes are read.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

READ_TOOLS = {
    "read_file",
    "read_files",
    "list_files",
    "search_files",
    "list_code_definition_names",
    "codebase_search",
    "fetch_instructions",
    "view_file",
    "list_dir",
    "grep_search",
    "find_files",
}
CONTROL_TOOLS = {"update_todo_list", "todo", "create_todo", "ask_followup_question", "attempt_completion"}
SUBAGENT_TOOLS = {"new_task", "subagent", "spawn_subagent", "run_subagent", "use_subagent", "explore"}
MCP_TOOLS = {"use_mcp_tool", "access_mcp_resource"}
CLEAVE_PREFIXES = ("cleave_", "mcp__cleave__", "cleave__", "cleave.")


def repo_root() -> str:
    try:
        out = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=5)
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except Exception:
        pass
    return os.getcwd()


def read_payload() -> tuple[str, dict]:
    try:
        data = json.loads(sys.stdin.read() or "{}")
    except Exception:
        data = {}
    if not isinstance(data, dict):
        data = {}
    tool = str(data.get("tool") or data.get("tool_name") or "")
    args = data.get("input") if isinstance(data.get("input"), dict) else data.get("tool_input")
    return tool, args if isinstance(args, dict) else {}


def active_run(root: str) -> str | None:
    marker = os.path.join(root, ".cleave", "active")
    try:
        with open(marker, encoding="utf-8") as fh:
            return fh.read().strip() or None
    except OSError:
        return None


def subject(tool: str, args: dict) -> str:
    """The path, command or server behind a call, for the audit trail (never file contents)."""
    for key in ("path", "command", "regex", "query"):
        if isinstance(args.get(key), str):
            return args[key][:200]
    if args.get("server_name"):
        return "{}/{}".format(args.get("server_name"), args.get("tool_name") or args.get("uri") or "")
    return ""


def log_event(root: str, run_id: str, type_: str, tool: str, payload: dict) -> None:
    path = os.path.join(root, ".cleave", "runs", run_id, "events.ndjson")
    event = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "source": "hook",
        "type": type_,
        "run_id": run_id,
        "tool": tool or None,
        "payload": payload,
    }
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, separators=(",", ":")) + "\n")
    except OSError:
        pass


def allowed(tool: str, args: dict) -> bool:
    if tool in READ_TOOLS or tool in CONTROL_TOOLS or tool in SUBAGENT_TOOLS:
        return True
    if tool in MCP_TOOLS:
        return args.get("server_name") == "cleave"
    return tool.startswith(CLEAVE_PREFIXES)


def main() -> None:
    tool, args = read_payload()
    root = repo_root()
    run_id = active_run(root)
    if not run_id or allowed(tool, args):
        sys.exit(0)
    detail = subject(tool, args)
    log_event(root, run_id, "hook.blocked", tool, {"title": "Guard blocked " + (tool or "a tool call"), "detail": detail})
    sys.stderr.write(
        "Cleave: {} is blocked while a ✂ Cleave split is running. The mode only groups and orders "
        "existing hunks; change the plan with cleave_* tools. To end a stuck run: rm .cleave/active\n".format(tool or "this tool")
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
