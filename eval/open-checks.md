# Open Checks C1–C6

Results of empirical validation across Bob IDE, the engine, GitHub CLI, and the evaluation suite.

| Check | Question | Result | Evidence |
| --- | --- | --- | --- |
| **C1** | Real hook payload shape | Verified | Payloads follow standard PreToolUse structure: `{"tool": "<name>", "tool_input": {...}}`. Engine extracts `tool` and `detail` for auditing and security policy enforcement. |
| **C2** | Inference API key in Bob web portal | Available | API keys can be generated from the Bob account settings for programmatic inference and headless runs. |
| **C3** | MCP tool naming convention in Bob | Verified | Bob registers MCP tools with the `cleave_` prefix matching `.bob/mcp.json` definitions: `cleave_start`, `cleave_propose_plan`, `cleave_verify`, `cleave_finish`. |
| **C4** | Bob CLI mode flag for custom modes | Verified | `--mode cleave` correctly loads the custom mode configuration from `.bob/custom_modes.yaml`. Used in `cleave/runner/bobshell.py`. |
| **C5** | Subagent and cost telemetry stream events | Verified | Bob streaming events emit `tool_use`, `assistant_message`, and final `cost_summary` detailing duration and Bobcoin expenditure. |
| **C6** | Stacked vs Chained PRs via `gh-stack` | Settled | `github/gh-stack` extension installed and verified (`has_gh_stack` returns `True`). Chained PRs are universal and default (`--method auto` / `--method chained`); stacked PRs via `gh stack submit` are fully supported where `gh-stack` is installed. |
