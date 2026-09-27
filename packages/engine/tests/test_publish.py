"""Spec for publish.py and `cleave publish` (task10): the verified stack as pull requests.

`gh` is replaced by a stand-in on PATH that records its arguments and prints a pull request
URL, and `origin` is a local bare repository, so nothing here touches the network.
Stacked PRs (gh-stack) depend on open check C6 and are tried by hand; these specs cover the
chained method every repository supports: layer 1 targets the base branch, layer n the
branch of layer n-1.

    uv run pytest -q -m publish
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import pytest

from cleave.cli import main
from cleave.mcp_server import create_server
from cleave.models import Report
from cleave.publish import publish

from .conftest import FixtureRepo, git
from .test_mcp import call

# Phase 5 spec, part of the default run and CI; -m publish runs it alone.
pytestmark = pytest.mark.publish

FAKE_GH = """#!/bin/sh
printf '%s\\n' "$*" >> "$GH_LOG"
case "$1 $2" in
  "extension list") exit 0 ;;
  "pr create") n=$(grep -c '^pr create' "$GH_LOG"); echo "https://github.com/edish-github/galaxium-travels/pull/$((n + 1))" ;;
esac
"""


@pytest.fixture
def verified(repo: FixtureRepo, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[FixtureRepo, Path, Path]:
    """A finished two-layer run, an `origin` to push to, and a recording `gh`."""
    remote = tmp_path / "origin.git"
    git(tmp_path, "init", "-q", "--bare", str(remote))
    git(repo.path, "remote", "add", "origin", str(remote))
    git(repo.path, "branch", "feature", repo.head)

    server = create_server(repo.path)
    call(server, "cleave_start", base=repo.base, head="feature")
    atoms = call(server, "cleave_atoms")
    atoms = atoms["atoms"] if isinstance(atoms, dict) else atoms
    code = [a["id"] for a in atoms if not a["file"].startswith("tests/")]
    tests = [a["id"] for a in atoms if a["file"].startswith("tests/")]
    call(server, "cleave_propose_plan", layers=[{"name": "Code", "atoms": code}, {"name": "Tests", "atoms": tests}])
    assert call(server, "cleave_verify")["status"] == "pass"
    call(server, "cleave_describe_layer", n=1, title="Loyalty tiers", body="Adds tiers and points.")
    call(server, "cleave_describe_layer", n=2, title="Loyalty tests", body="Tests for tiers and points.")
    report_path = Path(call(server, "cleave_finish")["report_path"])
    assert _report(report_path).status == "verified"

    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    gh = bin_dir / "gh"
    gh.write_text(FAKE_GH)
    gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
    log = tmp_path / "gh.log"
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("GH_LOG", str(log))
    return repo, report_path, log


def _report(path: Path) -> Report:
    return Report.model_validate_json(path.read_text())


def test_every_layer_branch_is_pushed(verified: tuple[FixtureRepo, Path, Path], tmp_path: Path) -> None:
    repo, report_path, _ = verified
    report = _report(report_path)
    publish(repo.path, report, base_branch="main")
    pushed = git(tmp_path / "origin.git", "for-each-ref", "--format=%(refname:short)")
    assert all(layer.branch in pushed.splitlines() for layer in report.layers)


def test_chained_pull_requests_target_the_previous_layer(verified: tuple[FixtureRepo, Path, Path]) -> None:
    repo, report_path, log = verified
    report = _report(report_path)
    result = publish(repo.path, report, base_branch="main", method="chained")
    assert result.method == "chained"
    assert [p.layer for p in result.pull_requests] == [layer.index for layer in report.layers]
    assert result.pull_requests[0].base == "main"
    for prev, pr in zip(report.layers, result.pull_requests[1:]):
        assert pr.base == prev.branch
    creates = [line for line in log.read_text().splitlines() if line.startswith("pr create")]
    assert len(creates) == len(report.layers)
    assert f"--head {report.layers[0].branch}" in creates[0] and "--base main" in creates[0]
    assert "Loyalty tiers" in creates[0]  # the layer's description becomes the pull request's title
    assert result.pull_requests[0].url.endswith(f"/pull/{result.pull_requests[0].number}")


def test_auto_falls_back_to_chained_without_gh_stack(verified: tuple[FixtureRepo, Path, Path]) -> None:
    repo, report_path, _ = verified
    assert publish(repo.path, _report(report_path), base_branch="main").method == "chained"


def test_publishing_never_touches_the_working_tree(verified: tuple[FixtureRepo, Path, Path]) -> None:
    repo, report_path, _ = verified
    head_before, status_before = git(repo.path, "rev-parse", "HEAD"), repo.status()
    publish(repo.path, _report(report_path), base_branch="main")
    assert git(repo.path, "rev-parse", "HEAD") == head_before
    assert repo.status() == status_before


def test_cleave_publish_records_the_pull_requests_in_the_report(verified: tuple[FixtureRepo, Path, Path]) -> None:
    repo, report_path, _ = verified
    assert main(["-C", str(repo.path), "publish", "--base", "main"]) == 0
    report = _report(report_path)
    assert report.publish is not None and len(report.publish.pull_requests) == len(report.layers)
    events = [json.loads(line) for line in (report_path.parent / "events.ndjson").read_text().splitlines()]
    published = [e for e in events if e["type"] == "stack.published"]
    assert published and published[-1]["payload"]["pull_requests"] == len(report.layers)


def test_an_unverified_stack_is_refused(verified: tuple[FixtureRepo, Path, Path]) -> None:
    repo, report_path, log = verified
    report = _report(report_path).model_copy(update={"status": "review"})
    with pytest.raises(ValueError):
        publish(repo.path, report, base_branch="main")
    assert "pr create" not in (log.read_text() if log.exists() else "")


def test_a_rerun_reuses_the_open_pull_requests(verified: tuple[FixtureRepo, Path, Path], tmp_path: Path) -> None:
    """If a first attempt opened the PRs, publishing again finds them instead of failing."""
    repo, report_path, log = verified
    gh = tmp_path / "bin" / "gh"
    gh.write_text(
        FAKE_GH.replace(
            'case "$1 $2" in',
            'case "$1 $2" in\n  "pr list") echo \'[{"number": 7, "url": "https://github.com/o/r/pull/7", "baseRefName": "main"}]\' ;;',
        )
    )
    result = publish(repo.path, _report(report_path), base_branch="main")
    calls = log.read_text().splitlines()
    assert not any(line.startswith("pr create") for line in calls)
    assert [pr.number for pr in result.pull_requests] == [7, 7]
    # Layer 2's PR must target layer 1's branch: its base is corrected.
    assert any(line.startswith("pr edit 7 --base cleave/") for line in calls)
