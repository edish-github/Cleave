# task12 · evaluation runs → M3

**Phase 6** (12:30–13:45) · **Budget:** ~8 Bobcoins (3–4 datasets × one Cleave run and one B1 run)
**Evidence:** `bob_sessions/SsnFall_task12_eval-<dataset>_summary.png` per Cleave run, bundles in `eval/runs/`

Needs task09 (`cleave eval baseline`) and task11 (`cleave eval build`, ground truth).

## For each dataset in `eval/datasets.toml`

Shown for `click-deprecated-params`; repeat for `click-completions`, `click-nosuchcommand`,
and optionally `galaxium-lint-pass` (use its `working_directory` and setup).

```bash
NAME=click-deprecated-params
BASE=2cabbe3175026695210fe0bf9b179fd62d52634f           # from datasets.toml
cd ~/cleave-eval/click
git checkout -q --detach "cleave-eval/$NAME"             # so Bob reads the constructed head
uv venv .venv --python 3.11 && uv pip install --python .venv "pytest<8.4"   # the dataset's setup
cleave init --check "PYTHONPATH=src python -m pytest -q -p no:cacheprovider"
git status --short                                       # only .bob/ and .cleave/
```

**Cleave run** — reload Bob IDE on this folder, switch to ✂ Cleave, send:

```
Cleave cleave-eval/click-deprecated-params onto 2cabbe3175026695210fe0bf9b179fd62d52634f
```

Screenshot the task summary, write `bob-stats.json`, then:

```bash
GT=~/Desktop/Cleave/eval/ground_truth/$NAME.json
cleave push --kind cleave --title "$NAME" --eval-group constructed --dataset "$NAME" \
  --ground-truth "$GT" --bob-stats bob-stats.json --repo-name pallets/click \
  --out ~/Desktop/Cleave/eval/runs/$NAME/cleave.bundle.json.gz
```

**B1 run** — same folder, Agent mode through `bob run`:

```bash
bob run --mode agent --format stream-json --max-cost 2 "Split the change between $BASE and
cleave-eval/$NAME into a stack of branches b1/1, b1/2, … (each branched from the previous
one, the first from $BASE). Every branch must pass the tests on its own
(PYTHONPATH=src python -m pytest -q), and the last branch must contain exactly the change of
cleave-eval/$NAME. Commit on those branches only." > ../$NAME-b1.ndjson
cleave eval baseline --base "$BASE" --head "cleave-eval/$NAME" --branches "b1/*"
cleave push --kind baseline_b1 --title "$NAME" --eval-group constructed --dataset "$NAME" \
  --ground-truth "$GT" --bob-stats b1-stats.json --repo-name pallets/click \
  --out ~/Desktop/Cleave/eval/runs/$NAME/baseline_b1.bundle.json.gz
git branch -D $(git branch --list 'b1/*')
```

`--repo-name` is needed because the clone's origin is the upstream repository. Evaluation
runs are public automatically: they appear on `/results` within a minute.

## Done when (M3)

`/results` on the deployment shows at least 3 rows with both runs, each linking to a public
proof, and `eval/runs/<dataset>/` has both bundles for each.

If Bobcoins run low: use the 5 held back and stop at 3 datasets.

## Commit (you)

`eval: Cleave and B1 runs on <n> constructed diffs (task12)` with the bundles and screenshots.
