# task13 · the runner (P1: cut first if late)

**Phase 7** (13:45–15:00) · **Budget:** ~3 Bobcoins (one real run) · **Evidence:** `bob_sessions/SsnFall_task13_runner-run.png` (the run page) and the stream in the checkout

The code is done in the handoff pack. The spec is `tests/test_runner.py` (13 cases, in CI).
The web side (queueing from New split, `/app/runs/<id>`, `/api/runner/*`) was done before; the pack adds editing a repository's run settings, which become the job config.

`cleave runner [--workdir ~/.cleave/runner] [--once] [--bob PATH]` (reads `CLEAVE_URL` and
`CLEAVE_TOKEN`) runs this loop:

1. It heartbeats, then long-polls for a job.
2. For each job it clones the repository into `<workdir>/<job_id>`, fetches both branches and
   checks out the head. It then runs `cleave init` with the job's config and writes
   `.cleave/run-id`.
3. It runs `bob run --mode cleave --format stream-json --max-cost <cap> "Cleave <head> onto
   <base>"` with `CLEAVE_RUN_ID=<job_id>`. While it waits, it heartbeats every 10 s and
   forwards new run events every 2 s.
4. When bob finishes it completes the job:
   - with the run's bundle on exit 0 and a `report.json`;
   - otherwise with the exit code and the tail of stderr.
5. A cancel in the browser (409) stops bob and everything it started.

Bob's own stream is saved untouched to `.cleave/bob-stream.ndjson` in the checkout (its
shape is open check C5; nothing parses it). Jobs time out after 45 minutes.

## What was checked end to end (and what wasn't)

Against the real web app (local Postgres), a job queued like New split does was claimed,
cloned from GitHub, run and completed. The resulting run was stored as a `runner` run with
status verified, and every stack tab rendered with no console errors:

- 5 layers, 72/72/72/92/92 tests;
- 23 events forwarded live, including `runner.bob_started` and `runner.bob_exited`.

`bob` in that test was a **stand-in**, not IBM Bob. It is a script with bob's command line
that starts `cleave mcp` from `.bob/mcp.json` over stdio, like Bob does, and plays a fixed
plan. It exercised everything except Bob's own planning. The failure path (bob exits
non-zero, and the job fails with the reason) was checked the same way.

That run found two real problems, both fixed in the pack:

- **`cleave mcp` resolved the repository with a trailing newline**, so every tool call over
  stdio failed. This would have broken the first Bob IDE run. A spec now drives the server
  over stdio.
- **The run id didn't reach the MCP server.** MCP clients start servers with a reduced
  environment, so `CLEAVE_RUN_ID` never arrived and the bundle's run id wouldn't match the
  job. The runner now also writes `.cleave/run-id`, which `cleave_start` uses once.

## Run it for real (you)

Prerequisites on the machine:

- `bob --version` works and you're signed in.
- `git clone https://github.com/edish-github/galaxium-travels` works without a prompt (run
  `gh auth setup-git` for private repositories).
- `uv` is on PATH if the job's setup uses it.

```bash
export CLEAVE_URL=https://<your-deployment> CLEAVE_TOKEN=clv_…
cleave runner --workdir ~/cleave-runs
```

In the app: New split → Galaxium → PR #1 → **Run on <runner>**. The run page should show
events arriving, then **Open the stack**.

Set the job config first. A runner clone is fresh, so the setup must install what the check
needs. In the app, open Repositories → galaxium-travels → **Run settings → Edit** (new in the
pack) and set:

| Setting | Value |
| --- | --- |
| Check command | `python -m pytest -q` |
| Setup command | `uv venv .venv --python 3.11 -q && uv pip install -q --python .venv -r requirements.txt "mcp<2"` |
| Working directory | `booking_system_backend` |

The check runs in the virtualenv the setup creates in each layer's worktree. Runs you push
later update the check and working directory but keep this setup and the limits.

Bob runs headless here, so open check C4 decides whether `--mode cleave` loads the project
mode. If it doesn't, the job fails with "bob run finished without a Cleave report … (open
check C4)". That is the honest result: don't fall back to another mode. If C4 says
`--chat-mode`, change the one line in `runner/bobshell.py`.

## Done when

A run queued in the browser is claimed by your machine, its events appear on the run page
while it runs, and it ends on a stack.

## Commit (you)

Nothing new to commit (the code is in the pack); screenshot the run page for the video.
