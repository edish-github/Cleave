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
from .models import (
    AtomsFile,
    BobStats,
    EvalRef,
    Graph,
    Plan,
    PullRequestRef,
    Report,
    dump,
)
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
    from typing import Any

    from .mcp_server import TOOL_NAMES

    repo = Path(args.repo).resolve()
    source = resources.files("cleave") / "bob_config"
    target = repo / ".bob"
    target.mkdir(parents=True, exist_ok=True)

    # 1. Copy hooks/ and rules-cleave/
    for folder in ("hooks", "rules-cleave"):
        src_dir = source / folder
        dst_dir = target / folder
        dst_dir.mkdir(parents=True, exist_ok=True)
        for item in src_dir.iterdir():
            if item.is_file():
                (dst_dir / item.name).write_bytes(item.read_bytes())

    # 2. Merge mcp.json
    mcp_file = target / "mcp.json"
    cleave_cmd = shutil.which("cleave") or "cleave"
    cleave_entry = {
        "command": cleave_cmd,
        "args": ["mcp", "--repo", str(repo.resolve())],
        "alwaysAllow": sorted(TOOL_NAMES),
    }
    mcp_data: dict[str, Any] = {}
    if mcp_file.exists():
        try:
            mcp_data = json.loads(mcp_file.read_text())
        except Exception:
            mcp_data = {}
    if not isinstance(mcp_data, dict):
        mcp_data = {}
    if "mcpServers" not in mcp_data or not isinstance(mcp_data["mcpServers"], dict):
        mcp_data["mcpServers"] = {}
    mcp_data["mcpServers"]["cleave"] = cleave_entry
    mcp_file.write_text(json.dumps(mcp_data, indent=2) + "\n")

    # 3. Merge settings.json
    settings_file = target / "settings.json"
    guard_entry = {"hooks": [{"type": "command", "command": "python3 .bob/hooks/guard.py", "timeout": 10}]}
    audit_entry = {"hooks": [{"type": "command", "command": "python3 .bob/hooks/audit.py", "timeout": 10}]}
    settings_data: dict[str, Any] = {}
    if settings_file.exists():
        try:
            settings_data = json.loads(settings_file.read_text())
        except Exception:
            settings_data = {}
    if not isinstance(settings_data, dict):
        settings_data = {}
    if "hooks" not in settings_data or not isinstance(settings_data["hooks"], dict):
        settings_data["hooks"] = {}
    hooks_dict = settings_data["hooks"]
    if "PreToolUse" not in hooks_dict or not isinstance(hooks_dict["PreToolUse"], list):
        hooks_dict["PreToolUse"] = []
    if "PostToolUse" not in hooks_dict or not isinstance(hooks_dict["PostToolUse"], list):
        hooks_dict["PostToolUse"] = []

    has_guard = any(
        any("hooks/guard.py" in h.get("command", "") for h in entry.get("hooks", []))
        for entry in hooks_dict["PreToolUse"]
        if isinstance(entry, dict)
    )
    if not has_guard:
        hooks_dict["PreToolUse"].append(guard_entry)

    has_audit = any(
        any("hooks/audit.py" in h.get("command", "") for h in entry.get("hooks", []))
        for entry in hooks_dict["PostToolUse"]
        if isinstance(entry, dict)
    )
    if not has_audit:
        hooks_dict["PostToolUse"].append(audit_entry)
    settings_file.write_text(json.dumps(settings_data, indent=2) + "\n")

    # 4. Merge custom_modes.yaml
    modes_file = target / "custom_modes.yaml"
    mode_text = (source / "custom_modes.yaml").read_text()
    if not modes_file.exists():
        modes_file.write_text(mode_text)
    else:
        existing_modes = modes_file.read_text()
        if "slug: cleave" not in existing_modes:
            has_active_custom_modes = any(
                line.strip().startswith("customModes:") and not line.lstrip().startswith("#")
                for line in existing_modes.splitlines()
            )
            if has_active_custom_modes:
                cleave_lines = [l for l in mode_text.splitlines() if not l.startswith("customModes:")]
                cleave_block = "\n".join(cleave_lines).strip()
                new_text = existing_modes.rstrip() + "\n  " + cleave_block.lstrip() + "\n"
            else:
                new_text = existing_modes.rstrip() + "\n\n" + mode_text.lstrip()
            modes_file.write_text(new_text)

    # 5. Config
    config = load_config(repo)
    updates = {k: v for k, v in {"check_command": args.check, "setup_command": args.setup, "working_directory": args.workdir}.items() if v}
    config = RunConfig(**{**config.model_dump(), **updates})
    (repo / CONFIG_PATH).parent.mkdir(parents=True, exist_ok=True)
    (repo / CONFIG_PATH).write_text(render_config(config))

    # 6. .cleave/.gitignore (leaves root .gitignore alone)
    cleave_dir = repo / ".cleave"
    cleave_dir.mkdir(parents=True, exist_ok=True)
    cleave_gitignore = cleave_dir / ".gitignore"
    if not cleave_gitignore.exists():
        cleave_gitignore.write_text("runs/\nactive\nrun-id\nbob-*\n")

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


def cmd_mcp(args: argparse.Namespace) -> int:
    from .mcp_server import main as serve

    repo = Path(args.repo).resolve() if getattr(args, "repo", None) else None
    serve(repo)
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


def cmd_verify(args: argparse.Namespace) -> int:
    from .events import EventLog
    from .verify import verify

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    config = load_config(repo)
    atoms = AtomsFile.model_validate_json(run.atoms.read_text())
    plans = run.plan_versions()
    if not plans:
        raise SystemExit("No plan found. Propose one first.")
    plan = Plan.model_validate_json(run.plan(plans[-1]).read_text())

    existing_rounds = set()
    for log_path in run.checks.glob("r*-l*.log"):
        try:
            r = int(log_path.stem.split("-")[0][1:])
            existing_rounds.add(r)
        except Exception:
            pass
    round_ = (max(existing_rounds) + 1) if existing_rounds else 1
    log = EventLog(run.events, run.run_id)
    res = verify(repo, atoms, plan, config, run, round_, log)
    print(json.dumps(dump(res), indent=2))
    return 0 if all(r.status == "pass" for r in res.results) else 1


def cmd_publish(args: argparse.Namespace) -> int:
    from .events import EventLog
    from .publish import publish
    from .report import write_report

    repo = Path(args.repo).resolve()
    run = _run(repo, args.run)
    report = Report.model_validate_json(run.report.read_text())
    result = publish(
        repo, report, base_branch=args.base, remote=args.remote, method=args.method
    )
    write_report(run, report.model_copy(update={"publish": result}))
    EventLog(run.events, run.run_id).emit(
        "engine",
        "stack.published",
        {
            "pull_requests": len(result.pull_requests),
            "method": result.method,
            "urls": [p.url for p in result.pull_requests],
        },
    )
    for pr in result.pull_requests:
        print(f"layer {pr.layer}: #{pr.number} {pr.url} (into {pr.base})")
    print("Run `cleave push` again to show the pull requests on the stack's page.")
    return 0


def _repo_dir(workdir: Path, url: str) -> Path:
    name = url.rstrip("/").rsplit("/", 1)[-1]
    return workdir / (name[:-4] if name.endswith(".git") else name)


def _ensure_commits(repo: Path, shas: list[str]) -> None:
    from .gitio import GitError, git

    for sha in shas:
        try:
            git(repo, "cat-file", "-e", f"{sha}^{{commit}}")
        except GitError:
            git(repo, "fetch", "-q", "origin", sha)


def cmd_eval_build(args: argparse.Namespace) -> int:
    from .eval.build_dataset import build, load_datasets
    from .gitio import git

    datasets_path = Path(args.datasets).resolve()
    out_dir = (
        Path(args.ground_truth_dir).resolve()
        if args.ground_truth_dir
        else datasets_path.parent / "ground_truth"
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    workdir = Path(args.workdir).expanduser().resolve()
    workdir.mkdir(parents=True, exist_ok=True)
    for ds in load_datasets(datasets_path):
        if args.only and ds.name not in args.only:
            continue
        repo = _repo_dir(workdir, ds.repo)
        if not (repo / ".git").exists():
            print(f"cloning {ds.repo} into {repo}")
            git(workdir, "clone", "-q", ds.repo, str(repo))
        _ensure_commits(repo, [ds.base, *ds.commits])
        built = build(repo, ds)
        by_commit: dict[str, int] = {}
        for sha in built.ground_truth.values():
            by_commit[sha] = by_commit.get(sha, 0) + 1
        out = out_dir / f"{ds.name}.json"
        out.write_text(
            json.dumps(
                {
                    "dataset": ds.name,
                    "repo": ds.repo,
                    "base": built.base_sha,
                    "head": built.head_sha,
                    "branch": built.branch,
                    "commits": [git(repo, "rev-parse", c).strip() for c in ds.commits],
                    "atoms": built.ground_truth,
                },
                indent=2,
            )
            + "\n"
        )
        spread = ", ".join(f"{sha[:7]}: {n}" for sha, n in by_commit.items())
        print(
            f"{ds.name}: {built.branch} = {built.head_sha[:12]} in {repo} · {len(built.ground_truth)} atoms ({spread}) → {out}"
        )
    return 0


def _truth(path: str | None) -> dict[str, str] | None:
    if not path:
        return None
    data = json.loads(Path(path).read_text())
    return data.get("atoms", data) if isinstance(data, dict) else None


def cmd_eval_metrics(args: argparse.Namespace) -> int:
    from .eval.metrics import metrics

    run = _run(Path(args.repo).resolve(), args.run)
    if not run.report.exists():
        raise SystemExit(
            f"Run {run.run_id} has no report yet: finish it first (cleave_finish in Bob)."
        )
    report = Report.model_validate_json(run.report.read_text())
    print(json.dumps(metrics(report, _truth(args.ground_truth)).as_dict(), indent=2))
    return 0


def cmd_eval_baseline(args: argparse.Namespace) -> int:
    from .baselines import branch_list, measure_baseline

    repo = Path(args.repo).resolve()
    branches: list[str] = []
    for pattern in args.branches:
        found = (
            branch_list(repo, pattern)
            if any(ch in pattern for ch in "*?[")
            else [pattern]
        )
        branches += [b for b in found if b not in branches]
    if not branches:
        raise SystemExit(f"No local branches match {' '.join(args.branches)}.")
    config = load_config(repo)
    if args.check:
        config = config.model_copy(update={"check_command": args.check})
    run = measure_baseline(
        repo, args.base, args.head, branches, config, run_id=args.run
    )
    report = Report.model_validate_json(run.report.read_text())
    print(
        f"run {run.run_id}: {report.status} · {len(branches)} branches ({', '.join(branches)})"
    )
    for check in report.checks:
        print(f"  {check.id:<13} {check.status:<9} {check.value:<12} {check.detail}")
    for layer in report.layers:
        tests = (
            f"{layer.tests_passed} passed"
            if layer.tests_passed is not None
            else "no test count"
        )
        failed = f", {layer.tests_failed} failed" if layer.tests_failed else ""
        print(
            f"  {layer.index}. {layer.branch}: {layer.status} ({tests}{failed}) +{layer.added} -{layer.removed}, {len(layer.atoms)} atoms"
        )
    print(f"Next: cleave push --run {run.run_id} --kind baseline_b1 --title ...")
    return 0


def cmd_runner(args: argparse.Namespace) -> int:
    from .runner.client import RunnerAuthError, RunnerClient
    from .runner.job import serve

    url = args.url or os.environ.get("CLEAVE_URL")
    token = args.token or os.environ.get("CLEAVE_TOKEN")
    if not url or not token:
        raise SystemExit(
            "Set CLEAVE_URL and CLEAVE_TOKEN (Settings → Bob & runners), or pass --url and --token."
        )
    workdir = Path(args.workdir).expanduser().resolve()
    client = RunnerClient(url, token)
    print(f"Runner for {url}: jobs are cloned into {workdir}. Ctrl-C to stop.")
    try:
        serve(client, workdir, once=args.once, bob=args.bob)
    except RunnerAuthError as e:
        raise SystemExit(str(e)) from e
    except KeyboardInterrupt:
        print("Stopped.")
    finally:
        client.close()
    return 0


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

    s = sub.add_parser("verify", help="Verify every layer")
    s.add_argument("--run")
    s.set_defaults(func=cmd_verify)

    s = sub.add_parser("publish", help="Push the layer branches and open one pull request per layer")
    s.add_argument("--base", required=True, help="Branch the first layer's pull request targets, e.g. main")
    s.add_argument("--run", help="Run id (default: the latest)")
    s.add_argument("--remote", default="origin")
    s.add_argument("--method", default="auto", choices=["auto", "chained", "stacked"])
    s.set_defaults(func=cmd_publish)

    ev = sub.add_parser("eval", help="Constructed diffs, baselines and metrics for /results")
    esub = ev.add_subparsers(dest="eval_command", required=True)
    s = esub.add_parser("build", help="Build every dataset's cleave-eval/<name> branch and its ground truth")
    s.add_argument("--datasets", default="eval/datasets.toml")
    s.add_argument("--workdir", required=True, help="Where the datasets' repositories are (or get cloned)")
    s.add_argument("--only", nargs="*", help="Dataset names to build (default: all)")
    s.add_argument("--ground-truth-dir", help="Default: ground_truth/ next to the datasets file")
    s.set_defaults(func=cmd_eval_build)
    s = esub.add_parser("metrics", help="Print a run's /results metrics")
    s.add_argument("--run", help="Run id (default: the latest)")
    s.add_argument("--ground-truth", help="Ground truth JSON from `cleave eval build`")
    s.set_defaults(func=cmd_eval_metrics)
    s = esub.add_parser("baseline", help="Measure a stack of branches made without Cleave (B1) as a run")
    s.add_argument("--base", required=True, help="The change's base, e.g. main")
    s.add_argument("--head", required=True, help="The change's head, e.g. feat/loyalty-and-seat-upgrades")
    s.add_argument("--branches", required=True, nargs="+", help='The stack, bottom first: a glob ("b1/*", natural order) or names')
    s.add_argument("--check", help="Check command (default: .cleave/config.toml)")
    s.add_argument("--run", help="Run id (default: new)")
    s.set_defaults(func=cmd_eval_baseline)

    s = sub.add_parser("runner", help="Run split jobs queued in the web app with bob run")
    s.add_argument("--workdir", default="~/.cleave/runner", help="Where job checkouts go (default: ~/.cleave/runner)")
    s.add_argument("--once", action="store_true", help="Claim once (waiting up to 25 s), run the job if there is one, then exit")
    s.add_argument("--url", help="Web app URL (default: $CLEAVE_URL)")
    s.add_argument("--token", help="Runner token (default: $CLEAVE_TOKEN)")
    s.add_argument("--bob", default="bob", help="Bob Shell executable (default: bob on PATH)")
    s.set_defaults(func=cmd_runner)

    s = sub.add_parser("mcp", help="Serve the Cleave tools to Bob over stdio")
    s.add_argument("--repo", help="Target repository root (default: current directory)")
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
