"""End to end on the real demo PR: edish-github/galaxium-travels #1 (loyalty tiers & seat upgrades).

    git clone https://github.com/edish-github/galaxium-travels ~/galaxium-travels
    git -C ~/galaxium-travels fetch origin feat/loyalty-and-seat-upgrades
    GALAXIUM_REPO=~/galaxium-travels uv run pytest -m integration
    GALAXIUM_VERIFY=1 ...   # also run the backend's tests on the rebuilt head (needs its deps)
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from cleave.atomize import atomize
from cleave.build import prefix_trees
from cleave.config import RunConfig
from cleave.graph import build_graph
from cleave.models import Plan, PlanLayer
from cleave.runs import RunDir
from cleave.verify import verify

REPO = os.environ.get("GALAXIUM_REPO")
BASE = "e4e18ae1b05e0c899abaefd920f5ffcb4326b021"
HEAD = "99ab7d49de5258cfa504eea0639dddee901db4d9"

pytestmark = [pytest.mark.integration, pytest.mark.skipif(not REPO, reason="Set GALAXIUM_REPO to a clone of the fork")]


@pytest.fixture(scope="module")
def path() -> Path:
    return Path(REPO or ".").expanduser().resolve()


@pytest.fixture(scope="module")
def atoms(path: Path):
    return atomize(path, BASE, HEAD)


def _tree(path: Path, ref: str) -> str:
    return subprocess.run(["git", "-C", str(path), "rev-parse", f"{ref}^{{tree}}"], capture_output=True, text=True, check=True).stdout.strip()


def test_atoms_cover_the_whole_pull_request(atoms) -> None:
    assert len({a.file for a in atoms.atoms}) == 11
    assert sum(a.added for a in atoms.atoms) == 1032
    assert sum(a.removed for a in atoms.atoms) == 2


def test_one_layer_rebuild_equals_the_head_tree(path: Path, atoms) -> None:
    plan = Plan(version=0, author="engine", layers=[PlanLayer(name="All", atoms=[a.id for a in atoms.atoms])])
    assert prefix_trees(path, atoms, plan)[-1] == _tree(path, HEAD)


def test_graph_links_tests_to_the_services_they_exercise(path: Path, atoms) -> None:
    graph = build_graph(path, atoms)
    by_id = atoms.by_id()
    assert any(by_id[e.from_].is_test and "services/" in by_id[e.to].file for e in graph.edges)


@pytest.mark.skipif(not os.environ.get("GALAXIUM_VERIFY"), reason="Set GALAXIUM_VERIFY=1 to run the backend's tests")
def test_one_layer_stack_passes_the_backend_tests(path: Path, atoms, tmp_path: Path) -> None:
    plan = Plan(version=0, author="engine", layers=[PlanLayer(name="All", atoms=[a.id for a in atoms.atoms])])
    config = RunConfig(check_command="pytest -q", working_directory="booking_system_backend")
    result = verify(path, atoms, plan, config, RunDir(tmp_path, "20260927-060000-abc123").create(), round_=1)
    assert [r.status for r in result.results] == ["pass"]
