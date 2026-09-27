"""Spec for `cleave init` in a repository that already has its own Bob config (task07).

The demo repository, edish-github/galaxium-travels, tracks .bob/ with its own modes file,
MCP servers (playwright, context7) and lifecycle hooks. `cleave init` must add Cleave's
mode, server and hooks without removing theirs, be safe to run twice, and leave a working
tree that atomize still accepts: files Cleave manages (.bob/, .cleave/) never make the
tree count as dirty, while any other uncommitted change still does.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from cleave.atomize import atomize
from cleave.cli import main
from cleave.mcp_server import TOOL_NAMES

from .conftest import BASE_FILES, HEAD_FILES, RENAMES, FixtureRepo, git, make_repo

EXISTING_MCP = {"mcpServers": {"playwright": {"command": "npx", "args": ["-y", "@playwright/mcp@latest"]}}}
EXISTING_SETTINGS = {
    "hooks": {
        "PreToolUse": [
            {"matcher": "^execute_command$", "hooks": [{"type": "command", "command": "sh .bob/hooks/gate-commit.sh", "timeout": 60}]}
        ],
        "PostToolUse": [{"hooks": [{"type": "command", "command": "sh .bob/hooks/record-tool.sh", "timeout": 10}]}],
    }
}
EXISTING_MODES = "# customModes:\n#   - slug: code-reviewer\n#     name: Code Reviewer\n"
EXISTING_GITIGNORE = "__pycache__/\n.bob/hooks/state/\n"


@pytest.fixture
def bob_repo(tmp_path: Path) -> FixtureRepo:
    """The fixture PR in a repository whose base and head both track a .bob/ of their own."""
    own = {
        ".bob/mcp.json": json.dumps(EXISTING_MCP, indent=2) + "\n",
        ".bob/settings.json": json.dumps(EXISTING_SETTINGS, indent=2) + "\n",
        ".bob/custom_modes.yaml": EXISTING_MODES,
        ".gitignore": EXISTING_GITIGNORE,
    }
    return make_repo(tmp_path / "galaxium", {**BASE_FILES, **own}, HEAD_FILES, RENAMES)


def _init(repo: FixtureRepo) -> None:
    assert main(["-C", str(repo.path), "init", "--check", "pytest -q", "--workdir", "."]) == 0


def _read(repo: FixtureRepo, rel: str) -> str:
    return (repo.path / rel).read_text()


def _commands(entries: list[dict]) -> list[str]:
    return [hook["command"] for entry in entries for hook in entry["hooks"]]


def test_existing_mcp_servers_stay_and_cleave_is_added(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    servers = json.loads(_read(bob_repo, ".bob/mcp.json"))["mcpServers"]
    assert servers["playwright"] == EXISTING_MCP["mcpServers"]["playwright"]
    cleave = servers["cleave"]
    # A bare "cleave" or the absolute path of the cleave that ran init (GUI apps on macOS
    # don't inherit the shell's PATH, so an absolute path is the safer choice).
    assert Path(cleave["command"]).name == "cleave"
    # Bob may start MCP servers outside the repository, so the installed entry names it.
    assert cleave["args"] in (["mcp"], ["mcp", "--repo", str(bob_repo.path.resolve())])
    assert sorted(cleave["alwaysAllow"]) == sorted(TOOL_NAMES)


def test_guard_and_audit_hooks_are_added_after_the_existing_ones(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    hooks = json.loads(_read(bob_repo, ".bob/settings.json"))["hooks"]
    pre, post = _commands(hooks["PreToolUse"]), _commands(hooks["PostToolUse"])
    assert pre[0] == "sh .bob/hooks/gate-commit.sh" and any("hooks/guard.py" in c for c in pre)
    assert post[0] == "sh .bob/hooks/record-tool.sh" and any("hooks/audit.py" in c for c in post)
    guard_entry = next(e for e in hooks["PreToolUse"] if any("hooks/guard.py" in h["command"] for h in e["hooks"]))
    assert "matcher" not in guard_entry, "the guard must see every tool; a matcher is a regex on the tool name"


def test_the_cleave_mode_is_added_and_the_old_text_is_kept(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    text = _read(bob_repo, ".bob/custom_modes.yaml")
    assert "slug: code-reviewer" in text
    assert "\n    slug: cleave" in text or "\n  - slug: cleave" in text
    groups = next(line for line in text.splitlines() if line.strip().startswith("groups:") and not line.lstrip().startswith("#"))
    assert "mcp" in groups and "edit" not in groups and "execute" not in groups
    assert (bob_repo.path / ".bob" / "hooks" / "guard.py").exists()
    assert (bob_repo.path / ".bob" / "rules-cleave").is_dir()


def test_running_init_twice_changes_nothing(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    files = [p for p in (bob_repo.path / ".bob").rglob("*") if p.is_file()] + [bob_repo.path / ".cleave" / "config.toml"]
    first = {p: p.read_bytes() for p in files}
    _init(bob_repo)
    assert {p: p.read_bytes() for p in files} == first


def test_tracked_gitignore_is_left_alone_and_runs_are_still_ignored(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    assert _read(bob_repo, ".gitignore") == EXISTING_GITIGNORE
    run_file = bob_repo.path / ".cleave" / "runs" / "20260927-060000-abc123" / "report.json"
    run_file.parent.mkdir(parents=True)
    run_file.write_text("{}")
    git(bob_repo.path, "check-ignore", "-q", str(run_file.relative_to(bob_repo.path)))


def test_atomize_accepts_a_tree_changed_only_by_cleave(bob_repo: FixtureRepo) -> None:
    _init(bob_repo)
    assert atomize(bob_repo.path, bob_repo.base, bob_repo.head).atoms
    (bob_repo.path / "app" / "models.py").write_text("# an uncommitted edit\n")
    with pytest.raises(ValueError):
        atomize(bob_repo.path, bob_repo.base, bob_repo.head)


def test_a_check_command_with_quotes_round_trips(bob_repo: FixtureRepo) -> None:
    from cleave.config import load_config

    check = 'python -m pytest -q --deselect "tests/test_utils.py::test_pager[test5]" -k \'not slow\''
    assert main(["-C", str(bob_repo.path), "init", "--check", check]) == 0
    assert load_config(bob_repo.path).check_command == check
