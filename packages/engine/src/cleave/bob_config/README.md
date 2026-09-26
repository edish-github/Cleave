# Shipped Bob config

`cleave init` copies everything here (except this file) into the target repo's `.bob/`.
Built in Phase 3, in Bob IDE. The exact contents are in the product decision doc, section 8,
and rendered on `/docs/bob`.

| File | Job |
| --- | --- |
| `custom_modes.yaml` | ✂ Cleave mode: groups `[read, mcp, subagent, todo]`, `allowedSubagents: [explore]`; no edit, no execute |
| `mcp.json` | `cleave` server → `cleave mcp` (stdio); `alwaysAllow` = `cleave.mcp_server.TOOL_NAMES` |
| `settings.json` | PreToolUse → `hooks/guard.py`, PostToolUse → `hooks/audit.py` |
| `hooks/guard.py` | While `.cleave/active` exists: allow read tools, explore subagents, todo and `cleave` MCP calls; exit 2 on anything else. Accepts `tool`/`input` and `tool_name`/`tool_input` payloads |
| `hooks/audit.py` | Append every tool call to the active run's `events.ndjson` (`hook.allowed` / `hook.blocked`) |
| `rules-cleave/01-procedure.md` | status → slices → subagents → propose → verify → repair ≤ 3 → describe → finish |
| `rules-cleave/02-plan-schema.md` | The plan shape Bob sends to `cleave_propose_plan` |
| `rules-cleave/03-repair.md` | Reading a failing log → which atom to move |
