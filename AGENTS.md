# AGENTS.md — building Cleave

Cleave splits an oversized pull request into a stack of small ones. Every layer passes the
project's tests on its own, and the last layer is byte-identical to the original change.
Bob only groups and orders existing hunks; the engine does everything deterministic.

This file is the working manual for anyone building Cleave itself: Bob in Bob IDE, other
agents, and people. It says where every file goes, which phase creates it, how each phase is
tested and what evidence it leaves. The Bob config Cleave *ships to users* is a different
thing and lives in `packages/engine/src/cleave/bob_config/`.

Team **SsnFall** · IBM Bob Hackathon (lablab.ai) · submit by **Sun 27 Sep, 19:30 IST**
(portal closes 20:30).

---

## 1. Rules that always apply

1. **Contracts first.** `schemas/*.schema.json` is the single contract. `cleave.models`
   mirrors it in Python, `apps/web/src/lib/contracts.ts` is generated from it. Change a shape
   in all three in one commit: edit the schema, mirror it in `models.py`, run
   `npm run contracts` in `apps/web`. `tests/test_models.py` and `contracts:check` fail on drift.
2. **Tests are the spec.** `packages/engine/tests/` describes the required behaviour. Make a
   spec pass by changing `src/`. Never weaken, skip or delete a test to get green; add cases.
3. **Never touch the user's working tree.** All git work goes through `cleave.gitio`:
   temporary `GIT_INDEX_FILE`, `commit-tree`, `update-ref`, worktrees under a temp dir. No
   checkout, reset, stash or commit on the branch being split.
4. **No invented code in stacks.** The engine only moves hunks between layers. A layer that
   can't pass on its own is merged with its neighbour, never patched.
5. **Nothing fake.** Every number on a page comes from a pushed run. No mock endpoints, no
   hard-coded results, no sample data outside the labelled sample workspace. If something
   isn't built yet, the page says so.
6. **Touch only the files your task lists.** If a task needs another file, say so in the
   task summary instead of quietly widening the change.
7. **No secrets, no private data.** Tokens and URLs live in environment variables, never in
   the repo or in a Bob prompt. Use only public repositories and data (hackathon rule).
8. **Small, typed, boring.** Type hints everywhere, pure functions where possible, standard
   library before dependencies. The engine makes no network calls except in `push.py`,
   `publish.py` (via `git`/`gh`) and `runner/`.

---

## 2. Repository map

`●` exists and works · `◐` exists as a stub or spec, Bob implements it · `○` created in a later phase.

```
Cleave/
├── AGENTS.md                         ● this file
├── README.md                         ● product summary; evidence table added in Phase 8
├── LICENSE                           ● MIT
├── .bob/rules/                       ● rules Bob follows while building Cleave
│   ├── 00-workflow.md                ●   how a task starts, checks and ends
│   ├── 01-engine.md                  ●   engine rules
│   └── 02-web.md                     ●   web rules
├── .github/workflows/ci.yml          ● engine pytest (unit specs) + web contracts/typecheck/lint/build
├── schemas/                          ● atom, graph, plan, report, event, bundle, job (.schema.json)
├── demo/galaxium.md                  ● the demo PR (edish-github/galaxium-travels #1) and how to rerun it
├── demo/runs/                        ○ bundle of the M1 run (task08)
├── docs/STATUS.md                    ● what's done, proven, open and next
├── docs/tasks/                       ● one brief per remaining task (README lists the order), deploy.md
├── bob_sessions/                     ○ SsnFall_taskNN_<desc>_summary.png, one per Bob task (§6)
├── eval/                             Phases 4 and 6
│   ├── datasets.toml                 ●   four constructed diffs (click ×3, Galaxium), checked
│   ├── ground_truth/<dataset>.json   ○   which atoms came from which original commit
│   ├── baselines/                    ○   B1 stats and notes from Phase 4
│   ├── open-checks.md                ○   results of C1–C6 (§5, Phase 4)
│   └── runs/<dataset>/{cleave,baseline_b1}.bundle.json.gz   ○ committed bundles
├── asset/                            ○ slides, cover, video stills (Phase 8)
├── packages/engine/                  Python 3.11, uv
│   ├── pyproject.toml                ● console script `cleave`; default pytest run = CI suite
│   ├── src/cleave/
│   │   ├── models.py config.py runs.py events.py push.py cli.py   ● done
│   │   ├── gitio.py atomize.py build.py                            ● Phase 2 · task01
│   │   ├── graph/{__init__,python_ast,pytest_fixtures,files}.py    ● Phase 2 · task02
│   │   ├── plan.py                                                 ● Phase 2 · task03
│   │   ├── verify.py                                               ● Phase 2 · task04
│   │   ├── report.py                                               ● Phase 2 · task05
│   │   ├── slices.py mcp_server.py                                 ● Phase 3 · task06
│   │   ├── bob_config/                                             ● Phase 3 · task07
│   │   │   ├── custom_modes.yaml mcp.json settings.json
│   │   │   ├── hooks/{guard,audit}.py
│   │   │   └── rules-cleave/{01-procedure,02-plan-schema,03-repair}.md
│   │   ├── baselines.py                                            ● Phase 4 · task09, spec: test_baselines.py
│   │   ├── publish.py                                              ● Phase 5 · task10, spec: test_publish.py
│   │   ├── eval/{build_dataset,metrics}.py                         ● Phase 6 · task11, spec: test_eval.py
│   │   ├── runner/{client,job,bobshell}.py                         ● Phase 7 · task13 (P1), spec: test_runner.py
│   │   └── describe.py                                             ◐ P2 (watsonx.ai), cut first
│   └── tests/
│       ├── conftest.py               ● `make_repo`: a small git repo with a realistic PR
│       ├── test_models.py test_atomize_build.py test_graph.py test_plan.py
│       │   test_verify.py test_report.py test_mcp.py test_hooks.py test_init.py
│       │   test_baselines.py test_publish.py test_eval.py test_runner.py        ● green (the CI suite)
│       ├── test_galaxium.py          ● integration, needs GALAXIUM_REPO
│       └── payloads/*.json           ◐ hand-written; replace from task08's real run (C1, C3)
└── apps/web/                         Next.js 16, see apps/web/README.md
    ├── src/app/                      routes; (public) group: landing, docs, login, results
    ├── src/services/                 `api` → live (Postgres) or sample client
    ├── src/server/                   db, auth, ingest, runner tokens, github.ts, actions
    ├── src/content/bob.generated.ts  the shipped Bob config, generated by `npm run contracts`
    ├── src/lib/assets.ts             two landing screenshots (placeholders until Phase 8)
    ├── drizzle/                      SQL migrations
    └── test/fixtures/sample-bundle.json   a bundle for testing ingest without the engine
```

`research/` is in `.gitignore`. The kill-test prototypes (`research/kill-tests/cleave_prototype.py`,
`cleave_verify.py`, the guard script, K1–K4 logs) exist only on the developer's machine. Bob
reads them there as a starting point; nothing in the repo imports them. To publish them as
evidence, commit them on purpose with `git add -f research/kill-tests`.

---

## 3. Setup (once per machine)

```bash
# Engine: dev environment, and a global `cleave` for Bob's MCP config and other repos
cd packages/engine
uv sync --extra dev
uv tool install --editable .            # puts `cleave` on PATH; edits take effect immediately
cleave --version

# Demo repository (the PR every demo run splits)
git clone https://github.com/edish-github/galaxium-travels ~/galaxium-travels
git -C ~/galaxium-travels fetch origin feat/loyalty-and-seat-upgrades

# Web app
cd apps/web
npm ci
cp .env.example .env.local              # fill in locally; never commit it
npm run dev                             # sample workspace without a database
```

Deploying the web app (Vercel + Neon, GitHub OAuth) is in `apps/web/README.md`. Runner
tokens come from the deployed app: Settings → Bob & runners → Create token. Keep it in
`CLEAVE_TOKEN`, with `CLEAVE_URL` set to the deployment.

---

## 4. Testing

| Tier | Command (from the package) | Runs in CI | When |
| --- | --- | --- | --- |
| Engine unit specs (the CI suite) | `uv run pytest -q` | yes | every engine task |
| One phase's specs alone | `uv run pytest -q -m publish` / `-m eval` / `-m runner` | in the suite | that phase's task |
| One spec file | `uv run pytest -q tests/test_graph.py` | — | while working on a task |
| Galaxium integration | `GALAXIUM_REPO=~/galaxium-travels uv run pytest -q -m integration` | no | end of Phase 2, before M1 |
| … with the backend's tests | add `GALAXIUM_VERIFY=1` (needs its requirements installed) | no | end of Phase 2 |
| Real Bob payloads | `uv run pytest -q -m bob` | no | after payloads are saved (Phase 3) |
| Engine lint | `uv run ruff check src tests` | no | before committing |
| Contracts in sync | `npm run contracts:check` | yes | after any schema change |
| Web | `npm run typecheck && npm run lint && npm run build` | yes | every web change |
| Ingest end to end | `cleave push …` to a local or deployed app (below) | no | Phase 3 onward |

`uv run pytest -q` runs the CI suite: `pyproject.toml` deselects only `integration` and
`bob` by default (a later `-m` wins). The phase specs (`publish`, `eval`, `runner`) landed
with their tasks and are part of it. Both CI jobs stay green.

Engine → web check without Bob (works today): take any finished run directory and push it.

```bash
export CLEAVE_URL=http://localhost:3000 CLEAVE_TOKEN=clv_…
cleave -C ~/galaxium-travels push --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main
# → {"stack_id": …, "proof_url": …}; 201 the first time, 200 when the run is re-pushed
```

Writing new tests: put shared fixtures in `conftest.py`, build repos with `make_repo`, assert
on `cleave.models` objects, and never depend on the network. Tests that need a real clone
are marked `integration`; tests that need real Bob output are marked `bob`.

---

## 5. Phases

Two tracks share one clock. Engine work happens in **Bob IDE** (the judged Bob usage);
the web track is built outside Bob. Every phase ends on a check you can see.

| Phase | IST | Bob task(s) | Done when | Bobcoins |
| --- | --- | --- | --- | --- |
| 0 Repo · 1 Contracts | done | — | schemas, specs, CI, fixture bundle | 0 |
| 2 Engine core | 03:00–06:00 | task01–05 | unit specs for Phase 2 green; Galaxium integration green | 10 |
| 3 Bob mode + first run | 06:00–07:30 | task06–08 | **M1**: public proof of a real ✂ Cleave run, 0 source writes | 5 |
| Rest | 07:30–10:00 | — | sleep | 0 |
| 4 Baselines + open checks | 10:00–10:45 | task09 | two B1 runs recorded; C2, C4, C5, C6 answered | 6 |
| 5 Publish | 10:45–11:45 | task10 | **M2**: stacked PRs on the fork, green in Actions, on the Published tab | 1 |
| 6 Evaluation | 11:45–13:45 | task11–12 | **M3**: `/results` shows ≥ 3 real rows, each with a proof | 10 |
| 7 Live runner (P1) | 13:45–15:00 | task13 | a run started in the browser finishes locally and appears live | 3 |
| 8 Submission | 15:00–18:00 | — | **M4**: video < 3 min by 17:30, all assets committed | 0 |
| Buffer | 18:00–19:30 | — | submitted on lablab.ai | 5 held |

Each Bob task below lists: **Files** (the only files to change), **Spec** (tests that must
turn green), **Check** (the command to run before finishing) and **Done when**.
Use Bob's **Code** mode for engine tasks and **✂ Cleave** for runs.

### Phase 2 — engine core (03:00–06:00, 10 coins) — done

**task01 · git plumbing, atoms and rebuild**
- Files: `gitio.py`, `atomize.py`, `build.py`, `cli.py` (wire `cleave build`)
- Start from: `research/kill-tests/cleave_prototype.py` (parse and rebuild)
- Spec: `tests/test_atomize_build.py`
- Check: `uv run pytest -q tests/test_atomize_build.py tests/test_models.py`
- Done when: atom ids are stable and content-addressed; added, deleted, renamed and binary
  files are single atoms and modified files split into hunks; line counts match
  `git diff --numstat`; a dirty tree is refused; every prefix builds, the top equals the
  head's tree, and the working tree is never touched; `build_stack` chains commits on named
  branches with 0 foreign lines.

**task02 · dependency graph**
- Files: `graph/__init__.py`, `graph/python_ast.py`, `graph/pytest_fixtures.py`, `graph/files.py`
- Spec: `tests/test_graph.py` (the one `xfail` case is a stretch goal)
- Check: `uv run pytest -q tests/test_graph.py`
- Done when: a module needs the class it imports, a service the function it calls, a test
  the fixture it takes, a fixture the class and dataclass field it uses; independent hunks
  of one file get no order edge; cycles become forced groups; runtime edges are marked as
  found by verification.

**task03 · plans**
- Files: `plan.py`
- Spec: `tests/test_plan.py`
- Check: `uv run pytest -q tests/test_plan.py`
- Done when: `check_plan` reports missing, duplicate and unknown atoms, order violations
  (naming the atom and layer), split forced groups, and layer size only when asked;
  `PlanStore` saves each proposal, move and merge as the next `plan.vN.json`, drops layers a
  move empties, and rejects unknown atoms and bad layers.

**task04 · verification**
- Files: `verify.py`, `cli.py` (wire `cleave verify`)
- Start from: `research/kill-tests/cleave_verify.py`
- Spec: `tests/test_verify.py` (pytest output parsing, log excerpts); `verify()` itself is
  exercised on the real diff by `tests/test_galaxium.py` with `GALAXIUM_VERIFY=1` (task05)
- Check: `uv run pytest -q tests/test_verify.py`
- Done when: the parsing specs pass, and `verify()` builds every prefix in its own temp
  worktree, runs setup + check in parallel within the per-layer timeout, writes
  `checks/rN-lM.log` and emits `verify.started`, `layer.passed`/`layer.failed` and
  `verify.passed` through `EventLog` (the names the web app's Activity page reads).

**task05 · report, and the real demo diff**
- Files: `report.py`
- Spec: `tests/test_report.py`, then `tests/test_galaxium.py`
- Check: `uv run pytest -q` (only `test_mcp.py` and
  `test_hooks.py` may still fail), then
  `GALAXIUM_REPO=~/galaxium-travels GALAXIUM_VERIFY=1 uv run pytest -q -m integration`
- Done when: a verified run has the five checks passing in order; layers carry branch, tree
  and last-round results; a layer still failing after repairs means `review`; a top-tree
  mismatch fails fidelity and the run; `report.md` names every check and layer. On the
  Galaxium PR the atoms cover the whole diff, the graph links tests to services, and a
  one-layer stack is green with the head's tree.

Fallback if tests are still red at 05:30: ship the Python-AST and file-order graph, move M1
to 10:45 and cut Phase 7.

### Phases 3–8: briefs in `docs/tasks/`

Every remaining task has its own file: a **Brief for Bob** to paste into Bob IDE where Bob
builds something, and a runbook for the parts you run. Order and times:
[`docs/tasks/README.md`](docs/tasks/README.md). Current state: [`docs/STATUS.md`](docs/STATUS.md).

| Task | File | Spec | Done when |
| --- | --- | --- | --- |
| task06 MCP server | [phase-3/task06](docs/tasks/phase-3/task06-mcp-server.md) | `test_mcp.py` | done |
| task07 Bob config | [phase-3/task07](docs/tasks/phase-3/task07-bob-config.md) | `test_hooks.py`, `test_init.py` | done |
| task08 first run | [phase-3/task08](docs/tasks/phase-3/task08-first-run.md) | — | **M1**: public proof of a real ✂ Cleave run, 0 blocked writes |
| task09 B1 baseline | [phase-4/task09](docs/tasks/phase-4/task09-baselines.md) | `test_baselines.py` | code done; two B1 runs pushed; C1–C6 answered |
| task10 publish | [phase-5/task10](docs/tasks/phase-5/task10-publish.md) | `test_publish.py` | code done; **M2**: stacked PRs on the fork, green, on the Published tab |
| task11 eval build | [phase-6/task11](docs/tasks/phase-6/task11-eval-build.md) | `test_eval.py` | done: ground truth for every dataset |
| task12 eval runs | [phase-6/task12](docs/tasks/phase-6/task12-eval-runs.md) | — | **M3**: `/results` with ≥ 3 rows |
| task13 runner (P1) | [phase-7/task13](docs/tasks/phase-7/task13-runner.md) | `test_runner.py` | code done; a browser-started run finishes on your machine |
| submission | [phase-8/submission](docs/tasks/phase-8/submission.md) | — | **M4**: video, assets, submitted |

Never cut: the Bob IDE run, `/proof/:stackId`, `/results` with ≥ 3 diffs, `bob_sessions/`,
the video. Cut in this order when late: Phase 7, P2 work (`describe.py`, webhooks),
`/docs/bob` build-time read, live GitHub lists.

---

## 6. Evidence

| What | Where | Name |
| --- | --- | --- |
| Bob task summary (every Bob task, required by the rules) | `bob_sessions/` | `SsnFall_taskNN_<short-kebab-description>_summary.png` |
| Real hook payloads | `packages/engine/tests/payloads/` | `pre-<tool>.json` (from task08's run, step 9) |
| B1 baseline stats | `eval/baselines/` | `b1-run1.json`, `b1-run2.json` |
| Open checks C1–C6 | `eval/open-checks.md` | one line per check with its evidence |
| Evaluation bundles | `eval/runs/<dataset>/` | `cleave.bundle.json.gz`, `baseline_b1.bundle.json.gz` |
| Demo run | the deployed app | public `/proof/<stackId>`, linked from README |

Task numbers are two digits and never reused (`task01` … `task13`; extra tasks continue
at `task14`). The screenshot must show Bob's task summary with its Bobcoin cost. Commit it
in the same commit as the code the task produced.

---

## 7. Git

- Work on `main` in small commits; each commit leaves the web job green.
- Commits go in under the team's own git identity, with plain messages: no co-author
  trailers from any agent. Outside agents hand over zips and task briefs; the team commits.
- Commit messages start with the area: `engine:`, `web:`, `schemas:`, `eval:`, `docs:`,
  `evidence:`. Example: `engine: atomize and rebuild (task01)`.
- Never commit `.env*.local`, `.cleave/runs/` or tokens. `cleave init` ignores run output
  through `.cleave/.gitignore` and never edits the target repository's own `.gitignore`.
- The `cleave/*` branches in the demo fork are build output; don't edit them by hand.

---

## 8. Briefing Bob for a task

Paste this into Bob IDE (Code mode), filled in from §5:

```
Task NN: <title>
Read AGENTS.md §1 and the task entry in §5.
Change only: <files>
Make these pass: <spec>
Before finishing, run: <check> and show the result.
Finish with a summary: files changed, tests passing, anything left undone.
```
