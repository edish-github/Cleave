"""Spec for report.py: five checks, in order, and the run status they imply."""

from __future__ import annotations

from datetime import datetime, timezone

from cleave.build import BuiltLayer
from cleave.config import RunConfig
from cleave.models import Atom, AtomsFile, CheckResult, Edge, Graph, Issue, Plan, PlanLayer, Resolution, Round
from cleave.report import make_report, render_markdown

A, B = "aaaaaaaaaaaa", "bbbbbbbbbbbb"
HEAD_TREE = "3" * 40
NOW = datetime(2026, 9, 27, 4, 0, tzinfo=timezone.utc)
ATOMS = AtomsFile(
    base_sha="1" * 40,
    head_sha="2" * 40,
    head_tree=HEAD_TREE,
    atoms=[
        Atom(id=A, file="app/models.py", kind="hunk", added=8, removed=1, patch="@@ -1 +1 @@\n-x\n+y\n", is_test=False),
        Atom(id=B, file="tests/test_models.py", kind="new_file", added=20, removed=0, patch="@@ -0,0 +1 @@\n+z\n", is_test=True),
    ],
)
GRAPH = Graph(edges=[Edge(**{"from": B, "to": A, "kind": "import"})])
PLAN = Plan(version=1, author="bob", layers=[PlanLayer(name="Models", atoms=[A]), PlanLayer(name="Tests", atoms=[B])])
BUILT = [
    BuiltLayer(index=1, name="Models", tree="4" * 40, commit="5" * 40, branch="cleave/x/1-models"),
    BuiltLayer(index=2, name="Tests", tree=HEAD_TREE, commit="6" * 40, branch="cleave/x/2-tests"),
]


def _round(*statuses: str) -> Round:
    return Round(
        round=1,
        plan_version=1,
        results=[
            CheckResult(layer=i, status=s, duration_ms=1200, tests_passed=10, tests_failed=0 if s == "pass" else 1)  # type: ignore[arg-type]
            for i, s in enumerate(statuses, start=1)
        ],
    )


def _report(rounds: list[Round], top_tree: str = HEAD_TREE, **kw):
    return make_report(
        run_id="20260927-040000-abc123",
        atoms=ATOMS,
        graph=GRAPH,
        plan=PLAN,
        rounds=rounds,
        config=RunConfig(),
        built=BUILT,
        top_tree=top_tree,
        foreign_lines=0 if top_tree == HEAD_TREE else 7,
        started_at=NOW,
        finished_at=NOW,
        **kw,
    )


def test_verified_run_has_five_passing_checks_in_order() -> None:
    report = _report([_round("pass", "pass")])
    assert [c.id for c in report.checks] == ["coverage", "order", "fidelity", "shippability", "partition"]
    assert {c.status for c in report.checks} == {"pass"}
    assert report.status == "verified"
    values = {c.id: c.value for c in report.checks}
    assert values == {"coverage": "2 / 2", "order": "1 / 1", "fidelity": "Identical", "shippability": "2 / 2", "partition": "0 lines"}


def test_layers_carry_branch_tree_and_last_round_results() -> None:
    report = _report([_round("pass", "pass")])
    first = report.layers[0]
    assert (first.index, first.name, first.branch, first.tree_sha, first.commit_sha) == (1, "Models", "cleave/x/1-models", "4" * 40, "5" * 40)
    assert (first.added, first.removed, first.files) == (8, 1, ["app/models.py"])
    assert (first.status, first.tests_passed, first.duration_ms) == ("pass", 10, 1200)


def test_failing_layer_after_repairs_means_review() -> None:
    issue = Issue(layer=1, test="t", expected="e", found="f", explanation="x", resolution=Resolution(into=1, **{"from": 2}, name="Both"))
    report = _report([_round("fail", "pass")], issue=issue)
    checks = {c.id: c for c in report.checks}
    assert report.status == "review"
    assert checks["shippability"].status == "attention"
    assert checks["shippability"].value == "1 / 2"
    assert report.layers[0].status == "fail"


def test_top_tree_mismatch_fails_fidelity_and_the_run() -> None:
    report = _report([_round("pass", "pass")], top_tree="9" * 40)
    checks = {c.id: c for c in report.checks}
    assert checks["fidelity"].status == "attention"
    assert checks["partition"].status == "attention"
    assert report.status == "failed"


def test_markdown_names_every_check_and_layer() -> None:
    md = render_markdown(_report([_round("pass", "pass")]))
    for word in ("Atom coverage", "Dependency order", "Tree fidelity", "Layer shippability", "No new code", "Models", "Tests"):
        assert word in md
