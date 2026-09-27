# task06 · slices and the MCP server — done

Built by Bob in `1a1def4` (`engine: serve cleave tools over mcp stdio (task06)`); `cleave mcp --repo`
and `CLEAVE_RUN_ID` followed in `8bc63da`.
Screenshot: `bob_sessions/SsnFall_task06_mcp-server_summary.png` (save it if you haven't).

Fixed afterwards in the handoff pack, each with a spec in `tests/test_mcp.py`:

- **"No new code" measured nothing:** `cleave_finish` hard-coded `foreign_lines=0`. It now
  uses `build.foreign_lines`.
- **A refused start locked the repo:** a failed `cleave_start` (dirty tree, unknown ref) left
  `.cleave/active` behind, and the guard then blocks writes in every mode. The run now opens
  only after atomize succeeds.
- **Long rounds timed out:** `cleave_verify` ran in the foreground, so a round longer than
  Bob's ~60 s MCP timeout would fail. It now answers `pending` after 50 s, and
  `cleave_verify_status` polls.
- **PR diff semantics:** the split is taken against the merge base of base and head, like a
  pull request. A branch that was only fetched resolves through `origin/<name>`.
- **Engine events for the Activity tab:** `run.started`, `atoms.cut`, `graph.built`,
  `slices.written`, `plan.proposed`, `atoms.moved`, `layer.described` and `run.finished`.
  Tool arguments sit under `payload.arguments`.
- **Branch names:** `cleave/*` branches are named after the head branch and built once, at finish.
- **Bob started elsewhere:** `cleave mcp` without `--repo` serves the git top level of the
  directory it was started in.
