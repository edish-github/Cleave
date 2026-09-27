# Phase 3 — Bob mode and the first real run

Goal (**M1**): a real ✂ Cleave run on the Galaxium demo PR, pushed to the deployed app,
with a public proof page showing the real layers, all five checks and 0 blocked writes.

| Task | Status |
| --- | --- |
| [task06 · MCP server and slices](task06-mcp-server.md) | done (Bob), fixes in the handoff pack |
| [task07 · shipped Bob config](task07-bob-config.md) | done (Bob), fixes in the handoff pack |
| [task08 · first ✂ Cleave run → M1](task08-first-run.md) | **next** |

Proven before handing over: the real MCP server, driven by a script the way Bob drives it,
split the Galaxium PR into 5 layers (15 atoms, 18 dependencies), all green on their own
(72/72/72/92/92 tests), top tree identical to the PR head, in 8 s; `cleave push` stored it
and the stack, Activity and proof pages rendered it.
