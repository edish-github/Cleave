"""The Cleave MCP server: Bob's only write surface.

Eleven tools, served over stdio by ``cleave mcp``. None of them can change source files:
the ones that write touch ``.cleave/`` or build ``cleave/*`` branches from existing hunks.
Every call is logged as an ``mcp.called`` event.

Spec: tests/test_mcp.py. The names below must match bob_config/mcp.json ``alwaysAllow``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from .atomize import atomize
from .build import build_stack, prefix_trees
from .config import load_config
from .events import EventLog
from .graph import build_graph
from .models import (
    AtomsFile,
    Graph,
    HookCounts,
    Label,
    Plan,
    PlanLayer,
    Round,
    dump,
)
from .plan import PlanStore
from .report import make_report, write_report
from .runs import RunDir, active_run, new_run_id, set_active
from .slices import write_slices
from .verify import verify

TOOL_NAMES: tuple[str, ...] = (
    "cleave_start",
    "cleave_status",
    "cleave_atoms",
    "cleave_graph",
    "cleave_propose_plan",
    "cleave_move_atoms",
    "cleave_verify",
    "cleave_verify_status",
    "cleave_read_log",
    "cleave_describe_layer",
    "cleave_finish",
)

VERIFY_PENDING_AFTER_S = 50
"""MCP calls time out after about a minute in Bob; a longer verify returns ``pending``."""


def create_server(repo: Path) -> FastMCP:
    """Return a FastMCP server bound to ``repo`` with exactly the tools in ``TOOL_NAMES``."""
    server = FastMCP("cleave")

    @server.tool(
        name="cleave_start",
        description="Atomize diff, build dependency graph, write explore slices and initialize a new Cleave run.",
    )
    def cleave_start(base: str, head: str) -> dict[str, Any]:
        run_id = new_run_id()
        run = RunDir(repo, run_id).create()
        set_active(repo, run_id)

        atoms = atomize(repo, base, head)
        run.atoms.write_text(json.dumps(dump(atoms), indent=2))

        graph = build_graph(repo, atoms)
        run.graph.write_text(json.dumps(dump(graph), indent=2))

        slices = write_slices(run, atoms, graph)

        log = EventLog(run.events, run_id)
        log.emit(
            source="mcp",
            type_="mcp.called",
            tool="cleave_start",
            payload={"base": base, "head": head, "atoms": len(atoms.atoms)},
        )

        return {
            "run_id": run_id,
            "atoms": len(atoms.atoms),
            "files": len({a.file for a in atoms.atoms}),
            "slices": [str(s) for s in slices],
        }

    @server.tool(
        name="cleave_status",
        description="Return atom count, active run id, current plan version and last verification result.",
    )
    def cleave_status() -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            return {
                "run_id": None,
                "atoms": 0,
                "plan_version": None,
                "last_round": None,
                "last_result": None,
            }

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_status", payload={})

        atom_count = 0
        if run.atoms.exists():
            atoms = AtomsFile.model_validate_json(run.atoms.read_text())
            atom_count = len(atoms.atoms)

        versions = run.plan_versions()
        plan_version = versions[-1] if versions else None

        last_round = None
        last_result = None
        rounds_file = run.path / "rounds.json"
        if rounds_file.exists():
            rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())]
            if rounds:
                last_round = rounds[-1].round
                last_result = "pass" if all(r.status == "pass" for r in rounds[-1].results) else "fail"

        return {
            "run_id": run.run_id,
            "atoms": atom_count,
            "plan_version": plan_version,
            "last_round": last_round,
            "last_result": last_result,
        }

    @server.tool(
        name="cleave_atoms",
        description="List all diff atoms or atoms belonging to a specific slice, with lines and symbols.",
    )
    def cleave_atoms(slice: int | str | None = None) -> list[dict[str, Any]]:
        run = active_run(repo)
        if not run or not run.atoms.exists():
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_atoms", payload={"slice": slice})

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        selected = atoms.atoms
        if slice is not None:
            slice_name = f"{slice}.md" if not str(slice).endswith(".md") else str(slice)
            slice_file = run.slices / slice_name
            if slice_file.exists():
                import re

                ids = set(re.findall(r"Atom `([0-9a-f]{12})`", slice_file.read_text()))
                selected = [a for a in atoms.atoms if a.id in ids]

        return [
            {
                "id": a.id,
                "file": a.file,
                "kind": a.kind,
                "added": a.added,
                "removed": a.removed,
                "symbols": a.symbols.model_dump() if a.symbols else None,
            }
            for a in selected
        ]

    @server.tool(
        name="cleave_graph",
        description="Return dependency graph edges and forced groups, optionally filtered by atom id.",
    )
    def cleave_graph(atom_id: str | None = None) -> dict[str, Any]:
        run = active_run(repo)
        if not run or not run.graph.exists():
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_graph", payload={"atom_id": atom_id})

        graph = Graph.model_validate_json(run.graph.read_text())
        if atom_id:
            edges = [e for e in graph.edges if e.from_ == atom_id or e.to == atom_id]
            groups = [g for g in graph.groups if atom_id in g]
        else:
            edges = graph.edges
            groups = graph.groups

        return {"edges": [dump(e) for e in edges], "groups": groups}

    @server.tool(
        name="cleave_propose_plan",
        description="Propose a full stack plan, validate constraints and order, and save a new plan version.",
    )
    def cleave_propose_plan(layers: list[dict[str, Any]], labels: dict[str, Any] | None = None) -> dict[str, Any]:
        run = active_run(repo)
        if not run or not run.atoms.exists():
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_propose_plan", payload={"layers": layers})

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        graph = Graph.model_validate_json(run.graph.read_text())
        config = load_config(repo)
        store = PlanStore(run, atoms, graph, max_layer_lines=config.max_layer_lines)

        plan_layers = [
            PlanLayer(name=l["name"], rationale=l.get("rationale"), atoms=l.get("atoms", [])) for l in layers
        ]
        parsed_labels = None
        if labels:
            parsed_labels = {}
            for k, v in labels.items():
                if isinstance(v, dict):
                    parsed_labels[k] = Label(concern=v.get("concern", ""), intent=v.get("intent", ""))
                elif isinstance(v, str):
                    parsed_labels[k] = Label(concern=v, intent="")

        plan = store.propose(plan_layers, labels=parsed_labels, author="bob")
        return {"version": plan.version, "violations": [dump(v) for v in plan.violations]}

    @server.tool(
        name="cleave_move_atoms",
        description="Move specified atoms into target layer, saving the next plan version and violations.",
    )
    def cleave_move_atoms(ids: list[str], to_layer: int, reason: str) -> dict[str, Any]:
        run = active_run(repo)
        if not run or not run.atoms.exists():
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(
            source="mcp",
            type_="mcp.called",
            tool="cleave_move_atoms",
            payload={"ids": ids, "to_layer": to_layer, "reason": reason},
        )

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        graph = Graph.model_validate_json(run.graph.read_text())
        config = load_config(repo)
        store = PlanStore(run, atoms, graph, max_layer_lines=config.max_layer_lines)

        plan = store.move_atoms(ids, to_layer, reason)
        return {"version": plan.version, "violations": [dump(v) for v in plan.violations]}

    @server.tool(
        name="cleave_verify",
        description="Build every prefix and run the check command across all layers in parallel.",
    )
    def cleave_verify() -> dict[str, Any]:
        run = active_run(repo)
        if not run or not run.atoms.exists():
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_verify", payload={})

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        config = load_config(repo)
        versions = run.plan_versions()
        if not versions:
            raise ValueError("No plan found to verify")
        plan = Plan.model_validate_json(run.plan(versions[-1]).read_text())

        rounds_file = run.path / "rounds.json"
        existing_rounds: list[Round] = []
        if rounds_file.exists():
            existing_rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())]

        round_num = len(existing_rounds) + 1
        round_res = verify(
            repo=repo, atoms=atoms, plan=plan, config=config, run=run, round_=round_num, log=log
        )
        existing_rounds.append(round_res)
        rounds_file.write_text(json.dumps([dump(r) for r in existing_rounds], indent=2))

        # Build stack branches cleave/<slug>/...
        build_stack(repo, atoms, plan, run.run_id)

        trees = prefix_trees(repo, atoms, plan)
        top_tree_matches = bool(trees and trees[-1] == atoms.head_tree)
        status = "pass" if all(r.status == "pass" for r in round_res.results) else "fail"

        return {
            "round": round_num,
            "status": status,
            "layers": [dump(r) for r in round_res.results],
            "top_tree_matches": top_tree_matches,
        }

    @server.tool(
        name="cleave_verify_status",
        description="Check status of a running or completed verification round.",
    )
    def cleave_verify_status(round: int) -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_verify_status", payload={"round": round})

        rounds_file = run.path / "rounds.json"
        if rounds_file.exists():
            existing_rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())]
            target_round = next((r for r in existing_rounds if r.round == round), None)
            if target_round:
                atoms = AtomsFile.model_validate_json(run.atoms.read_text())
                plan = Plan.model_validate_json(run.plan(target_round.plan_version).read_text())
                trees = prefix_trees(repo, atoms, plan)
                top_tree_matches = bool(trees and trees[-1] == atoms.head_tree)
                status = "pass" if all(r.status == "pass" for r in target_round.results) else "fail"
                return {
                    "round": target_round.round,
                    "status": status,
                    "layers": [dump(r) for r in target_round.results],
                    "top_tree_matches": top_tree_matches,
                }

        return {"round": round, "status": "pending", "layers": [], "top_tree_matches": False}

    @server.tool(
        name="cleave_read_log",
        description="Read failing test output and log excerpt for a layer from a verification round.",
    )
    def cleave_read_log(layer: int, round: int | None = None) -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_read_log", payload={"layer": layer, "round": round})

        rounds_file = run.path / "rounds.json"
        round_num = round
        failure = None
        if rounds_file.exists():
            existing_rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())]
            if round_num is None and existing_rounds:
                round_num = existing_rounds[-1].round
            if existing_rounds and round_num is not None:
                rnd = next((r for r in existing_rounds if r.round == round_num), None)
                if rnd:
                    res = next((r for r in rnd.results if r.layer == layer), None)
                    if res and res.failure:
                        failure = dump(res.failure)

        round_num = round_num or 1
        log_path = run.check_log(round_num, layer)
        excerpt = log_path.read_text()[-4000:] if log_path.exists() else ""
        return {"excerpt": excerpt, "failure": failure}

    @server.tool(
        name="cleave_describe_layer",
        description="Store PR title and description body for layer n of the active stack plan.",
    )
    def cleave_describe_layer(n: int, title: str, body: str) -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(
            source="mcp",
            type_="mcp.called",
            tool="cleave_describe_layer",
            payload={"n": n, "title": title, "body": body},
        )

        desc_path = run.path / "descriptions.json"
        descriptions: dict[str, Any] = {}
        if desc_path.exists():
            try:
                descriptions = json.loads(desc_path.read_text())
            except Exception:
                pass

        descriptions[str(n)] = {"title": title, "body": body}
        desc_path.write_text(json.dumps(descriptions, indent=2))
        return {"ok": True}

    @server.tool(
        name="cleave_finish",
        description="Assemble the final report, write report.json and report.md, and close the run.",
    )
    def cleave_finish() -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_finish", payload={})

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        graph = Graph.model_validate_json(run.graph.read_text())
        config = load_config(repo)
        versions = run.plan_versions()
        if not versions:
            raise ValueError("No plan found to finish")
        plan = Plan.model_validate_json(run.plan(versions[-1]).read_text())

        # Update layer names and rationales if descriptions were provided
        desc_path = run.path / "descriptions.json"
        if desc_path.exists():
            try:
                descriptions = json.loads(desc_path.read_text())
                for idx, layer in enumerate(plan.layers, start=1):
                    if str(idx) in descriptions:
                        d = descriptions[str(idx)]
                        if d.get("title"):
                            layer.name = d["title"]
                        if d.get("body"):
                            layer.rationale = d["body"]
            except Exception:
                pass

        rounds_file = run.path / "rounds.json"
        rounds: list[Round] = []
        if rounds_file.exists():
            rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())]

        built = build_stack(repo, atoms, plan, run.run_id)
        trees = prefix_trees(repo, atoms, plan)
        top_tree = trees[-1] if trees else None

        events = log.read()
        hook_allowed = sum(1 for e in events if e.type == "hook.allowed")
        hook_blocked = sum(1 for e in events if e.type == "hook.blocked")
        hook_counts = HookCounts(allowed=hook_allowed, blocked=hook_blocked)

        started_at = events[0].ts if events else datetime.now(timezone.utc)
        finished_at = datetime.now(timezone.utc)

        report = make_report(
            run_id=run.run_id,
            atoms=atoms,
            graph=graph,
            plan=plan,
            rounds=rounds,
            config=config,
            built=built,
            top_tree=top_tree,
            foreign_lines=0,
            started_at=started_at,
            finished_at=finished_at,
            hook=hook_counts,
        )
        report_path = write_report(run, report)

        set_active(repo, None)
        log.emit(source="mcp", type_="run.completed", payload={"status": report.status, "run_id": run.run_id})

        return {"status": report.status, "report_path": str(report_path)}

    return server


def main() -> None:
    """Entry point for ``cleave mcp``: serve ``create_server(Path.cwd())`` over stdio."""
    create_server(Path.cwd()).run()
