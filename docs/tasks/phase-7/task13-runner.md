# task13 · the runner (P1: cut first if late)

**Phase 7** (13:45–15:00) · **Budget:** ~3 Bobcoins · **Evidence:** `bob_sessions/SsnFall_task13_runner_summary.png`

The web side is live: New split queues a run for your runner, `/app/runs/<id>` shows it
and refreshes every 2 s, and the protocol is `schemas/job.schema.json` plus
`/api/runner/{claim, heartbeat, runs/:id/events, runs/:id/complete}`
(server: `apps/web/src/server/jobs.ts`). `CLEAVE_RUN_ID` and `cleave mcp --repo <repo>` already
work in the engine.

## Brief for Bob (Code mode, Cleave repository)

```
Task 13: the runner, the client side of the runner protocol.

Read AGENTS.md §1, the docstrings in packages/engine/src/cleave/runner/{client,bobshell,job}.py,
schemas/job.schema.json and the spec packages/engine/tests/test_runner.py (a mock web app on
httpx.MockTransport; nothing touches the network).

Change only:
- packages/engine/src/cleave/runner/client.py, bobshell.py, job.py
- packages/engine/src/cleave/cli.py        (`cleave runner [--workdir DIR] [--once]`, reading CLEAVE_URL and CLEAVE_TOKEN)
- packages/engine/pyproject.toml           (drop `and not runner` from the default markers once green)

Requirements (details in the docstrings):
1. RunnerClient: claim (200 Job / 204 None, 40 s timeout), heartbeat, send_events (NDJSON,
   ≤ 500 per request), complete (gzip; succeeded with a bundle or failed with an error);
   401 → RunnerAuthError, 409 → JobCancelled.
2. bobshell.command(job) = bob run --mode cleave --format stream-json --max-cost <cap> "<prompt>".
3. job.prepare_checkout: clone, fetch head and base, check out head, then run cleave init
   with the job's config (check, setup, working directory) and write max_layer_lines,
   max_repair_rounds and bobcoin_cap into .cleave/config.toml too.
4. job.run_job: heartbeat with the job id every ≤ 15 s; run bob with CLEAVE_RUN_ID=<job_id>;
   forward new lines of .cleave/runs/<job_id>/events.ndjson every few seconds; on exit 0
   complete with load_bundle(..., source="runner"); otherwise complete with the exit code
   and the tail of stderr; on JobCancelled stop bob and return "cancelled".
5. serve: heartbeat, claim, run, repeat; --once stops after one claim.

Check: uv run pytest -q -m runner && uv run pytest -q
Finish with a summary: files changed, tests passing, anything left undone.
```

## Then, for real (you)

```bash
export CLEAVE_URL=https://<your-deployment> CLEAVE_TOKEN=clv_…
cleave runner --workdir ~/cleave-runs
```

In the app: New split → Galaxium → PR #1 → **Run on <runner>**. The run page should show
events arriving, then **Open the stack**.

Bob runs headless here: open check C4 decides whether `--mode cleave` loads the project
mode. If it doesn't, the runner can't do a Cleave run yet; say so on the run (fail the job
with that reason) rather than falling back to another mode.

## Done when

A run queued in the browser is claimed by your machine, its events appear on the run page
while it runs, and it ends on a stack.

## Commit (you)

`engine: runner claims and runs splits from the web app (task13)` + the screenshot.
