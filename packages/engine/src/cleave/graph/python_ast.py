"""Python edges: an atom that uses a name needs the atom that defines or imports it.

For each atom, parse the head version of its file with ``ast`` and find which top-level
definitions, class attributes and imports its added lines touch (``Symbols``). An edge
A -> B exists when A references a name B defines. Kinds: ``import`` (from/import
statements), ``call`` (function use), ``model`` (class or attribute use).
"""

from __future__ import annotations

import ast
from pathlib import Path

from ..gitio import git
from ..models import Atom, AtomsFile, Edge, Symbols


def symbols_for(source: str, atom: Atom) -> Symbols:
    """Names the atom's added lines define and reference, given the file's head source."""
    try:
        tree = ast.parse(source)
    except Exception:
        return Symbols(defines=[], references=[])

    num_lines = len(source.splitlines())
    lines = (
        range(atom.new_start, atom.new_start + max(atom.new_len, 1))
        if atom.kind == "hunk"
        else range(1, num_lines + 1)
    )

    defines: set[str] = set()
    references: set[str] = set()

    for n in ast.walk(tree):
        lineno = getattr(n, "lineno", None)
        if lineno is not None and lineno in lines:
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                defines.add(n.name)
            elif isinstance(n, ast.Assign):
                for t in n.targets:
                    if isinstance(t, ast.Name):
                        defines.add(t.id)
            elif isinstance(n, ast.AnnAssign):
                if isinstance(n.target, ast.Name):
                    defines.add(n.target.id)
            elif isinstance(n, (ast.Import, ast.ImportFrom)):
                for alias in n.names:
                    defines.add(alias.asname or alias.name)

            if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load):
                references.add(n.id)
            elif isinstance(n, ast.Attribute) and isinstance(n.ctx, ast.Load):
                references.add(n.attr)

    return Symbols(defines=sorted(defines), references=sorted(references))


def edges(repo: Path, atoms: AtomsFile) -> list[Edge]:
    res: list[Edge] = []
    seen: set[tuple[str, str, str]] = set()

    # Load head sources and compute symbols for all atoms
    head_sources: dict[str, str] = {}
    for a in atoms.atoms:
        if not a.file.endswith(".py") or a.kind == "deleted_file":
            continue
        if a.file not in head_sources:
            try:
                head_sources[a.file] = git(repo, "show", f"{atoms.head_sha}:{a.file}")
            except Exception:
                continue
        a.symbols = symbols_for(head_sources[a.file], a)

    # 1. Imports across files
    for a in atoms.atoms:
        if not a.file.endswith(".py") or a.kind == "deleted_file":
            continue
        src = head_sources.get(a.file)
        if not src:
            continue
        try:
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
            if isinstance(n, ast.ImportFrom) and n.lineno in lines and n.module:
                mod_path = n.module.replace(".", "/")
                for alias in n.names:
                    name = alias.name
                    submod = f"{mod_path}/{name}.py"
                    mod_file = f"{mod_path}.py"
                    mod_init = f"{mod_path}/__init__.py"
                    for other in atoms.atoms:
                        if other.id == a.id:
                            continue
                        f = other.file
                        is_match = False
                        if f == submod or f.endswith("/" + submod):
                            is_match = True
                        elif f == mod_file or f.endswith("/" + mod_file) or f == mod_init or f.endswith("/" + mod_init):
                            if other.kind == "new_file" or (other.symbols and name in other.symbols.defines):
                                is_match = True

                        if is_match:
                            key = (a.id, other.id, "import")
                            if key not in seen:
                                seen.add(key)
                                res.append(
                                    Edge(
                                        **{
                                            "from": a.id,
                                            "to": other.id,
                                            "kind": "import",
                                            "symbol": name,
                                            "source": "static",
                                        }
                                    )
                                )

    # 2. Within same file
    for a in atoms.atoms:
        if not a.symbols:
            continue
        for ref in a.symbols.references:
            for other in atoms.atoms:
                if other.id == a.id or other.file != a.file:
                    continue
                if other.symbols and ref in other.symbols.defines:
                    kind = "model" if (ref and ref[0].isupper() and "_" not in ref) else "call"
                    key = (a.id, other.id, kind)
                    if key not in seen:
                        seen.add(key)
                        res.append(
                            Edge(
                                **{
                                    "from": a.id,
                                    "to": other.id,
                                    "kind": kind,
                                    "symbol": ref,
                                    "source": "static",
                                }
                            )
                        )

    return res

