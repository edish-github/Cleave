#!/usr/bin/env python3
"""Bob PostToolUse audit hook for the ✂ Cleave mode.

Appends one hook.allowed event per completed tool call to the active run's
events.ndjson, with the tool name and the path, command or server it touched (never
file contents). Silent and a no-op without an active run; always exits 0.

Standard library only, Python 3.9 compatible.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from guard import active_run, log_event, read_payload, repo_root, subject  # noqa: E402


def main() -> None:
    try:
        tool, args = read_payload()
        root = repo_root()
        run_id = active_run(root)
        if run_id:
            log_event(root, run_id, "hook.allowed", tool, {"detail": subject(tool, args)})
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
