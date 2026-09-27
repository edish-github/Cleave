# Status · 27 Sep 2026, 06:30 IST

Audited on `main` at `f03f2bd` plus this handoff pack. "Proven" means it was run, not read.

## The end-to-end flow

```
Galaxium PR ──cleave init──▶ Bob IDE (✂ Cleave) ──11 MCP tools──▶ engine: atomize · graph · plan · verify · finish
     │                                                                         │
     │                                        guard / audit hooks ─ events ────┤
     ▼                                                                         ▼
 cleave publish ──gh──▶ stacked PRs + CI                          cleave push ──▶ web app: stack · proof · /results
```

| Step | State | Evidence |
| --- | --- | --- |
| Atomize, graph, plan, verify, report (task01–05) | **done, proven** | 114 unit specs green; Galaxium integration green with the backend's own tests |
| MCP server (task06) | **done, fixed** | the real server, driven like Bob, split Galaxium PR #1: 15 atoms, 5 layers, 72/72/72/92/92 tests, top tree = head, 8 s |
| Bob config: mode, hooks, rules (task07) | **done, fixed** | guard/audit specs green; `cleave init` merges into Galaxium's own `.bob/` |
| `cleave push` → web | **done, proven** | the run above stored and rendered: stack, layers, verification, activity, proof, share image |
| Web app (landing, proof, /results, runner endpoints, run page) | **done, proven locally** | typecheck, lint, build; local Postgres end-to-end |
| First run in Bob IDE (task08, M1) | **next** | needs the deployment and your Bob IDE |
| B1 baseline (task09) | to build | brief + spec outline in `docs/tasks/phase-4/` |
| Publish (task10, M2) | to build | spec `tests/test_publish.py` (-m publish), brief in `docs/tasks/phase-5/` |
| Eval build + metrics (task11) | to build | spec `tests/test_eval.py` (-m eval), datasets chosen and checked in `eval/datasets.toml` |
| Eval runs (task12, M3) | to run | runbook in `docs/tasks/phase-6/` |
| Runner (task13, P1) | to build | spec `tests/test_runner.py` (-m runner); web side done |
| Submission (Phase 8) | to do | checklist in `docs/tasks/phase-8/` |

## Fixed since the audit started (each would have hurt M1)

Fixed by Bob in its task07 follow-up commits (`03c4a97` … `cd515fe`), from the Phase 3 briefs:

1. **Bob couldn't finish:** the guard blocked `attempt_completion` and `ask_followup_question`.
2. **Invalid hook matcher:** `settings.json` used `"matcher": "*"`, and in Bob the matcher is a regex on tool names.
3. **Overwritten config:** `cleave init` replaced Galaxium's own modes, MCP servers and hooks, and edited its tracked `.gitignore`.
4. **Wrong folder:** `cleave mcp` served whatever directory Bob started it in. `init` now writes `<full path to cleave> mcp --repo <repo>`.

Fixed in this pack, with specs:

5. **"No new code" measured nothing:** `foreign_lines` was hard-coded to 0.
6. **A refused start locked the repo:** a failed `cleave_start` left `.cleave/active`, locking edits in every mode.
7. **Long rounds timed out:** `cleave_verify` couldn't outlive Bob's ~60 s MCP timeout. It now answers `pending`, and Bob polls.
8. **Reverted-looking changes:** the split used `base..head`. It now uses the merge base, like a pull request, so work that lands on `main` later (the CI workflow in Phase 5) never shows up as a reverted change.
9. **Confusing Activity tab:** it showed tool arguments as event titles, and Bob's counts were blank when Bob didn't report them. Both now come from the run's own events.
10. **Hook events leaked contents:** they carried full file contents. They now record the path, command or server only. The guard finds the repo via git.
11. **Docs could drift:** `/docs/bob` is now generated from the shipped config (`npm run contracts`).

## Still open

- **C1/C3:** `tests/payloads/` is hand-written. task08's step 9 reads the real tool names from the run.
- **C2, C4, C5, C6:** answered in task09.
- **Fork CI:** the Galaxium fork has no test workflow and its Bob Review workflow needs a key
  the fork doesn't have. Fork prep is task08's step 0 (`docs/tasks/phase-5/`).
- **Placeholders:** the two landing screenshots (Phase 8).

## What only you can do

1. Deploy (`docs/tasks/deploy.md`): Vercel + Neon + GitHub OAuth app + env vars, then a runner token.
2. Run Bob IDE for task08 and every later Bob task; save each task-summary screenshot.
3. Fork prep on GitHub (workflow, disable Bob Review, merge `main` into the PR branch) and `gh auth login`.
4. The video, cover, slides and the lablab submission.
