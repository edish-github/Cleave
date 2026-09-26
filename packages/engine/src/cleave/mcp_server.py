"""The Cleave MCP server: Bob's only write surface.

Eleven tools, served over stdio by ``cleave mcp``. None of them can change source files:
the ones that write touch ``.cleave/`` or build ``cleave/*`` branches from existing hunks.
Every call is logged as an ``mcp.called`` event.

Spec: tests/test_mcp.py. The names below must match bob_config/mcp.json ``alwaysAllow``.
"""

from __future__ import annotations

from pathlib import Path

TOOL_NAMES: tuple[str, ...] = (
    "cleave_start",
    "cleave_status",
    "cleave_atoms",
    "cleave_graph",
    "cleave_propose_plan",
    "cleave_move_atoms",
    "cleave_verify",
    "cleave_verify_status",
    "cleave_read_log",
    "cleave_describe_layer",
    "cleave_finish",
)

VERIFY_PENDING_AFTER_S = 50
"""MCP calls time out after about a minute in Bob; a longer verify returns ``pending``."""


def create_server(repo: Path):
    """Return a FastMCP server bound to ``repo`` with exactly the tools in ``TOOL_NAMES``.

    Tool contracts (arguments -> result):

    - cleave_start(base, head) -> {run_id, atoms, files, slices: [paths]}
    - cleave_status() -> {run_id, atoms, plan_version, last_round, last_result}
    - cleave_atoms(slice?) -> [{id, file, kind, added, removed, symbols}]
    - cleave_graph(atom_id?) -> {edges, groups}
    - cleave_propose_plan(layers: [{name, rationale, atoms}], labels?) -> {version, violations}
    - cleave_move_atoms(ids, to_layer, reason) -> {version, violations}
    - cleave_verify() -> {round, status: "pass"|"fail"|"pending", layers: [...], top_tree_matches}
    - cleave_verify_status(round) -> same shape as cleave_verify
    - cleave_read_log(layer, round) -> {excerpt, failure}
    - cleave_describe_layer(n, title, body) -> {ok}
    - cleave_finish() -> {status, report_path}
    """
    raise NotImplementedError


def main() -> None:
    """Entry point for ``cleave mcp``: serve ``create_server(Path.cwd())`` over stdio."""
    create_server(Path.cwd()).run()
