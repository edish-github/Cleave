"""models.py and /schemas must describe the same shapes."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

from cleave import models as m

SHA = "a" * 40
A1, A2 = "0123456789ab", "ba9876543210"
NOW = datetime(2026, 9, 27, 3, 0, tzinfo=timezone.utc)


def _registry(schemas: Path) -> tuple[Registry, dict[str, dict]]:
    loaded = {p.name: json.loads(p.read_text()) for p in schemas.glob("*.schema.json")}
    registry = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in loaded.values()])
    return registry, loaded


def _validate(schemas: Path, name: str, instance: dict) -> None:
    registry, loaded = _registry(schemas)
    validator = Draft202012Validator(loaded[name], registry=registry, format_checker=Draft202012Validator.FORMAT_CHECKER)
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
    assert not errors, "\n".join(f"{list(e.path)}: {e.message}" for e in errors)


def _bundle() -> m.Bundle:
    atoms = m.AtomsFile(
        base_sha=SHA,
        head_sha="b" * 40,
        head_tree="c" * 40,
        atoms=[
            m.Atom(id=A1, file="app/models.py", kind="hunk", old_start=3, old_len=0, new_start=4, new_len=4, added=4, removed=0, patch="@@ -3,0 +4,4 @@\n+x\n", is_test=False),
            m.Atom(id=A2, file="app/loyalty.py", kind="new_file", added=6, removed=0, patch="@@ -0,0 +1,6 @@\n+y\n", is_test=False, symbols=m.Symbols(defines=["points_for"], references=["Tier"])),
        ],
    )
    graph = m.Graph(edges=[m.Edge(**{"from": A2, "to": A1, "kind": "import", "symbol": "Tier"})], groups=[])
    plan = m.Plan(version=0, author="bob", layers=[m.PlanLayer(name="Models", atoms=[A1]), m.PlanLayer(name="Loyalty", atoms=[A2])], labels={A1: m.Label(concern="models", intent="Add Tier")})
    checks = [m.Check(id=c, status="pass", value="1", detail="ok") for c in ("coverage", "order", "fidelity", "shippability", "partition")]
    report = m.Report(
        run_id="20260927-030000-abc123",
        status="verified",
        command="pytest -q",
        base_sha=SHA,
        head_sha="b" * 40,
        head_tree="c" * 40,
        top_tree="c" * 40,
        foreign_lines=0,
        plan_version=0,
        checks=checks,
        layers=[m.LayerResult(index=1, name="Models", atoms=[A1], added=4, removed=0, files=["app/models.py"], branch="cleave/x/1-models", status="pass", tests_passed=3)],
        rounds=[m.Round(round=1, plan_version=0, results=[m.CheckResult(layer=1, status="pass", duration_ms=900, tests_passed=3, tests_failed=0)])],
        issue=m.Issue(layer=1, test="t", expected="e", found="f", explanation="x", resolution=m.Resolution(into=1, **{"from": 2}, name="Merged")),
        bob=m.BobStats(surface="ide", mode="✂ Cleave", bobcoins=1.2),
        started_at=NOW,
        finished_at=NOW,
    )
    events = [m.Event(ts=NOW, source="mcp", type="plan.proposed", tool="cleave_propose_plan", payload={"version": 0})]
    return m.Bundle(run_id=report.run_id, source="ide", title="Loyalty tiers", repo=m.RepoRef(full_name="edish-github/galaxium-travels"), created_at=NOW, atoms=atoms, graph=graph, plans=[plan], report=report, events=events)


def test_bundle_dump_validates_against_schema(schemas: Path) -> None:
    _validate(schemas, "bundle.schema.json", m.dump(_bundle()))


@pytest.mark.parametrize(
    ("schema", "model"),
    [
        ("atom.schema.json", m.AtomsFile),
        ("graph.schema.json", m.Graph),
        ("plan.schema.json", m.Plan),
        ("report.schema.json", m.Report),
        ("event.schema.json", m.Event),
        ("bundle.schema.json", m.Bundle),
    ],
)
def test_model_fields_match_schema_properties(schemas: Path, schema: str, model: type[m.BaseModel]) -> None:
    props = set(json.loads((schemas / schema).read_text())["properties"])
    fields = {f.alias or name for name, f in model.model_fields.items()}
    assert fields == props


def test_edge_serializes_from_not_from_underscore() -> None:
    edge = m.Edge(**{"from": A1, "to": A2, "kind": "call"})
    assert m.dump(edge)["from"] == A1
