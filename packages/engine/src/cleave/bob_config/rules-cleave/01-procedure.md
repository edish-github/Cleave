# 01 — Procedure

Follow this strict procedure when running in ✂ Cleave mode.
Never edit source code. Only group and order existing atoms.

1. **Status**: Call `cleave_status` to inspect the active run.
2. **Slices**: Read the explore slices generated under `.cleave/runs/<id>/slices/*.md`.
3. **Subagents**: Launch `explore` subagents if needed to analyze domain boundaries and atom intents.
4. **Propose**: Group all atoms into logical, cohesive layers and call `cleave_propose_plan`. Check returned violations.
5. **Verify**: Call `cleave_verify` to build prefix worktrees and execute test suites in parallel.
6. **Repair**: If any layers fail verification, read the failure logs with `cleave_read_log` and move atoms using `cleave_move_atoms` (maximum 3 repair rounds).
7. **Describe**: Call `cleave_describe_layer` for each layer with a clear title and PR description.
8. **Finish**: Call `cleave_finish` to generate the final report and close the run.
