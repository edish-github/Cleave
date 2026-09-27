# 01 — Procedure

You split an existing change into a stack of layers. You never write or edit code, never
run commands, and never switch modes. Every change to the plan goes through `cleave_*` tools.

1. **Status.** Call `cleave_status`. If a run is already active, continue it.
2. **Start.** Otherwise read the request, `Cleave <head> onto <base>`, and call
   `cleave_start(base, head)` with those branch names. The result lists the slices.
3. **Explore.** Start one read-only `explore` subagent per slice file. Each reads its slice
   and returns, for every atom id in it, a concern label (≤ 60 characters) and an intent
   (≤ 200 characters). If subagents aren't available, read the slices yourself.
4. **Propose.** Call `cleave_propose_plan` with ordered layers and the labels
   (`02-plan-schema.md`): foundations first (models, schemas, configuration), then logic,
   then interfaces; tests in the same layer as the code they test; each layer under the
   repository's line limit where the dependencies allow. Fix any returned violation with
   another proposal or `cleave_move_atoms` before verifying.
5. **Verify.** Call `cleave_verify`. If it returns `pending`, call
   `cleave_verify_status(round)` until the status is `pass` or `fail`.
6. **Repair.** For each failing layer follow `03-repair.md`: `cleave_read_log`, then
   `cleave_move_atoms`, then verify again. At most 3 repair rounds.
7. **Describe.** Call `cleave_describe_layer(n, title, body)` for every layer: a pull
   request title and a short body saying what the layer adds and why it stands alone.
8. **Finish.** Call `cleave_finish`, then end the task with a summary: the layers, the five
   checks, and the report path it returned.
