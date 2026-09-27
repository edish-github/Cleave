# task09 · the B1 baseline, measured by the engine

**Phase 4** (10:00–10:45) · **Budget:** 6 Bobcoins (two B1 runs at ≤ 3 each) · **Evidence:**
`bob_sessions/SsnFall_task09_b1-baseline_summary.png`, `eval/baselines/`, `eval/open-checks.md`

B1 is what Cleave is measured against: one prompt to Bob in Agent mode asking it to split
the PR into stacked branches by itself. The engine then measures that stack with the same
five checks it applies to its own, and pushes it as a `baseline_b1` run so `/results` and
the proof pages show both.

## Part A · brief for Bob (Code mode, Cleave repository)

```
Task 09: measure a baseline stack (B1) with the engine and store it as a run.

Read AGENTS.md §1. A B1 stack is a list of branches b1/1 … b1/k that Bob made in Agent
mode, each on top of the previous one, the first on top of the PR's base.

Change only:
- packages/engine/src/cleave/baselines.py
- packages/engine/src/cleave/cli.py         (`cleave eval baseline`)
- packages/engine/tests/test_baselines.py   (new; write it first)

Implement measure_baseline(repo, base, head, branches, config) -> RunDir that writes a
normal run directory (.cleave/runs/<id>/: atoms.json, graph.json, plan.v0.json,
report.json, events.ndjson) so `cleave push --kind baseline_b1` works unchanged:
1. atoms = atomize(repo, merge_base(base, head), head); graph = build_graph(repo, atoms).
2. For each branch i: the layer's diff is branch_{i-1}..branch_i (branch_0 = the merge
   base); record added/removed/files from `git diff --numstat`, and run the repository's
   setup + check command on branch_i's tree in a temporary worktree (reuse verify's
   helpers: parse_pytest, excerpt, the venv lookup). Layer status pass/fail, tests counts.
3. top_tree = tree of the last branch. foreign_lines = build.foreign_lines(repo, atoms, top_tree).
4. The five checks, with the same ids and wording style as report.py:
   coverage  = atoms whose file has the head's content in top_tree, "<k> / <n>"
   order     = branches that descend from the previous one, "<k> / <k>"
   fidelity  = top_tree == head tree, "Identical" / "Differs"
   shippability = green layers, "<green> / <k>"
   partition = foreign_lines, "<n> lines"
   status "verified" only if all five pass, else "review".
5. plan.v0.json: author "engine", one PlanLayer per branch, atoms = the atoms whose file
   first reaches the head's content at that branch (so coverage is visible per layer).
6. Events: run.started, one layer.passed / layer.failed per branch, run.finished.
7. `cleave eval baseline --base main --head <branch> --branches "b1/*"` (glob, natural
   order) prints the run id and the report summary.

Spec (tests/test_baselines.py, with make_repo): a perfect two-branch stack is verified with
0 foreign lines; a stack whose last branch adds a line that isn't in head has
foreign_lines > 0 and fails fidelity and partition; a branch with a failing test makes
shippability fail; the run directory pushes (load_bundle(..., run_kind="baseline_b1")
validates). The working tree and HEAD are never touched.

Check: uv run pytest -q tests/test_baselines.py && uv run pytest -q
Finish with a summary: files changed, tests passing, anything left undone.
```

## Part B · two real B1 runs on the demo PR (you, with `bob run`)

In `~/galaxium-travels` (on `main`, with the Cleave mode installed from task08):

```bash
PROMPT='Split the change between main and feat/loyalty-and-seat-upgrades into a stack of
branches b1/1, b1/2, … (each branched from the previous one, the first from main). Every
branch must pass `pytest -q` in booking_system_backend on its own, and the last branch must
contain exactly the change of feat/loyalty-and-seat-upgrades. Commit on those branches only;
leave main and feat/loyalty-and-seat-upgrades as they are.'
bob run --mode agent --format stream-json --max-cost 3 "$PROMPT" > ../b1-run1.ndjson
cleave eval baseline --base main --head feat/loyalty-and-seat-upgrades --branches "b1/*"
cleave push --kind baseline_b1 --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main --bob-stats b1-stats.json \
  --out ~/Desktop/Cleave/eval/baselines/b1-run1.bundle.json.gz
git branch -D $(git branch --list 'b1/*')      # clear before run 2, then repeat as b1-run2
```

`b1-stats.json`: `{"surface": "bob_run", "mode": "agent", "bobcoins": <cost from the stream>}`.
Copy each run's report summary into `eval/baselines/b1-run1.json` / `b1-run2.json`.

## Part C · open checks C2, C4, C5, C6 → `eval/open-checks.md`

| Check | How | Record |
| --- | --- | --- |
| C2 | Try to create an Inference API key in the Bob web portal | yes/no; a hosted runner needs it |
| C4 | `bob run --mode cleave --format json "call cleave_status"` in Galaxium; if it fails, `--chat-mode=cleave` | which flag loads the project mode and `.bob/mcp.json` |
| C5 | Look for subagent events in `b1-run1.ndjson` | event names seen, or "none" |
| C6 | `gh extension install github/gh-stack` and one test stack on the fork | stacked or chained for Phase 5 |

C1 and C3 are answered from the task08 run (its step 9).

## Done when

- `uv run pytest -q` is green with `test_baselines.py` in it.
- Two B1 runs are on the deployed app as baseline runs of the demo stack, their bundles and
  stats are in `eval/baselines/`, and `eval/open-checks.md` has C1–C6.

## Commit (you)

`engine: measure B1 baselines as runs (task09)` and `eval: B1 runs and open checks`.
