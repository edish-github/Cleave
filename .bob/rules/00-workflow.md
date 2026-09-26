# Workflow (every task)

- Start by reading `AGENTS.md` §1 (rules) and your task's entry in §5 (files, spec, check, done when).
- Change only the files the task lists. If more are needed, stop and say which and why.
- Run the task's check command before finishing and show its output. Don't finish on red.
- Never edit, skip or delete a test to make it pass.
- End with a short summary: files changed, tests now passing, anything left undone. That summary is the evidence screenshot (`bob_sessions/SsnFall_taskNN_<desc>_summary.png`).
- No secrets in files or prompts. No network access from engine code outside `push.py`, `publish.py` and `runner/`.
