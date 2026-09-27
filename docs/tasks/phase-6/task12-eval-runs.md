# task12 · evaluation runs → M3

**Phase 6** (12:30–13:45) · **Budget:** ~8 Bobcoins (3–4 datasets × one Cleave run and one B1 run)
**Evidence:** `bob_sessions/SsnFall_task12_eval-<dataset>_summary.png` per Cleave run, bundles in `eval/runs/`

Needs task11 (`cleave eval build`: the `cleave-eval/*` branches in `~/cleave-eval/click`).
All engine commands used here are in the handoff pack and tested.

## For each dataset in `eval/datasets.toml`

Shown for `click-deprecated-params`; repeat for `click-completions`, `click-nosuchcommand`,
and optionally `galaxium-lint-pass` (clone `~/cleave-eval/galaxium-travels`, its
`working_directory` is `booking_system_backend`, its check `python -m pytest -q`).

```bash
NAME=click-deprecated-params
BASE=2cabbe3175026695210fe0bf9b179fd62d52634f           # from datasets.toml
CHECK='PYTHONPATH=src python -m pytest -q -p no:cacheprovider -k "not (test_echo_via_pager and (test5 or test6))"'
cd ~/cleave-eval/click
git checkout -q --detach "cleave-eval/$NAME"             # so Bob reads the constructed head
uv venv .venv --python 3.11 && uv pip install --python .venv "pytest<8.4"   # once per clone
cleave init --check "$CHECK"
git status --short                                       # only .bob/ and .cleave/
```

Keep the check in single quotes as above: `cleave init` stores it exactly (quotes included).

**Cleave run** — reload Bob IDE on this folder, switch to ✂ Cleave, send:

```
Cleave cleave-eval/click-deprecated-params onto 2cabbe3175026695210fe0bf9b179fd62d52634f
```

Expect a repair here: a "library first, tests second" plan fails layer 1 (the new code
breaks 7 old tests until the updated tests arrive), which is the case Cleave exists for.
Screenshot the task summary, write `bob-stats.json` (`{"surface": "ide", "mode": "cleave",
"bobcoins": …}`), then:

```bash
GT=~/Desktop/Cleave/eval/ground_truth/$NAME.json
cleave eval metrics --ground-truth "$GT"                 # valid, green, foreign lines, agreement
cleave push --kind cleave --title "$NAME" --eval-group constructed --dataset "$NAME" \
  --ground-truth "$GT" --bob-stats bob-stats.json --repo-name pallets/click \
  --out ~/Desktop/Cleave/eval/runs/$NAME/cleave.bundle.json.gz
```

**B1 run** — same folder, Agent mode through `bob run`:

```bash
bob run --mode agent --format stream-json --max-cost 2 "Split the change between $BASE and
cleave-eval/$NAME into a stack of branches b1/1, b1/2, … (each branched from the previous
one, the first from $BASE). Every branch must pass the tests on its own
($CHECK), and the last branch must contain exactly the change of cleave-eval/$NAME.
Commit on those branches only." > ../$NAME-b1.ndjson
git checkout -q --detach "cleave-eval/$NAME"
cleave eval baseline --base "$BASE" --head "cleave-eval/$NAME" --branches "b1/*"
cleave push --kind baseline_b1 --title "$NAME" --eval-group constructed --dataset "$NAME" \
  --ground-truth "$GT" --bob-stats b1-stats.json --repo-name pallets/click \
  --out ~/Desktop/Cleave/eval/runs/$NAME/baseline_b1.bundle.json.gz
git branch -D $(git branch --list 'b1/*' | tr -d ' *')
```

`b1-stats.json`: `{"surface": "bob_run", "mode": "agent", "bobcoins": …}`.

`--repo-name` is needed because the clone's origin is the upstream repository. Evaluation
runs are public automatically: they appear on `/results` within a minute.

## If a check fails inside Bob but passes in your terminal

Bob starts `cleave mcp` itself, and MCP clients often give servers a reduced environment
(PATH and HOME, not your shell's other variables). If the check needs a variable, add it to
the `cleave` entry in `.bob/mcp.json`:

```json
"cleave": { "command": "…/cleave", "args": ["mcp", "--repo", "…"], "env": { "MY_VAR": "value" } }
```

## Done when (M3)

`/results` on the deployment shows at least 3 rows with both runs, each linking to a public
proof, and `eval/runs/<dataset>/` has both bundles for each.

If Bobcoins run low: use the 5 held back and stop at 3 datasets.

## Commit (you)

`eval: Cleave and B1 runs on <n> constructed diffs (task12)` with the bundles and screenshots.
