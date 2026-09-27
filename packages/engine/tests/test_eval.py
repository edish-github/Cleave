"""Spec for cleave.eval (task11): constructed diffs with ground truth, and the /results metrics.

A constructed diff squashes the changes of 3-5 consecutive real commits, limited to some
paths (e.g. src/ and tests/), into one commit on top of their parent. The ground truth
says which original commit each atom of that diff came from; metrics compare a run's
layers with it. The real datasets live in eval/datasets.toml.

    uv run pytest -q -m eval
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from cleave.atomize import atomize
from cleave.eval.build_dataset import Dataset, build, load_datasets
from cleave.eval.metrics import metrics
from cleave.models import Check, LayerResult, Report

from .conftest import git

# Phase 6 spec, kept out of the default run (and CI) until its task lands.
pytestmark = pytest.mark.eval

NOW = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)


def _commit(repo: Path, files: dict[str, str | None], message: str) -> str:
    for rel, text in files.items():
        path = repo / rel
        if text is None:
            path.unlink()
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", message)
    return git(repo, "rev-parse", "HEAD")


@pytest.fixture
def history(tmp_path: Path) -> tuple[Path, str, list[str]]:
    """base, then: c1 adds tiers, (docs-only commit), c2 adds points + test, c3 edits tiers."""
    repo = tmp_path / "lib"
    repo.mkdir()
    git(repo, "init", "-q", "-b", "main")
    git(repo, "config", "user.email", "eval@cleave.test")
    git(repo, "config", "user.name", "Cleave Eval")
    git(repo, "config", "commit.gpgsign", "false")
    base = _commit(repo, {"src/lib/__init__.py": "", "src/lib/core.py": "def core():\n    return 1\n", "tests/test_core.py": "def test_core():\n    assert True\n", "README.md": "lib\n"}, "base")
    c1 = _commit(repo, {"src/lib/tiers.py": "TIERS = ['silver', 'gold']\n\n\ndef tier(points):\n    return 'gold' if points > 100 else 'silver'\n"}, "add tiers")
    _commit(repo, {"README.md": "lib, now with tiers\n"}, "docs only")
    c2 = _commit(repo, {"src/lib/points.py": "def points(price):\n    return int(price)\n", "tests/test_points.py": "from lib.points import points\n\n\ndef test_points():\n    assert points(3.5) == 3\n"}, "add points")
    c3 = _commit(repo, {"src/lib/tiers.py": "TIERS = ['silver', 'gold', 'platinum']\n\n\ndef tier(points):\n    return 'gold' if points > 100 else 'silver'\n"}, "add platinum")
    return repo, base, [c1, c2, c3]


def _dataset(base: str, commits: list[str]) -> Dataset:
    return Dataset(name="lib-tiers", repo="https://example.test/lib", base=base, commits=commits, paths=["src", "tests"], check="python -m pytest -q")


def test_build_squashes_the_commits_onto_their_parent(history: tuple[Path, str, list[str]]) -> None:
    repo, base, commits = history
    head_before = git(repo, "rev-parse", "HEAD")
    built = build(repo, _dataset(base, commits))
    assert built.branch == "cleave-eval/lib-tiers"
    assert git(repo, "rev-parse", f"{built.branch}^") == base
    assert git(repo, "rev-parse", built.branch) == built.head_sha
    # src/ and tests/ as of the last commit; everything else (README) as of the base.
    assert git(repo, "rev-parse", f"{built.head_sha}:src") == git(repo, "rev-parse", f"{commits[-1]}:src")
    assert git(repo, "show", f"{built.head_sha}:README.md") == "lib"
    assert git(repo, "rev-parse", "HEAD") == head_before  # the working tree and HEAD are untouched


def test_ground_truth_names_the_commit_behind_every_atom(history: tuple[Path, str, list[str]]) -> None:
    repo, base, commits = history
    built = build(repo, _dataset(base, commits))
    atoms = atomize(repo, base, built.head_sha)
    assert set(built.ground_truth) == {a.id for a in atoms.atoms}
    by_file = {a.file: built.ground_truth[a.id] for a in atoms.atoms}
    assert by_file["src/lib/points.py"] == commits[1]
    assert by_file["tests/test_points.py"] == commits[1]
    # tiers.py was added by c1 and edited by c3; as one new-file atom it belongs to c1, where it began.
    assert by_file["src/lib/tiers.py"] == commits[0]


def test_building_twice_gives_the_same_commit(history: tuple[Path, str, list[str]]) -> None:
    repo, base, commits = history
    assert build(repo, _dataset(base, commits)).head_sha == build(repo, _dataset(base, commits)).head_sha


def test_datasets_file_lists_real_windows(tmp_path: Path) -> None:
    datasets = load_datasets(Path(__file__).resolve().parents[3] / "eval" / "datasets.toml")
    assert len(datasets) >= 3
    for ds in datasets:
        assert 3 <= len(ds.commits) <= 5 and len(ds.base) == 40 and all(len(c) == 40 for c in ds.commits)
        assert ds.check


# --- metrics ---------------------------------------------------------------------


def _report(layers: list[tuple[list[str], str, int]], *, foreign: int = 0, top_matches: bool = True) -> Report:
    checks = [Check(id=c, status="pass", value="", detail="") for c in ("coverage", "order", "fidelity", "shippability", "partition")]
    if not top_matches:
        checks[2] = Check(id="fidelity", status="attention", value="Differs", detail="")
    return Report(
        run_id="20260927-120000-abc123",
        status="verified" if all(c.status == "pass" for c in checks) and all(s == "pass" for _, s, _ in layers) else "review",
        command="pytest -q",
        base_sha="a" * 40,
        head_sha="b" * 40,
        head_tree="c" * 40,
        top_tree="c" * 40 if top_matches else "d" * 40,
        foreign_lines=foreign,
        plan_version=0,
        checks=checks,
        layers=[
            LayerResult(index=i, name=f"L{i}", atoms=atoms, added=size, removed=0, files=[], branch=f"cleave/x/{i}", status=status)
            for i, (atoms, status, size) in enumerate(layers, 1)
        ],
        rounds=[],
        started_at=NOW,
        finished_at=NOW,
    )


TRUTH = {"a1": "c1", "a2": "c1", "b1": "c2", "b2": "c2"}


def test_metrics_for_a_stack_that_matches_the_commits() -> None:
    m = metrics(_report([(["a1", "a2"], "pass", 30), (["b1", "b2"], "pass", 50)]), TRUTH)
    assert (m.valid, m.green, m.layers, m.foreign_lines, m.largest_layer) == (True, 2, 2, 0, 50)
    assert m.agreement == 1.0


def test_agreement_is_the_share_of_atom_pairs_grouped_the_same_way() -> None:
    # One layer for everything: of the 6 atom pairs, the 2 same-commit pairs agree, the 4 others don't.
    m = metrics(_report([(["a1", "a2", "b1", "b2"], "pass", 80)]), TRUTH)
    assert m.agreement == pytest.approx(2 / 6)


def test_a_red_layer_or_foreign_code_makes_the_stack_invalid() -> None:
    red = metrics(_report([(["a1", "a2"], "fail", 30), (["b1", "b2"], "pass", 50)]), TRUTH)
    assert (red.valid, red.green) == (False, 1)
    foreign = metrics(_report([(["a1", "a2", "b1", "b2"], "pass", 80)], foreign=37, top_matches=False), None)
    assert (foreign.valid, foreign.foreign_lines, foreign.agreement) == (False, 37, None)
