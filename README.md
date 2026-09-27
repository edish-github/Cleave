# Cleave

**Large pull requests, reviewed as small, proven steps.**

Agents write pull requests too big to review. Cleave splits one into a stack of small pull
requests. Every layer passes your tests on its own, and the last layer is byte-identical to
the original change. IBM Bob decides how the hunks are grouped and ordered, but it has no
tool that can write code, so the worst a bad plan can do is fail to verify. It can't produce
a wrong stack.

## How it works

1. **Map.** The engine cuts the diff into atoms (one hunk, or one whole file) and builds a
   dependency graph from the code: imports, calls, models, pytest fixtures.
2. **Layer.** In the ✂ Cleave mode, Bob reads the diff in parallel slices with read-only
   explore subagents and proposes ordered layers. Its only write surface is eleven MCP tools
   that move atoms between layers.
3. **Prove.** Every prefix of the stack is built in its own worktree and runs your check
   command. A failing layer sends Bob its log; Bob moves atoms and tries again, up to three
   rounds, then merges the two layers instead of writing glue code.

Five checks decide whether a stack is done:

| Check | Holds when |
| --- | --- |
| Atom coverage | Every change appears in exactly one layer |
| Dependency order | Nothing depends on a later layer |
| Tree fidelity | The last layer's git tree equals the pull request's |
| Layer shippability | Each layer passes the check command on its own |
| No new code | 0 lines in the stack that weren't in the original |

## Evidence

| Milestone | What | Live Evidence |
| --- | --- | --- |
| **M1** | First verified Cleave run | [Public Proof on Galaxium PR #1](https://cleave-sable.vercel.app/proof/galaxium-travels-1) (15/15 atoms, 18/18 dependencies, 5/5 green layers, 0 foreign lines) |
| **M2** | Stacked Pull Requests | [Chained PRs on GitHub](https://github.com/edish-github/galaxium-travels/pulls) ([#2](https://github.com/edish-github/galaxium-travels/pull/2), [#3](https://github.com/edish-github/galaxium-travels/pull/3), [#4](https://github.com/edish-github/galaxium-travels/pull/4), [#5](https://github.com/edish-github/galaxium-travels/pull/5), [#6](https://github.com/edish-github/galaxium-travels/pull/6)) |
| **M3** | Evaluation against B1 baseline | [Live /results Table](https://cleave-sable.vercel.app/results) (3 constructed diffs compared head-to-head with B1) |
| **CI** | Test suite | GitHub Actions workflow: 155 pytest specs + contracts check + Next.js build |
| **Evidence** | Bundles and checks | [`demo/runs/`](demo/runs/), [`eval/baselines/`](eval/baselines/), [`eval/runs/`](eval/runs/), [`eval/open-checks.md`](eval/open-checks.md) |

## Evaluation Results

Copied from the live [/results](https://cleave-sable.vercel.app/results) page (27 Sep 2026):

| Diff | Run | Valid stack | Green layers | Foreign lines | Largest layer | Bobcoins | Proof |
| --- | --- | :---: | :---: | :---: | :---: | :---: | :---: |
| **click-deprecated-params**<br>`pallets/click` · 472 lines | **Cleave**<br>B1 | **Valid**<br>Invalid | **3 / 3**<br>1 / 2 | **0**<br>0 | **220**<br>298 | **1.40**<br>1.90 | [Proof](https://cleave-sable.vercel.app/proof/click-0286eba) |
| **click-completions**<br>`pallets/click` · 1,055 lines | **Cleave**<br>B1 | **Valid**<br>Invalid | **2 / 2**<br>2 / 3 | **0**<br>0 | **895**<br>623 | **1.60**<br>2.20 | [Proof](https://cleave-sable.vercel.app/proof/click-dc3dbd0) |
| **galaxium-lint-pass**<br>`edish-github/galaxium-travels` · 218 lines | **Cleave**<br>B1 | **Valid**<br>Invalid | **2 / 2**<br>0 / 3 | **0**<br>0 | **207**<br>191 | **1.20**<br>1.70 | [Proof](https://cleave-sable.vercel.app/proof/galaxium-travels-4886726) |

Across all 3 evaluation diffs, Cleave produced a 100% valid stack on every diff (3/3), while unaided Agent mode (B1) produced 0 valid stacks due to order violations and broken intermediate test suites.

## How Bob is Used

- **✂ Cleave Custom Mode:** Defined in `.bob/custom_modes.yaml`, this mode removes all file-editing and shell execution tools. Bob cannot write code or execute terminal commands directly.
- **11 MCP Tools:** Cleave exposes custom tools (`cleave_start`, `cleave_slice`, `cleave_graph`, `cleave_propose_plan`, `cleave_move_atom`, `cleave_verify`, `cleave_finish`) over stdio JSON-RPC.
- **Guard and Audit Hooks:** PreToolUse hook (`.bob/hooks/guard.py`) enforces strict security boundaries by blocking any attempted source code modifications with exit code 2. PostToolUse hook (`.bob/hooks/audit.py`) records all tool calls to `events.ndjson`.
- **Read-Only Explore Subagents:** Bob launches subagents to inspect diff slices concurrently without contaminating the parent context.
- **B1 Baseline Measurement:** `bob run --mode agent` executed head-to-head against Cleave on identical diffs to empirically measure the baseline.

## Reproduce

1. **Backend Tests:**
   ```bash
   cd packages/engine && uv sync --extra dev && uv run pytest -q
   ```
2. **Demo PR:** See [`demo/galaxium.md`](demo/galaxium.md) for step-by-step reproduction instructions on Galaxium PR #1.
3. **Deployment:** See [`docs/tasks/deploy.md`](docs/tasks/deploy.md) for web deployment setup on Vercel and Neon.

## License

MIT
