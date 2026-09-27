# Status · 27 Sep 2026, 08:20 IST

This is `main` at `f7972b7` plus the phase 4–7 handoff pack. "Proven" means it was run, not read.

## The end-to-end flow

```
Galaxium PR ──cleave init──▶ Bob IDE (✂ Cleave) ──11 MCP tools──▶ engine: atomize · graph · plan · verify · finish
     │                                                                         │
     │                                        guard / audit hooks ─ events ────┤
     ▼                                                                         ▼
 cleave publish ──gh──▶ chained PRs + CI                          cleave push ──▶ web app: stack · proof · /results
 cleave eval baseline ──▶ B1 measured as a run ─────────────────── cleave push --kind baseline_b1
 cleave runner ◀── job queued in the browser ── claim · heartbeat · events · complete ──▶ stack
```

| Step | State | Evidence |
| --- | --- | --- |
| Atomize, graph, plan, verify, report (task01–05) | **done, proven** | CI suite; the Galaxium integration run with the backend's own tests |
| MCP server (task06) | **done, fixed again** | the server now runs over real stdio in a spec. The stdio bug (below) would have stopped M1 |
| Bob config: mode, hooks, rules (task07) | **done** | guard/audit/init specs |
| `cleave push` → web | **done, proven** | runs stored and rendered, now including runner and baseline runs |
| Web app | **done, proven locally** | typecheck, lint and build pass; the pack adds editing a repository's run settings |
| First run in Bob IDE (task08, M1) | **next** | needs the deployment and your Bob IDE |
| B1 measurement (task09 Part A) | **done, proven** | `test_baselines.py` (9 cases); measured on real Galaxium branch stacks |
| B1 runs + open checks (task09 B, C) | **to run** (you) | runbook in `docs/tasks/phase-4/` |
| Publish (task10) | **done**; M2 **to run** (you) | `test_publish.py` (7 cases, reruns reuse open PRs); runbook in `docs/tasks/phase-5/` |
| Eval build + metrics (task11) | **done, proven** | `test_eval.py` (7 cases); `eval/ground_truth/` for all 4 datasets, identical on rebuild |
| Eval runs (task12, M3) | **to run** (you + Bob) | runbook in `docs/tasks/phase-6/` |
| Runner (task13) | **done, proven with a stand-in bob**; real run **to do** (you) | `test_runner.py` (13 cases); a queued job was claimed and cloned from GitHub, verified 5/5 and stored |
| Submission (Phase 8) | to do | checklist in `docs/tasks/phase-8/` |

`uv run pytest -q` (the CI suite) now includes the publish, eval, runner and baseline specs:
155 pass. It was also run from a clean copy with a fresh `uv sync`.

## Fixed in the phase 4–7 pack (found by running things for real)

1. **`cleave mcp` couldn't work over stdio.** The repository path kept git's trailing
   newline, so every tool call Bob made would fail with "No such file or directory". The old
   specs called the server in-process, which is why it went unnoticed. A spec now starts
   `cleave mcp --repo` as a subprocess and calls `cleave_start` over JSON-RPC.
2. **Runner runs could never be stored.** MCP clients start servers with a reduced
   environment, so `CLEAVE_RUN_ID` never reached `cleave mcp`, and the bundle's run id
   wouldn't match the job. The runner now also writes `.cleave/run-id`, which `cleave_start`
   uses once.
3. **Check commands with quotes broke the config.** `cleave init --check '… -k "…"'` wrote
   invalid TOML. Strings are now escaped, with a round-trip spec.
4. **"No new code" counted missing code.** `foreign_lines` counted every difference from
   the head, so a stack that left something out showed it as "new code". It now counts what
   the schema says: lines the stack adds that the change doesn't. That matters for B1, which
   often leaves parts out.
5. **Parallel layers shared a temp dir and stdin.** Checks now get their own `TMPDIR` and a
   closed stdin (under MCP stdio, stdin is Bob's JSON-RPC stream).
6. **A setup that creates a venv wasn't used by the check.** The check's environment is now
   computed after the setup runs. Runner jobs on a fresh clone need this.
7. **`pytest -q` summaries weren't read.** Counts came out empty and the status was "error".
8. **Flaky click tests in the eval datasets.** Two `test_echo_via_pager` cases race a pager
   process and fail under parallel verification (5 of 6 concurrent runs). The dataset checks
   leave them out, and the reason is in `eval/datasets.toml`.
9. **Runner jobs had no setup.** A repository's run settings came only from the last pushed
   run, and nothing let you set them. The repository page now edits them, and pushes merge
   into them instead of wiping them.

Fixed earlier (the audit pack, and Bob's task07 follow-ups): the guard allowing
questions/completion, the hook matcher, `init` merging config, `mcp --repo`, measured
foreign lines, safe start, background verify, the merge-base split, the Activity tab, hook
events without contents, and generated `/docs/bob`.

## Still open

- **C1/C3:** `tests/payloads/` is hand-written. task08's step 9 reads the real tool names.
- **C2, C4, C5, C6:** answered in task09 Part C. C4 decides whether the runner's
  `bob run --mode cleave` loads the mode.
- **Proof page and B1:** PR baselines are stored with their stack but only `/results` shows
  B1 next to Cleave. Showing B1 on the proof page is optional
  (`docs/tasks/phase-8/optional-b1-on-proof.md`).
- **Placeholders:** the two landing screenshots (Phase 8).

## What only you can do

1. Deploy (`docs/tasks/deploy.md`), then create a runner token.
2. Run Bob IDE for task08, task12 and the real runner run. Save each summary screenshot:
   these, plus the B1 streams, are the `bob_sessions/` evidence.
3. Fork prep on GitHub, then `gh auth login` and `gh auth setup-git`.
4. The video, cover, slides and the lablab submission.
