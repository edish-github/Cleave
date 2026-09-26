"""Spec for atomize.py, build.py and gitio.py.

The core guarantee: any prefix of a valid plan builds, the last layer's tree equals the
head tree, and nothing touches the user's working tree.
"""

from __future__ import annotations

import pytest

from cleave.atomize import atom_id, atomize
from cleave.build import build_stack, foreign_lines, prefix_trees, slugify
from cleave.models import AtomsFile, Plan, PlanLayer

from .conftest import FixtureRepo, git


def _by_file(atoms: AtomsFile) -> dict[str, list]:
    out: dict[str, list] = {}
    for a in atoms.atoms:
        out.setdefault(a.file, []).append(a)
    return out


def _plan(*layers: tuple[str, list[str]]) -> Plan:
    return Plan(version=0, author="engine", layers=[PlanLayer(name=n, atoms=ids) for n, ids in layers])


def _ids(atoms: AtomsFile, *files: str) -> list[str]:
    return [a.id for a in atoms.atoms if a.file in files]


def _file_layers(atoms: AtomsFile) -> Plan:
    """A sensible 4-layer plan: models, new modules, service, tests."""
    return _plan(
        ("Models", _ids(atoms, "app/models.py", "app/legacy.py")),
        ("Loyalty module", _ids(atoms, "app/loyalty.py", "app/logo.bin", "docs/notes.txt")),
        ("Service", _ids(atoms, "app/service.py")),
        ("Tests", _ids(atoms, "tests/conftest.py", "tests/test_loyalty.py")),
    )


def test_header_names_base_head_and_head_tree(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    assert atoms.base_sha == repo.base
    assert atoms.head_sha == repo.head
    assert atoms.head_tree == repo.tree(repo.head)


def test_ids_are_stable_unique_and_content_addressed(repo: FixtureRepo) -> None:
    first = atomize(repo.path, repo.base, repo.head)
    second = atomize(repo.path, repo.base, repo.head)
    assert [a.id for a in first.atoms] == [a.id for a in second.atoms]
    assert len({a.id for a in first.atoms}) == len(first.atoms)
    assert all(a.id == atom_id(a.file, a.patch) for a in first.atoms)


def test_whole_file_changes_are_single_atoms(repo: FixtureRepo) -> None:
    files = _by_file(atomize(repo.path, repo.base, repo.head))
    assert [a.kind for a in files["app/loyalty.py"]] == ["new_file"]
    assert [a.kind for a in files["tests/test_loyalty.py"]] == ["new_file"]
    assert [a.kind for a in files["app/legacy.py"]] == ["deleted_file"]
    assert [a.kind for a in files["app/logo.bin"]] == ["binary"]
    (rename,) = files["docs/notes.txt"]
    assert rename.kind == "rename"
    assert rename.old_file == "app/notes.txt"


def test_modified_files_split_into_hunks(repo: FixtureRepo) -> None:
    files = _by_file(atomize(repo.path, repo.base, repo.head))
    for path in ("app/models.py", "app/service.py", "tests/conftest.py"):
        assert len(files[path]) >= 2, path
        assert {a.kind for a in files[path]} == {"hunk"}
        assert all(a.patch.startswith("@@ ") for a in files[path])


def test_line_counts_match_git_numstat(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    added = removed = 0
    for line in git(repo.path, "diff", "--numstat", "-M", repo.base, repo.head).splitlines():
        a, r, _ = line.split("\t", 2)
        if a != "-":
            added, removed = added + int(a), removed + int(r)
    text_atoms = [a for a in atoms.atoms if a.kind != "binary"]
    assert sum(a.added for a in text_atoms) == added
    assert sum(a.removed for a in text_atoms) == removed


def test_test_files_are_flagged(repo: FixtureRepo) -> None:
    for atom in atomize(repo.path, repo.base, repo.head).atoms:
        assert atom.is_test == atom.file.startswith("tests/"), atom.file


def test_dirty_working_tree_is_refused(repo: FixtureRepo) -> None:
    (repo.path / "app" / "service.py").write_text("# uncommitted\n")
    with pytest.raises(ValueError):
        atomize(repo.path, repo.base, repo.head)


def test_single_layer_rebuild_equals_head_tree(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    trees = prefix_trees(repo.path, atoms, _plan(("Everything", [a.id for a in atoms.atoms])))
    assert trees == [repo.tree(repo.head)]


def test_every_prefix_builds_and_the_top_equals_head(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    trees = prefix_trees(repo.path, atoms, _file_layers(atoms))
    assert len(trees) == 4
    assert len(set(trees)) == 4
    assert trees[-1] == repo.tree(repo.head)


def test_hunks_of_one_file_can_land_in_different_layers(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    models = _ids(atoms, "app/models.py")
    rest = [a.id for a in atoms.atoms if a.id not in models]
    # Later hunk first, earlier hunks second: line numbers must be recomputed per prefix.
    plan = _plan(("Late hunk", [models[-1]]), ("Early hunks", models[:-1]), ("Rest", rest))
    assert prefix_trees(repo.path, atoms, plan)[-1] == repo.tree(repo.head)


def test_building_never_touches_the_working_tree(repo: FixtureRepo) -> None:
    head_before = git(repo.path, "rev-parse", "HEAD")
    branch_before = git(repo.path, "rev-parse", "--abbrev-ref", "HEAD")
    atoms = atomize(repo.path, repo.base, repo.head)
    build_stack(repo.path, atoms, _file_layers(atoms), slug="loyalty-tiers")
    assert repo.status() == ""
    assert git(repo.path, "rev-parse", "HEAD") == head_before
    assert git(repo.path, "rev-parse", "--abbrev-ref", "HEAD") == branch_before


def test_build_stack_chains_commits_on_named_branches(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    plan = _file_layers(atoms)
    built = build_stack(repo.path, atoms, plan, slug="loyalty-tiers")
    trees = prefix_trees(repo.path, atoms, plan)
    parent = repo.base
    for i, (layer, spec) in enumerate(zip(built, plan.layers), start=1):
        assert layer.index == i
        assert layer.branch == f"cleave/loyalty-tiers/{i}-{slugify(spec.name)}"
        assert git(repo.path, "rev-parse", f"refs/heads/{layer.branch}") == layer.commit
        assert git(repo.path, "rev-parse", f"{layer.commit}^") == parent
        assert layer.tree == trees[i - 1]
        parent = layer.commit


def test_foreign_lines_are_zero_when_the_top_matches(repo: FixtureRepo) -> None:
    atoms = atomize(repo.path, repo.base, repo.head)
    assert foreign_lines(repo.path, atoms, repo.tree(repo.head)) == 0
    assert foreign_lines(repo.path, atoms, repo.tree(repo.base)) > 0


@pytest.mark.parametrize(
    ("text", "slug"),
    [
        ("Loyalty tiers & seat upgrades", "loyalty-tiers-seat-upgrades"),
        ("  API  changes ", "api-changes"),
        ("Données & café", "donnees-cafe"),
    ],
)
def test_slugify(text: str, slug: str) -> None:
    assert slugify(text) == slug


def test_slugify_caps_length() -> None:
    assert len(slugify("word " * 40, max_len=20)) <= 20
