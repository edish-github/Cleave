# task08 · the first ✂ Cleave run on Galaxium → M1

**Who:** you, with Bob in the ✂ Cleave mode · **Where:** `~/galaxium-travels` · **Budget:** 1–3 Bobcoins
**Evidence:** `bob_sessions/SsnFall_task08_first-cleave-run_summary.png`

This run is also what Phase 5 publishes, so step 0 prepares the fork for CI first.

## Before you start

- [ ] The handoff pack is committed, and in `packages/engine`: `uv sync --extra dev && uv run pytest -q` is green.
- [ ] `uv tool install --editable packages/engine --force` (so the `cleave` on your PATH has the fixes).
- [ ] The web app is deployed with its database and GitHub sign-in (`docs/tasks/deploy.md`), you've
      signed in with GitHub, and created a runner token in Settings → Bob & runners.
- [ ] `export CLEAVE_URL=https://<your-deployment> CLEAVE_TOKEN=clv_…` in the terminal you'll push from.

## Steps

0. **Prepare the fork for CI** (once; why in `docs/tasks/phase-5/task10-publish.md`, "Fork prep"):
   add `docs/tasks/phase-5/galaxium-backend-tests.yml` to the fork's `main` as
   `.github/workflows/backend-tests.yml`, disable the **Bob Review** workflow in the fork's
   Actions tab, then merge `main` into `feat/loyalty-and-seat-upgrades` and push. PR #1's
   diff doesn't change; its head does, and every layer branch will carry the workflow.

1. **Backend environment** (once), as in `demo/galaxium.md`:

   ```bash
   cd ~/galaxium-travels/booking_system_backend
   uv venv .venv --python 3.11
   uv pip install --python .venv -r requirements.txt "mcp<2"
   .venv/bin/python -m pytest -q          # 72 passed on main
   ```

2. **Install the mode:**

   ```bash
   cd ~/galaxium-travels
   git checkout main && git pull && git fetch origin
   cleave init --check "pytest -q" --workdir booking_system_backend
   git status --short     # only .bob/ and .cleave/ lines
   ```

   `.bob/mcp.json` keeps playwright and context7 and adds `cleave` with the full path of
   your `cleave` and `mcp --repo ~/galaxium-travels`; `.bob/settings.json` keeps Galaxium's hooks and
   adds the guard and the audit.

3. **Reload Bob IDE** (Developer: Reload Window). In the MCP panel, `cleave` should be
   connected with 11 tools.

4. **Run it.** Switch to **✂ Cleave** and send:

   ```
   Cleave feat/loyalty-and-seat-upgrades onto main
   ```

   Let it work: start, explore subagents, a plan, verification, repairs, descriptions, finish.
   Approve only cleave tool calls; the mode has no edit or command tools, and the guard
   blocks them if anything tries.

5. **Check the result:**

   ```bash
   cat .cleave/runs/*/report.md | head -30     # status verified, five checks
   git branch --list 'cleave/*'                # cleave/loyalty-and-seat-upgrades/<n>-<name>
   ```

   Take the task-summary screenshot now. Put the numbers it shows into `bob-stats.json`
   (leave out what it doesn't show; tool calls, cleave calls and duration are counted from
   the run's own events when you leave them out):

   ```json
   { "surface": "ide", "mode": "✂ Cleave", "bobcoins": 1.4 }
   ```

6. **Push** (and keep the bundle as evidence in the Cleave repo):

   ```bash
   cleave push --title "Loyalty tiers & seat upgrades" --pr 1 \
     --head-branch feat/loyalty-and-seat-upgrades --base-branch main \
     --bob-stats bob-stats.json \
     --out ~/Desktop/Cleave/demo/runs/galaxium-pr1.bundle.json.gz
   ```

7. **Make it public:** open the printed `stack_url` → Share proof → public. Open `proof_url`
   in a private window. The stack's Activity tab lists every tool call Bob made, and the guard
   hook card shows 0 blocked writes. **That's M1.**

8. **Leave Galaxium as it is.** Phase 5 publishes from `.cleave/runs/` and the `cleave/*`
   branches. Nothing from the run is committed there.

9. **Close open checks C1 and C3** from what the run recorded:

   ```bash
   python3 - <<'PY'
   import json, glob
   seen = {}
   for line in open(sorted(glob.glob(".cleave/runs/*/events.ndjson"))[-1]):
       e = json.loads(line)
       if e["type"].startswith("hook."):
           seen.setdefault((e["type"], e["tool"]), e["payload"].get("detail", ""))
   for (kind, tool), detail in sorted(seen.items()):
       print(f"{kind:13} {tool:28} {detail[:60]}")
   PY
   ```

   These are the tool names Bob really used. If a read-only tool shows as `hook.blocked`,
   add it to `READ_TOOLS` in `packages/engine/src/cleave/bob_config/hooks/guard.py`. Write the
   answers into `eval/open-checks.md` (C1: payload shape; C3: how MCP calls are named).

## If something goes wrong

| What you see | Do this |
| --- | --- |
| `Working tree … is dirty` | `git status`: commit or stash anything outside `.bob/` and `.cleave/` |
| `cleave` MCP server not connected | `.bob/mcp.json` `command` must be what `which cleave` prints; rerun `cleave init` after `uv tool install --force` |
| Every layer fails with `ModuleNotFoundError` or `Server.__init__()` | Step 1 wasn't done, or the venv lacks `mcp<2` |
| The guard blocks a tool Bob needs (not a write) | Add it to `READ_TOOLS` in `.bob/hooks/guard.py` (and in `bob_config/` for next time) |
| Bob stops with an MCP timeout on verify | Your `cleave` predates the pack: reinstall it; verify now answers `pending` and Bob polls |
| A run is stuck and blocks edits in other modes | `rm .cleave/active` |
| Push returns 401 | Token revoked or wrong `CLEAVE_URL`; create a new token |

## Commit (you, in the Cleave repo)

`evidence: first Cleave run on Galaxium PR #1 (task08)` with the screenshot,
`demo/runs/galaxium-pr1.bundle.json.gz` and `eval/open-checks.md` (C1, C3).
Add the proof URL to `demo/galaxium.md`.
