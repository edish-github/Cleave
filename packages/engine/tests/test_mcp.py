"""Spec for mcp_server.py: Bob's only write surface.

Eleven tools. None of them can change a tracked file: a whole session leaves the
working tree untouched except for .cleave/.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from cleave.mcp_server import TOOL_NAMES, create_server

from .conftest import BOB_CONFIG, FixtureRepo, git


def call(server: Any, name: str, **arguments: Any) -> Any:
    """Call a tool the way Bob does and return its JSON result."""
    out = asyncio.run(server.call_tool(name, arguments))
    if isinstance(out, dict):
        return out.get("result", out)
    if isinstance(out, tuple):
        content, structured = out
        if structured:
            return structured.get("result", structured)
        out = content
    return json.loads(out[0].text)


def test_eleven_uniquely_named_tools() -> None:
    assert len(TOOL_NAMES) == 11
    assert len(set(TOOL_NAMES)) == 11
    assert all(name.startswith("cleave_") for name in TOOL_NAMES)


def test_server_exposes_exactly_these_tools_with_descriptions(repo: FixtureRepo) -> None:
    tools = asyncio.run(create_server(repo.path).list_tools())
    assert sorted(t.name for t in tools) == sorted(TOOL_NAMES)
    assert all(t.description and len(t.description) > 20 for t in tools)


def test_shipped_mcp_json_allows_exactly_these_tools() -> None:
    config = json.loads((BOB_CONFIG / "mcp.json").read_text())
    server = config["mcpServers"]["cleave"]
    assert (server["command"], server["args"]) == ("cleave", ["mcp"])
    assert sorted(server["alwaysAllow"]) == sorted(TOOL_NAMES)


def test_shipped_mode_cannot_edit_or_execute() -> None:
    text = (BOB_CONFIG / "custom_modes.yaml").read_text()
    assert "slug: cleave" in text
    groups_line = next(line for line in text.splitlines() if line.strip().startswith("groups:"))
    assert "edit" not in groups_line and "execute" not in groups_line
    assert "mcp" in groups_line


def _session(repo: FixtureRepo) -> tuple[Any, list[str]]:
    server = create_server(repo.path)
    started = call(server, "cleave_start", base=repo.base, head=repo.head)
    assert started["run_id"]
    atoms = call(server, "cleave_atoms")
    atoms = atoms["atoms"] if isinstance(atoms, dict) else atoms
    return server, [a["id"] for a in atoms]


def test_propose_and_move_return_versions_and_violations(repo: FixtureRepo) -> None:
    server, ids = _session(repo)
    proposed = call(server, "cleave_propose_plan", layers=[{"name": "Everything", "rationale": "One layer", "atoms": ids}])
    assert (proposed["version"], proposed["violations"]) == (0, [])
    proposed = call(server, "cleave_propose_plan", layers=[{"name": "First", "atoms": ids[:1]}, {"name": "Rest", "atoms": ids[1:]}])
    moved = call(server, "cleave_move_atoms", ids=ids[:1], to_layer=2, reason="Fold the first atom into the rest")
    assert moved["version"] == proposed["version"] + 1


def test_moving_an_unknown_atom_is_refused(repo: FixtureRepo) -> None:
    server, ids = _session(repo)
    call(server, "cleave_propose_plan", layers=[{"name": "Everything", "atoms": ids}])
    with pytest.raises(Exception):
        call(server, "cleave_move_atoms", ids=["ffffffffffff"], to_layer=1, reason="nope")


def test_a_full_session_leaves_tracked_files_untouched(repo: FixtureRepo) -> None:
    head_before = git(repo.path, "rev-parse", "HEAD")
    refs_before = {r for r in git(repo.path, "for-each-ref", "--format=%(refname)").splitlines() if not r.startswith("refs/heads/cleave/")}
    server, ids = _session(repo)
    call(server, "cleave_propose_plan", layers=[{"name": "Everything", "atoms": ids}])
    result = call(server, "cleave_verify")
    if result["status"] == "pending":
        result = call(server, "cleave_verify_status", round=result["round"])
    assert result["status"] == "pass"
    assert result["top_tree_matches"] is True
    call(server, "cleave_describe_layer", n=1, title="Everything", body="The whole change in one layer.")
    finished = call(server, "cleave_finish")
    assert finished["status"] == "verified"

    changed = [line[3:] for line in repo.status().splitlines()]
    assert all(path.startswith(".cleave/") for path in changed), changed
    assert git(repo.path, "rev-parse", "HEAD") == head_before
    refs_after = {r for r in git(repo.path, "for-each-ref", "--format=%(refname)").splitlines() if not r.startswith("refs/heads/cleave/")}
    assert refs_after == refs_before
    assert not (repo.path / ".cleave" / "active").exists()
