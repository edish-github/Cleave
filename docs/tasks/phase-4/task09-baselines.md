# task09 · the B1 baseline, measured by the engine

**Phase 4** (10:00–10:45) · **Budget:** 6 Bobcoins (two B1 runs at ≤ 3 each) · **Evidence:**
`bob_sessions/SsnFall_task09_b1-run<n>.ndjson` (the `bob run` stream), `eval/baselines/`,
`eval/open-checks.md`

B1 is what Cleave is measured against: one prompt to Bob in Agent mode asking it to split
the PR into stacked branches by itself. The engine measures that stack with the same five
checks it applies to its own and writes a normal run, so `cleave push --kind baseline_b1`
sends it and `/results` compares the two.

## Part A · the measurement — done (handoff pack)

`cleave eval baseline --base <base> --head <head> --branches "b1/*"` writes
`.cleave/runs/<id>/` (atoms, graph, `plan.v0.json` by the engine, report, events, one check
log per branch) and prints the checks. Spec: `tests/test_baselines.py` (9 cases).

How it reads a stack someone else made:

| Check | Measured as |
| --- | --- |
| coverage | atoms the top branch contains exactly as the head has them (per hunk: `git diff <branch> <head>` doesn't touch the atom's head lines; whole files: identical) |
| order | every branch builds on the previous one, **and** every dependency edge between covered atoms points to the same or an earlier layer |
| fidelity | top branch's tree = head tree |
| shippability | the check command (from `.cleave/config.toml`, or `--check`) passes on each branch, in its own worktree |
| partition | lines the stack adds that the change doesn't add (invented code). Leaving part of the change out is a coverage/fidelity problem, not "new code" |

Each covered atom belongs to the first branch from which it stays in, so the plan and the
Layers tab show what each branch contributed. Status is `verified` only when all five pass.

Checked on real code: Cleave's own 5-layer Galaxium stack measured as a baseline gives the
same result as Cleave's report (15/15, 18/18, identical, 5/5, 0 lines). A file-grouped
3-branch split (services, then models/API, then tests) passes its tests but scores order
12/18: the services layer uses model fields that only arrive in layer 2.

## Part B · two real B1 runs on the demo PR (you, with `bob run`)

In `~/galaxium-travels` (on `main`, with the Cleave mode installed by task08):

```bash
PROMPT='Split the change between main and feat/loyalty-and-seat-upgrades into a stack of
branches b1/1, b1/2, … (each branched from the previous one, the first from main). Every
branch must pass `pytest -q` in booking_system_backend on its own, and the last branch must
contain exactly the change of feat/loyalty-and-seat-upgrades. Commit on those branches only;
leave main and feat/loyalty-and-seat-upgrades as they are.'
bob run --mode agent --format stream-json --max-cost 3 "$PROMPT" > ../b1-run1.ndjson
git checkout -q main                                  # B1 may leave you on a b1/* branch
cleave eval baseline --base main --head feat/loyalty-and-seat-upgrades --branches "b1/*"
```

`b1-stats.json` (Bobcoins from the end of the stream, if it reports them):

```json
{"surface": "bob_run", "mode": "agent", "bobcoins": 1.8}
```

```bash
cleave push --kind baseline_b1 --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main --bob-stats b1-stats.json \
  --out ~/Desktop/Cleave/eval/baselines/b1-run1.bundle.json.gz
git branch -D $(git branch --list 'b1/*' | tr -d ' *')   # clear before run 2, then repeat as b1-run2
```

Copy the printed check table into `eval/baselines/b1-run1.md` / `b1-run2.md`.

- If Bob's branches are named differently, pass them in order: `--branches b1/models b1/api b1/tests`.
- If `cleave eval baseline` says the top branch contains none of the change, B1 didn't
  produce a stack: record that as the run's result in `eval/baselines/` (it is one).
- A PR baseline is stored with the demo stack (the stack page keeps showing the Cleave run).
  Baselines appear side by side with Cleave on `/results` when pushed with `--eval-group`
  (task12).

## Part C · open checks C2, C4, C5, C6 → `eval/open-checks.md`

| Check | How | Record |
| --- | --- | --- |
| C2 | Try to create an Inference API key in the Bob web portal | yes/no; a hosted runner needs it |
| C4 | `bob run --mode cleave --format json "call cleave_status"` in Galaxium; if it fails, `--chat-mode=cleave` | which flag loads the project mode and `.bob/mcp.json` (the runner uses `--mode`; change `runner/bobshell.py` if it's the other) |
| C5 | Look for subagent and cost events in `b1-run1.ndjson` | event names seen, or "none" |
| C6 | `gh extension install github/gh-stack` and one test stack on the fork | stacked or chained for Phase 5 |

C1 and C3 are answered from the task08 run (its step 9).

## Done when

Two B1 runs are on the deployed app as baseline runs of the demo stack, their bundles and
check tables are in `eval/baselines/`, and `eval/open-checks.md` has C1–C6.

## Commit (you)

`eval: B1 runs and open checks` (the engine side is in the pack's commit).
