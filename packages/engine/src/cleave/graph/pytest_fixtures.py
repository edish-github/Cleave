"""Pytest edges: a test that takes a fixture parameter needs the atom defining that fixture.

Fixtures are resolved by name from ``conftest.py`` files and test modules, the way pytest
resolves them. Kind: ``fixture``.
"""

from __future__ import annotations

import ast
from pathlib import Path

from ..gitio import git
from ..models import AtomsFile, Edge


def edges(repo: Path, atoms: AtomsFile) -> list[Edge]:
    res: list[Edge] = []
    seen: set[tuple[str, str, str]] = set()

    # Step 1: find all fixtures defined across python files
    fixtures: dict[str, str] = {}  # fixture_name -> atom_id

    for a in atoms.atoms:
        if not a.file.endswith(".py") or a.kind == "deleted_file":
            continue
        try:
            src = git(repo, "show", f"{atoms.head_sha}:{a.file}")
            tree = ast.parse(src)
        except Exception:
            continue

        num_lines = len(src.splitlines())
        lines = (
            range(a.new_start, a.new_start + max(a.new_len, 1))
            if a.kind == "hunk"
            else range(1, num_lines + 1)
        )

        for n in ast.walk(tree):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.lineno in lines:
                for d in n.decorator_list:
                    d_name = ""
                    if isinstance(d, ast.Name):
                        d_name = d.id
                    elif isinstance(d, ast.Attribute):
                        d_name = d.attr
                    elif isinstance(d, ast.Call):
                        if isinstance(d.func, ast.Name):
                            d_name = d.func.id
                        elif isinstance(d.func, ast.Attribute):
                            d_name = d.func.attr
                    if "fixture" in d_name:
                        fixtures[n.name] = a.id

    # Step 2: find test functions in test files that use fixtures
    for a in atoms.atoms:
        if not a.file.endswith(".py") or a.kind == "deleted_file":
            continue
        try:
            src = git(repo, "show", f"{atoms.head_sha}:{a.file}")
            tree = ast.parse(src)
        except Exception:
            continue

        num_lines = len(src.splitlines())
        lines = (
            range(a.new_start, a.new_start + max(a.new_len, 1))
            if a.kind == "hunk"
            else range(1, num_lines + 1)
        )

        for n in ast.walk(tree):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.lineno in lines:
                for arg in n.args.args:
                    if arg.arg in fixtures:
                        target_atom = fixtures[arg.arg]
                        if target_atom != a.id:
                            key = (a.id, target_atom, "fixture")
                            if key not in seen:
                                seen.add(key)
                                res.append(
                                    Edge(
                                        **{
                                            "from": a.id,
                                            "to": target_atom,
                                            "kind": "fixture",
                                            "symbol": arg.arg,
                                            "source": "static",
                                        }
                                    )
                                )

    return res

