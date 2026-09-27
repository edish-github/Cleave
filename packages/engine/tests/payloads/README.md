# Real Bob hook payloads (open checks C1, C3)

One JSON file per captured call, named `<event>-<tool>.json`, e.g. `pre-read_file.json`,
`pre-use_mcp_tool-cleave.json`, `pre-write_file.json`:

```json
{
  "payload": { "…": "exactly what Bob sent on stdin, unedited" },
  "expect": "allow"
}
```

`expect` is what the guard must do while a Cleave run is active: `allow` for reads, todos,
subagents, questions, completion and `cleave` MCP calls; `block` for writes, commands,
mode switches and other MCP servers. `uv run pytest -q -m bob` replays every file
through `bob_config/hooks/guard.py`. How to get them from a real run: `docs/tasks/phase-3/task08-first-run.md`, step 9.
