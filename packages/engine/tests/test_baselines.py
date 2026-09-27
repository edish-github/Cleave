"""Spec for baselines.py and `cleave eval baseline` (task09).

A B1 stack is a list of branches b1/1 … b1/k that Bob made in Agent mode. The engine
measures it with Cleave's own five checks and writes a normal run directory, so it pushes
as a `baseline_b1` run. Each spec builds a tiny library whose change adds `mul` to
lib/calc.py, a new lib/fmt.py and their tests, then arranges the branches a B1 run could
produce.

    uv run pytest -q tests/test_baselines.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from cleave.baselines import branch_list, measure_baseline
from cleave.cli import main
from cleave.config import RunConfig
from cleave.models import Plan, Report
from cleave.push import load_bundle

from .conftest import FixtureRepo, git, make_repo

CALC = "def add(a, b):\n    return a + b\n"
CALC_HEAD = CALC + "\n\ndef mul(a, b):\n    return a * b\n"
FMT = "from lib.calc import add\n\n\ndef total(a, b):\n    return f'{add(a, b)}'\n"
TEST_CALC = "from lib.calc import add\n\n\ndef test_add():\n    assert add(2, 3) == 5\n"
TEST_CALC_HEAD = (
    "from lib.calc import add, mul\n\n\ndef test_add():\n    assert add(2, 3) == 5\n\n\ndef test_mul():\n    assert mul(2, 3) == 6\n"
)
TEST_FMT = "from lib.fmt import total\n\n\ndef test_total():\n    assert total(2, 3) == '5'\n"

BASE = {"conftest.py": "", "lib/__init__.py": "", "lib/calc.py": CALC, "tests/test_calc.py": TEST_CALC}
HEAD = {"lib/calc.py": CALC_HEAD, "lib/fmt.py": FMT, "tests/test_calc.py": TEST_CALC_HEAD, "tests/test_fmt.py": TEST_FMT}
CODE = {"lib/calc.py": CALC_HEAD, "lib/fmt.py": FMT}
TESTS = {"tests/test_calc.py": TEST_CALC_HEAD, "tests/test_fmt.py": TEST_FMT}
CONFIG = RunConfig(check_command=f"{sys.executable} -m pytest -q -p no:cacheprovider", parallel=2)


@pytest.fixture
def lib(tmp_path: Path) -> FixtureRepo:
    repo = make_repo(tmp_path / "lib", BASE, HEAD)
    git(repo.path, "branch", "feature", repo.head)
    git(repo.path, "checkout", "-q", "--detach", repo.base)
    git(repo.path, "branch", "-f", "main", repo.base)
    return repo


def branch(repo: FixtureRepo, name: str, parent: str, files: dict[str, str], message: str) -> str:
    """Commit ``files`` on top of ``parent`` as branch ``name`` with plumbing only."""
    import os
    import subprocess
    import tempfile

    fd, index = tempfile.mkstemp()
    os.close(fd)
    os.unlink(index)
    env = {**os.environ, "GIT_INDEX_FILE": index}

    def run(*args: str, input: str | None = None) -> str:
        return subprocess.run(["git", "-C", str(repo.path), *args], env=env, input=input, capture_output=True, text=True, check=True).stdout.strip()

    try:
        run("read-tree", parent)
        for path, text in files.items():
            blob = run("hash-object", "-w", "--stdin", input=text)
            run("update-index", "--add", "--cacheinfo", f"100644,{blob},{path}")
        tree = run("write-tree")
        commit = run("commit-tree", tree, "-p", parent, "-m", message)
    finally:
        Path(index).unlink(missing_ok=True)
    git(repo.path, "update-ref", f"refs/heads/{name}", commit)
    return commit


def checks(report: Report) -> dict[str, tuple[str, str]]:
    return {c.id: (c.status, c.value) for c in report.checks}


def measure(repo: FixtureRepo, branches: list[str]) -> tuple[Report, Path]:
    run = measure_baseline(repo.path, "main", "feature", branches, CONFIG)
    return Report.model_validate_json(run.report.read_text()), run.path


def test_a_perfect_two_branch_stack_is_verified(lib: FixtureRepo) -> None:
    head_before, status_before = git(lib.path, "rev-parse", "HEAD"), lib.status()
    first = branch(lib, "b1/1", lib.base, CODE, "Add mul and total")
    branch(lib, "b1/2", first, TESTS, "Test mul and total")

    report, path = measure(lib, ["b1/1", "b1/2"])

    assert report.status == "verified", checks(report)
    assert all(status == "pass" for status, _ in checks(report).values())
    assert report.foreign_lines == 0 and report.top_tree == report.head_tree
    assert [(layer.branch, layer.status, layer.tests_passed) for layer in report.layers] == [("b1/1", "pass", 1), ("b1/2", "pass", 3)]
    code, tests = report.layers
    assert set(code.files) == {"lib/calc.py", "lib/fmt.py"} and set(tests.files) == set(TESTS)
    atoms = json.loads((path / "atoms.json").read_text())["atoms"]
    assert sorted(code.atoms + tests.atoms) == sorted(a["id"] for a in atoms)
    assert all(a["file"].startswith("lib/") for a in atoms if a["id"] in code.atoms)
    plan = Plan.model_validate_json((path / "plan.v0.json").read_text())
    assert plan.author == "engine" and [layer.atoms for layer in plan.layers] == [code.atoms, tests.atoms]
    events = [json.loads(line)["type"] for line in (path / "events.ndjson").read_text().splitlines()]
    assert events[0] == "run.started" and events[-1] == "run.finished"
    assert events.count("layer.passed") == 2
    # Plumbing and temporary worktrees only.
    assert git(lib.path, "rev-parse", "HEAD") == head_before
    assert [line for line in lib.status().splitlines() if ".cleave/" not in line] == [
        line for line in status_before.splitlines() if ".cleave/" not in line
    ]
    assert "worktree" not in git(lib.path, "worktree", "list").split("\n", 1)[-1]


def test_code_the_change_does_not_have_is_foreign(lib: FixtureRepo) -> None:
    first = branch(lib, "b1/1", lib.base, CODE, "Add mul and total")
    branch(lib, "b1/2", first, {**TESTS, "lib/calc.py": CALC_HEAD + "\n\ndef div(a, b):\n    return a / b\n"}, "Tests, and div")

    report, _ = measure(lib, ["b1/1", "b1/2"])

    assert report.status == "review"
    assert report.foreign_lines == 4
    assert checks(report)["fidelity"] == ("attention", "Differs")
    assert checks(report)["partition"] == ("attention", "4 lines")
    assert checks(report)["shippability"] == ("pass", "2 / 2")


def test_a_red_branch_fails_shippability_and_tests_first_break_the_order(lib: FixtureRepo) -> None:
    first = branch(lib, "b1/1", lib.base, TESTS, "Tests first")
    branch(lib, "b1/2", first, CODE, "Then the code")

    report, _ = measure(lib, ["b1/1", "b1/2"])

    assert [layer.status for layer in report.layers] == ["fail", "pass"]
    assert checks(report)["shippability"] == ("attention", "1 / 2")
    assert checks(report)["coverage"][0] == "pass" and checks(report)["fidelity"][0] == "pass"
    assert report.layers[0].tests_failed and report.layers[0].tests_failed > 0
    assert report.rounds[0].results[0].failure is not None
    assert checks(report)["order"][0] == "attention", "the tests' layer comes before the code they call"


def test_part_of_the_change_left_out_is_coverage_not_foreign_code(lib: FixtureRepo) -> None:
    branch(lib, "b1/1", lib.base, {"lib/calc.py": CALC_HEAD, "tests/test_calc.py": TEST_CALC_HEAD}, "Only mul")

    report, path = measure(lib, ["b1/1"])

    status, value = checks(report)["coverage"]
    covered, total = (int(n) for n in value.split(" / "))
    assert status == "attention" and 0 < covered < total
    assert report.foreign_lines == 0 and checks(report)["partition"][0] == "pass"
    assert checks(report)["fidelity"][0] == "attention"
    plan = Plan.model_validate_json((path / "plan.v0.json").read_text())
    assert {v.kind for v in plan.violations} == {"missing_atom"}
    assert len(plan.violations) == total - covered


def test_branches_that_do_not_stack_fail_the_order(lib: FixtureRepo) -> None:
    branch(lib, "b1/1", lib.base, CODE, "Code")
    branch(lib, "b1/2", lib.base, {**CODE, **TESTS}, "Everything again, from main")

    report, _ = measure(lib, ["b1/1", "b1/2"])

    status, _ = checks(report)["order"]
    detail = next(c.detail for c in report.checks if c.id == "order")
    assert status == "attention" and "1 of 2 branches build on the previous one" in detail


def test_the_run_pushes_as_a_baseline(lib: FixtureRepo) -> None:
    first = branch(lib, "b1/1", lib.base, CODE, "Add mul and total")
    branch(lib, "b1/2", first, TESTS, "Test mul and total")
    run = measure_baseline(lib.path, "main", "feature", ["b1/1", "b1/2"], CONFIG)

    bundle = load_bundle(run, repo_full="edish-github/lib", title="B1", run_kind="baseline_b1")

    assert bundle.run_kind == "baseline_b1" and bundle.report.status == "verified"
    assert len(bundle.plans) == 1 and bundle.events


def test_branch_globs_sort_naturally(lib: FixtureRepo) -> None:
    for n in (1, 2, 10):
        branch(lib, f"b1/{n}", lib.base, CODE, f"step {n}")
    assert branch_list(lib.path, "b1/*") == ["b1/1", "b1/2", "b1/10"]


def test_the_cli_measures_and_prints_the_checks(lib: FixtureRepo, capsys: pytest.CaptureFixture[str]) -> None:
    first = branch(lib, "b1/1", lib.base, CODE, "Add mul and total")
    branch(lib, "b1/2", first, TESTS, "Test mul and total")

    code = main(["-C", str(lib.path), "eval", "baseline", "--base", "main", "--head", "feature", "--branches", "b1/*", "--check", CONFIG.check_command])

    out = capsys.readouterr().out
    assert code == 0 and ": verified · 2 branches (b1/1, b1/2)" in out
    assert "partition" in out and "0 lines" in out


def test_no_branches_or_nothing_covered_is_refused(lib: FixtureRepo) -> None:
    with pytest.raises(ValueError):
        measure_baseline(lib.path, "main", "feature", [], CONFIG)
    branch(lib, "b1/1", lib.base, {"README.md": "unrelated\n"}, "Unrelated")
    with pytest.raises(ValueError, match="none of the change"):
        measure_baseline(lib.path, "main", "feature", ["b1/1"], CONFIG)
    assert not (lib.path / ".cleave" / "runs").exists() or not any((lib.path / ".cleave" / "runs").iterdir())
