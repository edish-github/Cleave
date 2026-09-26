# Engine rules (packages/engine)

- Python 3.11, managed with uv. Run `uv run pytest -q -m "not integration and not bob and not runner"` before finishing a task, plus the check command your task names in AGENTS.md §5.
- The tests in `packages/engine/tests/` are the specification. Change `src/` until they pass. Never edit a test to make it pass.
- Shapes come from `cleave.models`, which mirrors `/schemas`. Don't add fields in one without the other.
- Git access only through `cleave.gitio`. Never run commands that change the working tree, the index or HEAD of the repository being split (no checkout, reset, stash, commit on the current branch). Use a temporary `GIT_INDEX_FILE`, `commit-tree`, `update-ref` and worktrees in a temp directory.
- Atoms are immutable. Only their layer assignment changes.
- Write events with `cleave.events.EventLog`, never by hand.
- Keep functions small and typed. Prefer the standard library. No network access except in `push.py`.
