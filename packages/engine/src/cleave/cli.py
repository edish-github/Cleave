"""The ``cleave`` command.

    cleave init      install the ✂ Cleave mode (.bob/) and .cleave/config.toml in a repo
    cleave atomize   cut base..head into atoms and open a run
    cleave graph     build the dependency graph for the active run
    cleave check     check a plan file against coverage and order
    cleave build     build the cleave/* branches for the latest plan
    cleave verify    verify every layer in parallel worktrees
    cleave publish   push branches and open stacked pull requests
    cleave mcp       serve Bob's tools over stdio
    cleave push      send a finished run to the web app
    cleave runner    claim and run jobs from the web app (P1)
    cleave eval      build constructed diffs and run baselines
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from importlib import resources
from pathlib import Path

from . import __version__
from .config import CONFIG_PATH, RunConfig, load_config, render_config
from .models import AtomsFile, BobStats, EvalRef, Graph, Plan, PullRequestRef, dump
from .runs import RunDir, active_run, new_run_id, set_active

GITIGNORE_LINES = (".cleave/runs/", ".cleave/active")


def _run(repo: Path, run_id: str | None) -> RunDir:
    if run_id:
        return RunDir(repo, run_id)
    run = active_run(repo)
    if run:
        return run
    runs = sorted((repo / ".cleave" / "runs").glob("*"))
    if not runs:
        raise SystemExit("No run found. Start one with `cleave atomize BASE HEAD`.")
    return RunDir(repo, runs[-1].name)


def cmd_init(args: argparse.Namespace) -> int:
    repo = Path(args.repo).resolve()
    source = resources.files("cleave") / "bob_config"
    target = repo / ".bob"
    for item in source.iterdir():
        if item.name == "README.md":
            continue
        dest = target / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)  # type: ignore[arg-type]
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(item.read_bytes())
    config = load_config(repo)
    updates = {k: v for k, v in {"check_command": args.check, "setup_command": args.setup, "working_directory": args.workdir}.items() if v}
    config = RunConfig(**{**config.model_dump(), **updates})
    (repo / CONFIG_PATH).parent.mkdir(parents=True, exist_ok=True)
    (repo / CONFIG_PATH).write_text(render_config(config))
    gitignore = repo / ".gitignore"
    existing = gitignore.read_text().splitlines() if gitignore.exists() else []
    missing = [line for line in GITIGNORE_LINES if line not in existing]
    if missing:
        gitignore.write_text("\n".join([*existing, *missing]) + "\n")
    print(f"Installed the Cleave mode in {target} and wrote {CONFIG_PATH}.")
    return 0


def cmd_atomize(args: argparse.Namespace) -> int:
    from .atomize import atomize

    repo = Path(args.repo).resolve()
    run = RunDir(repo, args.run or new_run_id()).create()
    atoms = atomize(repo, args.base, args.head)
    run.atoms.write_text(json.dumps(dump(atoms), indent=2))
    set_active(repo, run.run_id)
    print(json.dumps({"run_id": run.run_id, "atoms": len(atoms.atoms)}))
    return 0


def cmd_graph(args: argparse.Namespace) -> int:
    from .graph import build_graph

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    atoms = AtomsFile.model_validate_json(run.atoms.read_text())
    graph = build_graph(repo, atoms)
    run.graph.write_text(json.dumps(dump(graph), indent=2))
    print(json.dumps({"edges": len(graph.edges), "groups": len(graph.groups)}))
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    from .plan import check_plan

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    atoms = AtomsFile.model_validate_json(run.atoms.read_text())
    graph = Graph.model_validate_json(run.graph.read_text())
    plan = Plan.model_validate_json(Path(args.plan).read_text())
    violations = check_plan(plan, atoms, graph, load_config(repo).max_layer_lines)
    print(json.dumps([dump(v) for v in violations], indent=2))
    return 1 if violations else 0


def cmd_push(args: argparse.Namespace) -> int:
    from .push import encode, load_bundle, push, repo_full_name

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    url = args.url or os.environ.get("CLEAVE_URL")
    token = args.token or os.environ.get("CLEAVE_TOKEN")
    if not args.out and (not url or not token):
        raise SystemExit("Set CLEAVE_URL and CLEAVE_TOKEN (Settings → Bob & runners), or pass --url and --token.")
    pr = (
        PullRequestRef(number=args.pr, head_branch=args.head_branch, base_branch=args.base_branch)
        if args.pr and args.head_branch and args.base_branch
        else None
    )
    bob = BobStats.model_validate_json(Path(args.bob_stats).read_text()) if args.bob_stats else None
    if bool(args.eval_group) != bool(args.dataset):
        raise SystemExit("--eval-group and --dataset go together.")
    eval_ref = (
        EvalRef(
            group=args.eval_group,
            dataset=args.dataset,
            ground_truth=json.loads(Path(args.ground_truth).read_text()) if args.ground_truth else None,
        )
        if args.eval_group
        else None
    )
    bundle = load_bundle(
        run,
        repo_full=args.repo_name or repo_full_name(repo),
        title=args.title,
        source="runner" if args.from_runner else "ide",
        run_kind=args.kind,
        pull_request=pr,
        eval_ref=eval_ref,
        bob=bob,
    )
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(encode(bundle))
        print(f"Wrote {out}")
    if url and token:
        print(json.dumps(push(bundle, url, token), indent=2))
    return 0


def cmd_mcp(_: argparse.Namespace) -> int:
    from .mcp_server import main as serve

    serve()
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    from .build import build_stack

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    atoms = AtomsFile.model_validate_json(run.atoms.read_text())
    plans = sorted(run.path.glob("plan.v*.json"))
    if not plans:
        raise SystemExit("No plan found. Propose one first.")
    plan = Plan.model_validate_json(plans[-1].read_text())
    slug = args.slug or run.run_id
    layers = build_stack(repo, atoms, plan, slug)
    print(
        json.dumps(
            [
                {
                    "index": l.index,
                    "name": l.name,
                    "branch": l.branch,
                    "commit": l.commit,
                    "tree": l.tree,
                }
                for l in layers
            ],
            indent=2,
        )
    )
    return 0


def _not_yet(name: str):
    def run(_: argparse.Namespace) -> int:
        raise SystemExit(f"`cleave {name}` is not implemented yet.")

    return run


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="cleave", description="Split a large pull request into a proven stack.")
    p.add_argument("--version", action="version", version=f"cleave {__version__}")
    p.add_argument("-C", "--repo", default=".", help="Target repository (default: current directory)")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init", help="Install the Cleave mode and config in a repository")
    s.add_argument("--check", help='Check command, e.g. "pytest -q"')
    s.add_argument("--setup", help="Setup command, e.g. \"pip install -r requirements.txt\"")
    s.add_argument("--workdir", help="Directory the commands run in")
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("atomize", help="Cut base..head into atoms and open a run")
    s.add_argument("base")
    s.add_argument("head")
    s.add_argument("--run", help="Run id (default: new)")
    s.set_defaults(func=cmd_atomize)

    s = sub.add_parser("graph", help="Build the dependency graph")
    s.add_argument("--run")
    s.set_defaults(func=cmd_graph)

    s = sub.add_parser("check", help="Check a plan file")
    s.add_argument("plan")
    s.add_argument("--run")
    s.set_defaults(func=cmd_check)

    s = sub.add_parser("build", help="Build cleave/* branches")
    s.add_argument("--run")
    s.add_argument("--slug")
    s.set_defaults(func=cmd_build)

    for name, help_ in (("verify", "Verify every layer"), ("publish", "Open stacked pull requests"), ("runner", "Run jobs from the web app"), ("eval", "Constructed diffs and baselines")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--run")
        s.set_defaults(func=_not_yet(name))

    s = sub.add_parser("mcp", help="Serve the Cleave tools to Bob over stdio")
    s.set_defaults(func=cmd_mcp)

    s = sub.add_parser("push", help="Send a finished run to the web app")
    s.add_argument("--run")
    s.add_argument("--title", required=True, help="Stack title, usually the PR title")
    s.add_argument("--pr", type=int)
    s.add_argument("--head-branch")
    s.add_argument("--base-branch")
    s.add_argument("--repo-name", help="owner/name (default: read from the origin remote)")
    s.add_argument("--kind", default="cleave", choices=["cleave", "baseline_b1"])
    s.add_argument("--bob-stats", help="JSON file with Bob's stats for this run (BobStats)")
    s.add_argument("--eval-group", help="Evaluation group, e.g. constructed (makes the stack public on /results)")
    s.add_argument("--dataset", help="Constructed diff name within the group")
    s.add_argument("--ground-truth", help="JSON file: the original commits' atom grouping")
    s.add_argument("--out", help="Also write the gzip bundle to this file (e.g. eval/runs/<dataset>/cleave.bundle.json.gz)")
    s.add_argument("--from-runner", action="store_true")
    s.add_argument("--url")
    s.add_argument("--token")
    s.set_defaults(func=cmd_push)
    return p


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    return int(args.func(args) or 0)


if __name__ == "__main__":
    sys.exit(main())
