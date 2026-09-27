"""Spec for mcp_server.py: Bob's only write surface.

Eleven tools. None of them can change a tracked file: a whole session leaves the
working tree untouched except for .cleave/.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
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


# --- what the Activity tab and the proof read -----------------------------------


def _event_types(repo: FixtureRepo, run_id: str) -> list[str]:
    path = repo.path / ".cleave" / "runs" / run_id / "events.ndjson"
    return [json.loads(line)["type"] for line in path.read_text().splitlines()]


def test_a_session_leaves_engine_events_not_just_tool_calls(repo: FixtureRepo) -> None:
    server, ids = _session(repo)
    run_id = call(server, "cleave_status")["run_id"]
    call(server, "cleave_propose_plan", layers=[{"name": "First", "atoms": ids[:1]}, {"name": "Rest", "atoms": ids[1:]}])
    call(server, "cleave_move_atoms", ids=ids[:1], to_layer=2, reason="Fold the first atom into the rest")
    call(server, "cleave_describe_layer", n=1, title="Everything", body="All of it.")
    types = _event_types(repo, run_id)
    for expected in ("run.started", "atoms.cut", "graph.built", "slices.written", "plan.proposed", "atoms.moved", "layer.described"):
        assert expected in types, f"{expected} missing from {types}"


def test_tool_arguments_are_nested_so_they_never_read_as_event_text(repo: FixtureRepo) -> None:
    server, _ = _session(repo)
    run_id = call(server, "cleave_status")["run_id"]
    call(server, "cleave_describe_layer", n=1, title="A title", body="A body")
    path = repo.path / ".cleave" / "runs" / run_id / "events.ndjson"
    calls = [json.loads(line) for line in path.read_text().splitlines() if json.loads(line)["type"] == "mcp.called"]
    assert calls and all(set(e["payload"]) <= {"arguments"} for e in calls)


def test_a_refused_start_leaves_no_active_run(repo: FixtureRepo) -> None:
    (repo.path / "app" / "service.py").write_text("# an uncommitted edit\n")
    server = create_server(repo.path)
    with pytest.raises(Exception):
        call(server, "cleave_start", base=repo.base, head=repo.head)
    assert not (repo.path / ".cleave" / "active").exists()


def test_the_run_id_comes_from_the_runner_when_it_sets_one(repo: FixtureRepo, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLEAVE_RUN_ID", "20260927-101500-abc123")
    server = create_server(repo.path)
    assert call(server, "cleave_start", base=repo.base, head=repo.head)["run_id"] == "20260927-101500-abc123"


def test_foreign_lines_are_measured_not_assumed(repo: FixtureRepo) -> None:
    server, ids = _session(repo)
    call(server, "cleave_propose_plan", layers=[{"name": "Everything", "atoms": ids}])
    result = call(server, "cleave_verify")
    if result["status"] == "pending":
        call(server, "cleave_verify_status", round=result["round"])
    report_path = Path(call(server, "cleave_finish")["report_path"])
    report = json.loads(report_path.read_text())
    partition = next(c for c in report["checks"] if c["id"] == "partition")
    assert report["foreign_lines"] == 0 and partition["status"] == "pass"
    # The measurement itself: a tree that differs from the head counts its differing lines.
    from cleave.build import foreign_lines
    from cleave.models import AtomsFile

    atoms = AtomsFile.model_validate_json((report_path.parent / "atoms.json").read_text())
    assert foreign_lines(repo.path, atoms, repo.tree(repo.base)) > 0


def test_a_long_round_answers_pending_and_finishes_in_the_background(repo: FixtureRepo, monkeypatch: pytest.MonkeyPatch) -> None:
    import time

    import cleave.mcp_server as mcp_server

    server, ids = _session(repo)
    call(server, "cleave_propose_plan", layers=[{"name": "Everything", "atoms": ids}])
    monkeypatch.setattr(mcp_server, "VERIFY_PENDING_AFTER_S", 0)
    first = call(server, "cleave_verify")
    assert first["status"] in ("pending", "pass")
    deadline = time.time() + 60
    result = first
    while result["status"] == "pending" and time.time() < deadline:
        time.sleep(0.2)
        result = call(server, "cleave_verify_status", round=first["round"])
    assert result["status"] == "pass" and result["round"] == first["round"] == 1


def test_a_base_that_moved_on_is_split_like_a_pull_request(repo: FixtureRepo) -> None:
    """main gains a commit after the branch was cut: the split must not revert it."""
    git(repo.path, "branch", "feature", repo.head)
    git(repo.path, "checkout", "-q", "-b", "trunk", repo.base)
    (repo.path / "CHANGELOG.md").write_text("later on trunk\n")
    git(repo.path, "add", "CHANGELOG.md")
    git(repo.path, "commit", "-q", "-m", "trunk moves on")
    server = create_server(repo.path)
    started = call(server, "cleave_start", base="trunk", head="feature")
    atoms = call(server, "cleave_atoms")
    atoms = atoms["atoms"] if isinstance(atoms, dict) else atoms
    assert started["atoms"] == len(atoms) and all(a["file"] != "CHANGELOG.md" for a in atoms)
    run = repo.path / ".cleave" / "runs" / started["run_id"] / "atoms.json"
    assert json.loads(run.read_text())["base_sha"] == repo.base
