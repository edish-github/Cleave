# task11 · constructed diffs and metrics

**Phase 6** (11:45–12:30) · **Budget:** ~2 Bobcoins · **Evidence:** `bob_sessions/SsnFall_task11_eval-build_summary.png`

The datasets are chosen and checked already: `eval/datasets.toml` lists four windows of
real commits (three from `pallets/click`, one from the Galaxium fork), each with its base,
commits, paths, setup and check command. For every one, the tests pass at the base and at
the constructed head.

## Brief for Bob (Code mode, Cleave repository)

```
Task 11: build constructed diffs with ground truth, and compute run metrics.

Read AGENTS.md §1, the docstrings in packages/engine/src/cleave/eval/build_dataset.py and
eval/metrics.py, the spec packages/engine/tests/test_eval.py, and eval/datasets.toml.

Change only:
- packages/engine/src/cleave/eval/build_dataset.py
- packages/engine/src/cleave/eval/metrics.py
- packages/engine/src/cleave/cli.py      (`cleave eval build`, `cleave eval metrics`)
- packages/engine/pyproject.toml         (drop `and not eval` from the default markers once green)

Requirements:
1. load_datasets(path): read [[datasets]] with tomllib into Dataset objects.
2. build(repo, dataset): with a temporary GIT_INDEX_FILE, make the tree = dataset.base's tree
   with each of dataset.paths taken from the last commit (all of it when paths is empty);
   commit it with parent = base and fixed author/committer/date (so building twice gives
   the same sha); update-ref refs/heads/cleave-eval/<name>. Never touch HEAD or the
   working tree.
3. Ground truth: replay the commits one at a time (same path limit) as a private chain of
   commits; atomize base..head; each atom belongs to the first step whose diff touches the
   atom's file and line range (a new-file atom: the step that created the file). Return
   {atom_id: original commit sha} for every atom.
4. metrics(report, ground_truth): valid (all five checks pass and every layer green), green,
   layers, foreign_lines, largest_layer (added + removed), agreement = Rand index over atom
   pairs (None without ground truth).
5. `cleave eval build --datasets eval/datasets.toml --workdir DIR [--only NAME]`: clone each
   dataset's repo into DIR/<repo-name> if missing (`git clone`, then fetch the commits),
   build its branch, and write eval/ground_truth/<name>.json (next to datasets.toml) as
   {"dataset", "base", "head", "commits", "atoms": {atom_id: sha}}. Print one line per dataset.
6. `cleave eval metrics --run ID [--ground-truth FILE]` prints the metrics as JSON.

Check: uv run pytest -q -m eval && uv run pytest -q
Finish with a summary: files changed, tests passing, anything left undone.
```

## Then (you)

```bash
cd ~/Desktop/Cleave
cleave eval build --datasets eval/datasets.toml --workdir ~/cleave-eval
ls eval/ground_truth/          # one JSON per dataset
```

## Done when

`uv run pytest -q` is green with the eval specs in it, and `eval/ground_truth/` has a file
per dataset whose head sha matches the `cleave-eval/<name>` branch in `~/cleave-eval`.

## Commit (you)

`engine: constructed diffs, ground truth and metrics (task11)` and `eval: ground truth for the datasets`.
