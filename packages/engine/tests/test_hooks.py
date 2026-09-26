"""Spec for bob_config/hooks: the second lock on writes, and the audit trail.

The guard reads Bob's PreToolUse payload on stdin. While .cleave/active exists it lets
through read tools, todo updates and calls to the cleave MCP server, and exits 2 on
anything else. Bob's docs and its 2.0.2 runtime disagree on field names, so both shapes
are accepted. Real captured payloads go in tests/payloads/ (open check C1).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from cleave.models import Event

from .conftest import BOB_CONFIG

GUARD = BOB_CONFIG / "hooks" / "guard.py"
AUDIT = BOB_CONFIG / "hooks" / "audit.py"
PAYLOADS = Path(__file__).parent / "payloads"
RUN_ID = "20260927-060000-abc123"


def payload(event: str, tool: str, args: dict, shape: str) -> dict:
    if shape == "documented":
        return {"event": event, "tool": tool, "input": args}
    return {"hook_event_name": event, "tool_name": tool, "tool_input": args}


def run(script: Path, cwd: Path, data: dict) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(script)], input=json.dumps(data), cwd=cwd, capture_output=True, text=True, timeout=20)


@pytest.fixture
def active(tmp_path: Path) -> Path:
    (tmp_path / ".cleave" / "runs" / RUN_ID).mkdir(parents=True)
    (tmp_path / ".cleave" / "active").write_text(RUN_ID + "\n")
    return tmp_path


SHAPES = ["documented", "runtime"]
BLOCKED = [
    ("write_to_file", {"path": "app/models.py", "content": "x = 1\n"}),
    ("apply_diff", {"path": "app/models.py", "diff": "<<<<<<< SEARCH\n=======\n>>>>>>> REPLACE"}),
    ("insert_content", {"path": "app/models.py", "line": 1, "content": "x"}),
    ("execute_command", {"command": "git commit -am sneaky"}),
    ("use_mcp_tool", {"server_name": "github", "tool_name": "create_or_update_file", "arguments": {}}),
]
ALLOWED = [
    ("read_file", {"path": "app/models.py"}),
    ("list_files", {"path": "."}),
    ("search_files", {"path": ".", "regex": "Tier"}),
    ("update_todo_list", {"todos": "[ ] propose"}),
    ("use_mcp_tool", {"server_name": "cleave", "tool_name": "cleave_status", "arguments": {}}),
]


@pytest.mark.parametrize("shape", SHAPES)
def test_without_an_active_run_everything_is_allowed(tmp_path: Path, shape: str) -> None:
    result = run(GUARD, tmp_path, payload("PreToolUse", "write_to_file", {"path": "a.py", "content": ""}, shape))
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize("shape", SHAPES)
@pytest.mark.parametrize(("tool", "args"), BLOCKED, ids=[t for t, _ in BLOCKED])
def test_writes_commands_and_other_servers_are_blocked(active: Path, shape: str, tool: str, args: dict) -> None:
    result = run(GUARD, active, payload("PreToolUse", tool, args, shape))
    assert result.returncode == 2
    assert "Cleave" in result.stderr


@pytest.mark.parametrize("shape", SHAPES)
@pytest.mark.parametrize(("tool", "args"), ALLOWED, ids=[f"{t}-{a.get('server_name', '')}" for t, a in ALLOWED])
def test_reads_todos_and_cleave_tools_are_allowed(active: Path, shape: str, tool: str, args: dict) -> None:
    result = run(GUARD, active, payload("PreToolUse", tool, args, shape))
    assert result.returncode == 0, result.stderr


def _events(root: Path) -> list[Event]:
    path = root / ".cleave" / "runs" / RUN_ID / "events.ndjson"
    return [Event.model_validate_json(line) for line in path.read_text().splitlines()]


def test_blocks_are_logged_as_hook_blocked(active: Path) -> None:
    run(GUARD, active, payload("PreToolUse", "write_to_file", {"path": "app/x.py", "content": ""}, "runtime"))
    (event,) = _events(active)
    assert (event.source, event.type, event.tool) == ("hook", "hook.blocked", "write_to_file")


@pytest.mark.parametrize("shape", SHAPES)
def test_audit_logs_every_completed_call(active: Path, shape: str) -> None:
    result = run(AUDIT, active, payload("PostToolUse", "read_file", {"path": "app/models.py"}, shape))
    assert result.returncode == 0
    (event,) = _events(active)
    assert (event.source, event.type, event.tool, event.run_id) == ("hook", "hook.allowed", "read_file", RUN_ID)


def test_audit_is_silent_without_an_active_run(tmp_path: Path) -> None:
    result = run(AUDIT, tmp_path, payload("PostToolUse", "read_file", {"path": "x"}, "runtime"))
    assert result.returncode == 0
    assert not (tmp_path / ".cleave").exists()


def _captured() -> list[Path]:
    return sorted(PAYLOADS.glob("*.json"))


@pytest.mark.bob
@pytest.mark.skipif(not _captured(), reason="No captured Bob payloads yet (open check C1)")
@pytest.mark.parametrize("path", _captured(), ids=lambda p: p.stem)
def test_real_bob_payloads(active: Path, path: Path) -> None:
    """Each file: {"payload": <what Bob sent>, "expect": "allow" | "block"}."""
    case = json.loads(path.read_text())
    result = run(GUARD, active, case["payload"])
    assert result.returncode == (0 if case["expect"] == "allow" else 2), result.stderr
