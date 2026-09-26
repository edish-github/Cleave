# Cleave

**Large pull requests, reviewed as small, proven steps.**

Agents write pull requests too big to review. Cleave splits one into a stack of small pull
requests. Every layer passes your tests on its own, and the last layer is byte-identical to
the original change. IBM Bob decides how the hunks are grouped and ordered, but it has no
tool that can write code, so the worst a bad plan can do is fail to verify. It can't produce
a wrong stack.

## How it works

1. **Map.** The engine cuts the diff into atoms (one hunk, or one whole file) and builds a
   dependency graph from the code: imports, calls, models, pytest fixtures.
2. **Layer.** In the ✂ Cleave mode, Bob reads the diff in parallel slices with read-only
   explore subagents and proposes ordered layers. Its only write surface is eleven MCP tools
   that move atoms between layers.
3. **Prove.** Every prefix of the stack is built in its own worktree and runs your check
   command. A failing layer sends Bob its log; Bob moves atoms and tries again, up to three
   rounds, then merges the two layers instead of writing glue code.

Five checks decide whether a stack is done:

| Check | Holds when |
| --- | --- |
| Atom coverage | Every change appears in exactly one layer |
| Dependency order | Nothing depends on a later layer |
| Tree fidelity | The last layer's git tree equals the pull request's |
| Layer shippability | Each layer passes the check command on its own |
| No new code | 0 lines in the stack that weren't in the original |

## Repository

| Path | What |
| --- | --- |
| [`schemas/`](schemas) | JSON Schemas shared by the engine and the web app |
| [`packages/engine/`](packages/engine) | The `cleave` CLI, MCP server and Bob hooks (Python) |
| [`apps/web/`](apps/web) | Stack pages, public proof pages and the ingest API (Next.js) |
| [`demo/galaxium.md`](demo/galaxium.md) | The demo pull request and how to reproduce it |
| [`bob_sessions/`](bob_sessions) | Bob IDE task-session screenshots |

## Quick start

```bash
# Engine
cd packages/engine && uv sync --extra dev && uv run pytest -q -m "not integration"

# Web app (sample workspace, no backend needed)
cd apps/web && cp .env.example .env.local && npm install && npm run dev
```

Setting up the ✂ Cleave mode in Bob IDE: the `/docs/bob` page of the web app, or run
`cleave init` in the repository you want to split. How work is organised by phase, and how
each phase is tested, is in [`AGENTS.md`](AGENTS.md).

## Status

Built for the IBM Bob Hackathon (lablab.ai, September 2026). The web frontend and contracts
are complete; the engine is being built in Bob IDE against the specs in
`packages/engine/tests/`.

## License

MIT
