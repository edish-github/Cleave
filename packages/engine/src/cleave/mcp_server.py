"""The Cleave MCP server: Bob's only write surface.

Eleven tools, served over stdio by ``cleave mcp``. None of them can change source files:
the ones that write touch ``.cleave/`` or build ``cleave/*`` branches from existing hunks.
Every call is logged as an ``mcp.called`` event.

Spec: tests/test_mcp.py. The names below must match bob_config/mcp.json ``alwaysAllow``.
"""

from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

from .atomize import atomize
from .build import build_stack, foreign_lines, prefix_trees, slugify
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
from .gitio import merge_base, resolve_ref

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


def _resolve(repo: Path, ref: str) -> str:
    """A ref as given, else ``origin/<ref>`` (a branch that was fetched but never checked out)."""
    return resolve_ref(repo, ref)


def _slug(events: list[Any], run_id: str) -> str:
    """Branch prefix: the head branch the run was started with, else the run id."""
    started = next((e for e in events if e.type == "run.started"), None)
    head = (started.payload.get("head_branch") if started else None) or ""
    return slugify(head.split("/")[-1] if head and not _looks_like_sha(head) else run_id)


def _looks_like_sha(ref: str) -> bool:
    return len(ref) >= 7 and all(c in "0123456789abcdef" for c in ref.lower())


def repo_root(path: Path) -> Path:
    """The git top level containing ``path`` (Bob may start the server in a subdirectory)."""
    try:
        from .gitio import git

        return Path(git(path, "rev-parse", "--show-toplevel").strip())
    except Exception:
        return path


def create_server(repo: Path) -> FastMCP:
    """Return a FastMCP server bound to ``repo`` with exactly the tools in ``TOOL_NAMES``."""
    server = FastMCP("cleave")
    pending: dict[tuple[str, int], threading.Thread] = {}
    rounds_lock = threading.Lock()

    def _round_result(run: RunDir, round_num: int) -> dict[str, Any]:
        """The round's result once it's written to rounds.json, else ``pending``."""
        rounds_file = run.path / "rounds.json"
        rounds = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())] if rounds_file.exists() else []
        found = next((r for r in rounds if r.round == round_num), None)
        if found is None:
            return {"round": round_num, "status": "pending", "layers": [], "top_tree_matches": False}
        pending.pop((run.run_id, round_num), None)
        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        plan = Plan.model_validate_json(run.plan(found.plan_version).read_text())
        trees = prefix_trees(repo, atoms, plan)
        return {
            "round": found.round,
            "status": "pass" if all(r.status == "pass" for r in found.results) else "fail",
            "layers": [dump(r) for r in found.results],
            "top_tree_matches": bool(trees and trees[-1] == atoms.head_tree),
        }

    @server.tool(
        name="cleave_start",
        description="Atomize diff, build dependency graph, write explore slices and initialize a new Cleave run.",
    )
    def cleave_start(base: str, head: str) -> dict[str, Any]:
        # Everything that can refuse (dirty tree, unknown refs) runs before the run exists,
        # so a failed start never leaves .cleave/active behind to lock the repository.
        # Like a pull request: split what head adds on top of where it branched from base,
        # so commits that landed on base afterwards never show up as reverted changes.
        head_ref = _resolve(repo, head)
        base_ref = merge_base(repo, _resolve(repo, base), head_ref)
        atoms = atomize(repo, base_ref, head_ref)
        graph = build_graph(repo, atoms)

        run_id = new_run_id(repo=repo)
        run = RunDir(repo, run_id).create()
        log = EventLog(run.events, run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_start", payload={"arguments": {"base": base, "head": head}})
        log.emit(source="engine", type_="run.started", payload={"base": base, "head": head, "head_branch": head})
        run.atoms.write_text(json.dumps(dump(atoms), indent=2))
        log.emit(source="engine", type_="atoms.cut", payload={"atoms": len(atoms.atoms), "files": len({a.file for a in atoms.atoms})})
        run.graph.write_text(json.dumps(dump(graph), indent=2))
        log.emit(source="engine", type_="graph.built", payload={"edges": len(graph.edges), "groups": len(graph.groups)})
        slices = write_slices(run, atoms, graph)
        log.emit(source="engine", type_="slices.written", payload={"slices": len(slices)})
        set_active(repo, run_id)

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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_status", payload={"arguments": {}})

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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_atoms", payload={"arguments": {"slice": slice}})

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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_graph", payload={"arguments": {"atom_id": atom_id}})

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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_propose_plan", payload={"arguments": {"layers": layers}})

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
        log.emit(
            source="engine",
            type_="plan.proposed",
            payload={"version": plan.version, "layers": len(plan.layers), "violations": len(plan.violations)},
        )
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
            payload={"arguments": {"ids": ids, "to_layer": to_layer, "reason": reason}},
        )

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        graph = Graph.model_validate_json(run.graph.read_text())
        config = load_config(repo)
        store = PlanStore(run, atoms, graph, max_layer_lines=config.max_layer_lines)

        plan = store.move_atoms(ids, to_layer, reason)
        log.emit(
            source="engine",
            type_="atoms.moved",
            payload={"atoms": ids, "to_layer": to_layer, "reason": reason, "version": plan.version},
        )
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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_verify", payload={"arguments": {}})

        atoms = AtomsFile.model_validate_json(run.atoms.read_text())
        config = load_config(repo)
        versions = run.plan_versions()
        if not versions:
            raise ValueError("No plan found to verify")
        plan = Plan.model_validate_json(run.plan(versions[-1]).read_text())

        rounds_file = run.path / "rounds.json"
        done = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())] if rounds_file.exists() else []
        round_num = len(done) + len([k for k in pending if k[0] == run.run_id]) + 1

        def work() -> None:
            result = verify(repo=repo, atoms=atoms, plan=plan, config=config, run=run, round_=round_num, log=log)
            with rounds_lock:
                current = [Round.model_validate(r) for r in json.loads(rounds_file.read_text())] if rounds_file.exists() else []
                current.append(result)
                rounds_file.write_text(json.dumps([dump(r) for r in current], indent=2))

        # Bob's MCP calls time out after about a minute: run the round in the background and
        # answer "pending" if it isn't done in VERIFY_PENDING_AFTER_S; Bob then polls.
        thread = threading.Thread(target=work, name=f"cleave-verify-{round_num}", daemon=True)
        pending[(run.run_id, round_num)] = thread
        thread.start()
        thread.join(VERIFY_PENDING_AFTER_S)
        return _round_result(run, round_num)

    @server.tool(
        name="cleave_verify_status",
        description="Check status of a running or completed verification round.",
    )
    def cleave_verify_status(round: int) -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_verify_status", payload={"arguments": {"round": round}})

        thread = pending.get((run.run_id, round))
        if thread is not None:
            thread.join(VERIFY_PENDING_AFTER_S)
        return _round_result(run, round)

    @server.tool(
        name="cleave_read_log",
        description="Read failing test output and log excerpt for a layer from a verification round.",
    )
    def cleave_read_log(layer: int, round: int | None = None) -> dict[str, Any]:
        run = active_run(repo)
        if not run:
            raise ValueError("No active run found")

        log = EventLog(run.events, run.run_id)
        log.emit(source="mcp", type_="mcp.called", tool="cleave_read_log", payload={"arguments": {"layer": layer, "round": round}})

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
            payload={"arguments": {"n": n, "title": title, "body": body}},
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
        log.emit(source="engine", type_="layer.described", payload={"layer": n, "title": title})
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
        log.emit(source="mcp", type_="mcp.called", tool="cleave_finish", payload={"arguments": {}})

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

        events = log.read()
        built = build_stack(repo, atoms, plan, _slug(events, run.run_id))
        trees = prefix_trees(repo, atoms, plan)
        top_tree = trees[-1] if trees else None

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
            foreign_lines=foreign_lines(repo, atoms, top_tree) if top_tree else 0,
            started_at=started_at,
            finished_at=finished_at,
            hook=hook_counts,
        )
        report_path = write_report(run, report)

        set_active(repo, None)
        log.emit(source="engine", type_="run.finished", payload={"status": report.status, "run_id": run.run_id})

        return {"status": report.status, "report_path": str(report_path)}

    return server


def main(repo: Path | None = None) -> None:
    """Entry point for ``cleave mcp``: serve the repository over stdio.

    ``cleave mcp --repo <repo>`` (what ``cleave init`` writes into .bob/mcp.json) names it
    explicitly; otherwise the git top level of the current directory.
    """
    create_server(repo_root((repo or Path.cwd()).resolve())).run()
