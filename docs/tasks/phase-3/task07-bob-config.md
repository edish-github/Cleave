# task07 · the shipped Bob config — done

Built by Bob in `080e4ce`, `47cbf93`, `eba477a`, then brought up to the brief in `03c4a97`,
`9bba796`, `70f749b`, `8bc63da` and `cd515fe`:

- The guard allows questions and completion and blocks mode switches.
- `settings.json` has no `"matcher": "*"`, and each hook has a 10 s timeout.
- `cleave init` merges into an existing `.bob/`: it keeps the repository's own modes, MCP
  servers and hooks, writes `.cleave/.gitignore`, and installs the MCP entry as
  `<full path to cleave> mcp --repo <repo>`.

Screenshot: `bob_sessions/SsnFall_task07_bob-config_summary.png` (save it if you haven't).

Added in the handoff pack (specs in `tests/test_hooks.py`):

- The guard and the audit find the repository through `git rev-parse --show-toplevel`,
  share one implementation, and record the path, command or server behind a call, never
  file contents.
- `new_task` (Bob's subagent tool in Roo-style modes) is allowed, and so are MCP tool names
  prefixed with the cleave server.
- The procedure rule starts the run with `cleave_start` and ends with a summary. The plan
  and repair rules have an example with labels and a table of typical failures.

Still open (open checks C1, C3): the four files in `tests/payloads/` are hand-written. The
first real run records every tool call through the audit hook; task08's step 9 turns them
into answers.
