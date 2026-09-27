# task11 · constructed diffs and metrics — done

**Phase 6** (11:45–12:30) · **Budget:** 0 Bobcoins

Done in the handoff pack. The spec is `tests/test_eval.py` (7 cases, in CI). The ground truth for all four datasets is in `eval/ground_truth/`.

- `cleave eval build --datasets eval/datasets.toml --workdir DIR [--only NAME…]` clones each
  dataset's repository into `DIR/<repo>` if needed and fetches the commits. It then builds
  `cleave-eval/<name>`: one commit on the dataset's base whose tree takes `paths` from the
  last commit. The build uses git plumbing only, with a fixed author, committer and dates.
  The same inputs always give the same sha, and HEAD and the working tree are never touched.
- The command writes `eval/ground_truth/<name>.json`: `{dataset, repo, base, head, branch,
  commits, atoms: {atom_id: original commit}}`. Each atom is attributed to the earliest
  replayed commit that produced it:
  - blame for added lines,
  - reverse blame for removed lines,
  - the commit that created, deleted or renamed the file, for whole-file atoms.
- `cleave eval metrics [--run ID] [--ground-truth FILE]` prints the /results metrics as JSON:
  - `valid`: all five checks pass and every layer is green;
  - `green`, `layers`, `foreign_lines`, `largest_layer`;
  - `agreement`: the Rand index against the original commits.

Built here on 27 Sep (identical on a rebuild):

| Dataset | Head | Atoms by original commit |
| --- | --- | --- |
| click-completions | `dc3dbd0acf58` | 108 (32 · 8 · 68) |
| click-deprecated-params | `0286eba0d93b` | 51 (28 · 13 · 3 · 7) |
| click-nosuchcommand | `f42c059db927` | 116 (15 · 43 · 44 · 14) |
| galaxium-lint-pass | `4886726a6c09` | 58 (49 · 7 · 2) |

## Then (you)

```bash
cd ~/Desktop/Cleave
cleave eval build --datasets eval/datasets.toml --workdir ~/cleave-eval
git diff --stat eval/ground_truth/     # empty: your build matches the committed ground truth
```

This clones `pallets/click` and the Galaxium fork into `~/cleave-eval` (a minute), and
leaves the four `cleave-eval/*` branches there for task12.

## Note on the click checks

The click check commands leave out two cases of `test_echo_via_pager` (the two "Exception in
generator …" cases, `test5`/`test6`, which run once per pager). They race the pager process
against the generator's exception. That makes them fail whenever two test runs share the
machine, and Cleave's verification runs layers in parallel. With those cases in, 2
concurrent runs of the same head failed 5 times out of 6. Without them, 21 of 21 passed. The
exact command is in `eval/datasets.toml`.
