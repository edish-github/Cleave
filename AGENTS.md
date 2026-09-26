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
├── bob_sessions/                     ○ SsnFall_taskNN_<desc>_summary.png, one per Bob task (§6)
├── eval/                             ○ Phases 4 and 6
│   ├── datasets.yaml                 ○   constructed diffs: source repo, commits, name
│   ├── ground_truth/<dataset>.json   ○   which atoms came from which original commit
│   ├── baselines/                    ○   B1 stats and notes from Phase 4
│   ├── open-checks.md                ○   results of C1–C6 (§5, Phase 4)
│   └── runs/<dataset>/{cleave,baseline_b1}.bundle.json.gz   ○ committed bundles
├── asset/                            ○ slides, cover, video stills (Phase 8)
├── packages/engine/                  Python 3.11, uv
│   ├── pyproject.toml                ● console script `cleave`; markers integration, bob
│   ├── src/cleave/
│   │   ├── models.py config.py runs.py events.py push.py cli.py   ● done
│   │   ├── gitio.py atomize.py build.py                            ◐ Phase 2 · task01
│   │   ├── graph/{__init__,python_ast,pytest_fixtures,files}.py    ◐ Phase 2 · task02
│   │   ├── plan.py                                                 ◐ Phase 2 · task03
│   │   ├── verify.py                                               ◐ Phase 2 · task04
│   │   ├── report.py                                               ◐ Phase 2 · task05
│   │   ├── slices.py mcp_server.py                                 ◐ Phase 3 · task06
│   │   ├── bob_config/                                             ◐ Phase 3 · task07
│   │   │   ├── custom_modes.yaml mcp.json settings.json
│   │   │   ├── hooks/{guard,audit}.py
│   │   │   └── rules-cleave/{01-procedure,02-plan-schema,03-repair}.md
│   │   ├── baselines.py                                            ◐ Phase 4 · task09
│   │   ├── publish.py                                              ◐ Phase 5 · task10
│   │   ├── eval/{build_dataset,metrics}.py                         ◐ Phase 6 · task11
│   │   ├── runner/{client,job,bobshell}.py                         ◐ Phase 7 · task13 (P1), spec: test_runner.py
│   │   └── describe.py                                             ◐ P2 (watsonx.ai), cut first
│   └── tests/
│       ├── conftest.py               ● `make_repo`: a small git repo with a realistic PR
│       ├── test_models.py            ● green
│       ├── test_atomize_build.py test_graph.py test_plan.py test_verify.py test_report.py
│       │                             ◐ red specs for Phase 2
│       ├── test_mcp.py test_hooks.py ◐ red specs for Phase 3
│       ├── test_runner.py            ◐ red spec for Phase 7 (runner protocol, client side)
│       ├── test_galaxium.py          ◐ integration, needs GALAXIUM_REPO
│       ├── test_publish.py           ○ Phase 5 (Bob writes it, §5)
│       ├── test_eval.py              ○ Phase 6 (Bob writes it, §5)
│       └── payloads/*.json           ○ real Bob hook payloads, Phase 3 (open checks C1, C3)
└── apps/web/                         Next.js 16, see apps/web/README.md
    ├── src/app/                      routes; (public) group: landing, docs, login, results
    ├── src/services/                 `api` → live (Postgres) or sample client
    ├── src/server/                   db, auth, ingest, runner tokens, github.ts, actions
    ├── src/content/bob.ts            text of the shipped Bob files shown on /docs/bob
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
| Engine unit specs | `uv run pytest -q -m "not integration and not bob and not runner"` | yes | every engine task |
| One spec file | `uv run pytest -q tests/test_graph.py` | — | while working on a task |
| Galaxium integration | `GALAXIUM_REPO=~/galaxium-travels uv run pytest -q -m integration` | no | end of Phase 2, before M1 |
| … with the backend's tests | add `GALAXIUM_VERIFY=1` (needs its requirements installed) | no | end of Phase 2 |
| Real Bob payloads | `uv run pytest -q -m bob` | no | after payloads are saved (Phase 3) |
| Runner (P1) | `uv run pytest -q -m runner` | no | Phase 7 |
| Engine lint | `uv run ruff check src tests` | no | before committing |
| Contracts in sync | `npm run contracts:check` | yes | after any schema change |
| Web | `npm run typecheck && npm run lint && npm run build` | yes | every web change |
| Ingest end to end | `cleave push …` to a local or deployed app (below) | no | Phase 3 onward |

**CI is expected to be red on the engine job until Phase 3 is done**: the red specs are the
to-do list. The web job must stay green at all times.

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

### Phase 2 — engine core (03:00–06:00, 10 coins)

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
- Check: `uv run pytest -q -m "not integration and not bob and not runner"` (only `test_mcp.py` and
  `test_hooks.py` may still fail), then
  `GALAXIUM_REPO=~/galaxium-travels GALAXIUM_VERIFY=1 uv run pytest -q -m integration`
- Done when: a verified run has the five checks passing in order; layers carry branch, tree
  and last-round results; a layer still failing after repairs means `review`; a top-tree
  mismatch fails fidelity and the run; `report.md` names every check and layer. On the
  Galaxium PR the atoms cover the whole diff, the graph links tests to services, and a
  one-layer stack is green with the head's tree.

Fallback if tests are still red at 05:30: ship the Python-AST and file-order graph, move M1
to 10:45 and cut Phase 7.

### Phase 3 — Bob mode and the first real run (06:00–07:30, 5 coins)

**task06 · slices and the MCP server**
- Files: `slices.py`, `mcp_server.py`
- Spec: `tests/test_mcp.py` (tool names, descriptions, propose/move, untouched tree)
- Check: `uv run pytest -q tests/test_mcp.py -k "not shipped"`
- Done when: the eleven tools in `TOOL_NAMES` are served over stdio by `cleave mcp`, each
  call logs `mcp.called`, and `cleave_verify` returns `pending` after 50 s with
  `cleave_verify_status` to poll.

**task07 · the shipped Bob config**
- Files: everything under `bob_config/` (see `bob_config/README.md`)
- Start from: the text on `/docs/bob` (`apps/web/src/content/bob.ts`); keep both identical
- Spec: `tests/test_mcp.py` (`shipped` cases), `tests/test_hooks.py`
- Check: `uv run pytest -q -m "not integration and not bob and not runner"`, all green
- Done when: the mode has groups `[read, mcp, subagent, todo]` only; `mcp.json` allows exactly
  `TOOL_NAMES`; the guard allows reads, explore subagents, todos and `cleave_*` calls while
  `.cleave/active` exists and exits 2 on anything else; the audit hook logs every call.

**task08 · first ✂ Cleave run on Galaxium → M1** (✂ Cleave mode)
1. In `~/galaxium-travels`: create `booking_system_backend/.venv` with the requirements and
   `mcp<2`, then `cleave init --check "pytest -q" --workdir booking_system_backend`
   (exact commands and why in `demo/galaxium.md`; no `--setup`, verification reuses the venv).
2. Reload Bob IDE, switch to ✂ Cleave, send: `Cleave feat/loyalty-and-seat-upgrades onto main`.
3. Let it run red → green (≤ 3 repair rounds). Take the task summary screenshot.
4. Save 3+ real hook payloads to `packages/engine/tests/payloads/` and note how MCP calls
   are named in them (open checks C1, C3). Run `uv run pytest -q -m bob`.
5. Write the Bob stats from the task summary into `bob-stats.json`
   (`{"surface": "ide", "mode": "cleave", "bobcoins": …, "duration_ms": …}`), then
   `cleave push --title "Loyalty tiers & seat upgrades" --pr 1 --head-branch feat/loyalty-and-seat-upgrades --base-branch main --bob-stats bob-stats.json`
6. Open the stack in the app → Share proof → public. Open `/proof/<id>` signed out.
- Done when (**M1**): the public proof shows the real layers, all five checks, and the hook
  audit shows 0 blocked writes to source.

Web side of Phase 3: Activity, hook audit table, Bob stats card, share image and the
failed-run state are built. After task07, check `/docs/bob` still matches `bob_config/`.

### Phase 4 — baselines and open checks (10:00–10:45, 6 coins)

**task09 · B1 baseline**
- Files: `baselines.py`, `cli.py` (`cleave eval baseline`), `eval/baselines/`, `eval/open-checks.md`
- Do: run the one-prompt baseline twice with `bob run --mode agent --max-cost 3` on the demo
  PR; measure foreign lines, green layers and top-tree drift with the engine; save each run's
  stats as `eval/baselines/b1-run1.json` and `b1-run2.json`.
- Answer in `eval/open-checks.md`, one line each with the evidence: C2 (Bob API key for a
  hosted runner), C4 (`bob run --mode cleave` loads the project mode and `.bob/mcp.json`;
  else `--chat-mode=cleave`), C5 (subagent events in `stream-json`), C6 (`gh-stack` on the
  fork; else chained `--base`).
- Done when: both B1 runs are recorded and pushed with `--kind baseline_b1`.

### Phase 5 — publish (10:45–11:45, 1 coin)

**task10 · stacked pull requests → M2**
- Files: `publish.py`, `cli.py` (wire `cleave publish`), new `tests/test_publish.py`
- Spec (write it first, small): branches are named `cleave/<slug>/<n>`; with a local bare repo
  as `origin`, `method="branches"` pushes every layer branch and returns a `Publish` record;
  `method="auto"` picks `gh-stack` when installed, else chained `gh pr create --base`.
- Check: `uv run pytest -q tests/test_publish.py`, then `cleave publish` on the demo run and
  `cleave push` again so the Published tab shows the PRs.
- Done when (**M2**): the stacked PRs are open on the fork, each green in Actions, and the
  Published tab shows them with CI badges.

### Phase 6 — evaluation (11:45–13:45, 10 coins)

**task11 · constructed diffs and metrics**
- Files: `eval/build_dataset.py`, `eval/metrics.py`, `cli.py` (`cleave eval build|metrics`),
  `eval/datasets.yaml`, new `tests/test_eval.py`
- Do: squash 3–5 consecutive real commits of a public Python repo with a fast pytest suite
  into one branch `cleave-eval/<dataset>`; write `eval/ground_truth/<dataset>.json` mapping
  each atom to its original commit. Metrics: valid stack, green k/k, foreign lines, drift,
  largest layer, agreement with ground truth.
- Check: `uv run pytest -q tests/test_eval.py` (build on `make_repo` with three commits).

**task12 · evaluation runs → M3** (✂ Cleave and `bob run`)
- For each dataset (3 minimum, 6 at most): one B1 run and one Cleave run, then

  ```bash
  cleave push --title "<dataset>" --kind cleave --eval-group constructed --dataset <dataset> \
    --ground-truth eval/ground_truth/<dataset>.json --bob-stats bob-stats.json \
    --out eval/runs/<dataset>/cleave.bundle.json.gz
  # same with --kind baseline_b1 and …/baseline_b1.bundle.json.gz
  ```
- Done when (**M3**): `/results` shows at least 3 rows with both runs, each linking to a
  public proof, and the bundles are committed under `eval/runs/`.

If Bobcoins run low: use the 5 held back and stop at 3 datasets.

### Phase 7 — live runner (13:45–15:00, 3 coins, P1: cut first)

The web side is built: `schemas/job.schema.json`, the `jobs` and `job_events` tables,
`POST /api/runner/claim` (25 s long poll → Job or 204), `/api/runner/heartbeat` (409 when
its `job_id` is no longer running), `/api/runner/runs/:id/events` (NDJSON of events) and
`/api/runner/runs/:id/complete` (bundle → stored like `cleave push`, or a failure reason).
New split queues a run ("Run on …"), `/app/runs/:id` shows it and refreshes every 2 s,
and it can be cancelled there. Server code: `apps/web/src/server/jobs.ts`.

**task13 · the runner**
- Files: `runner/client.py`, `runner/bobshell.py`, `runner/job.py`, `cli.py` (wire
  `cleave runner`, reading `CLEAVE_URL` and `CLEAVE_TOKEN`), and `mcp_server.py` /
  `runs.py` so a run started with `CLEAVE_RUN_ID` set uses it as its run id
- Spec: `tests/test_runner.py` (client against a mock web app, the `bob run` command,
  checkout with the job's config, failure and cancel paths). Needs task07's `bob_config/`.
- Check: `uv run pytest -q -m runner`, then for real: `cleave runner` on your
  machine, New split → Run on <your runner> on the demo PR.
- Done when: a run queued in the browser is claimed by your machine, its events appear on
  the run page while it runs, and "Open the stack" leads to the finished stack.

### Phase 8 — submission (15:00–18:00)

- [ ] Replace the two placeholder screenshots in `apps/web/src/lib/assets.ts` with real ones
      in `apps/web/public/images/` (stack overview 2400×1500, Bob IDE in ✂ Cleave 1200×900).
- [ ] `bob_sessions/` has one summary screenshot per Bob task, named per §6.
- [ ] README: summary, evidence table (M1–M3 links, `/results`, bob_sessions), reproduce steps.
- [ ] Deployed app: landing links the live proof; `/results` has ≥ 3 rows; every link opens signed out.
- [ ] Video under 3 minutes, at least 90 s of the product running (M1 run, proof, `/results`).
- [ ] Slides, cover image and statements in `asset/`.
- [ ] Final `git status` clean, CI green on `main`.

Never cut: the Bob IDE run, `/proof/:stackId`, `/results` with ≥ 3 diffs, `bob_sessions/`,
the video. Cut in this order when late: Phase 7, P2 work (`describe.py`, webhooks),
`/docs/bob` build-time read, live GitHub lists.

---

## 6. Evidence

| What | Where | Name |
| --- | --- | --- |
| Bob task summary (every Bob task, required by the rules) | `bob_sessions/` | `SsnFall_taskNN_<short-kebab-description>_summary.png` |
| Real hook payloads | `packages/engine/tests/payloads/` | `pre-<tool>.json`, `post-<tool>.json` |
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
- Commit messages start with the area: `engine:`, `web:`, `schemas:`, `eval:`, `docs:`,
  `evidence:`. Example: `engine: atomize and rebuild (task01)`.
- Never commit `.env*.local`, `.cleave/runs/` or tokens. `cleave init` adds `.cleave/runs/`
  and `.cleave/active` to the target repository's `.gitignore`.
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
