# task10 · publish the stack as pull requests → M2

**Phase 5** (10:45–11:45) · **Budget:** 0 Bobcoins · **Evidence:** the PRs on the fork and the Published tab

The code is done (handoff pack; spec `tests/test_publish.py`, 7 cases, in CI):

- `cleave publish --base main [--run ID] [--remote origin] [--method auto|chained]` refuses
  anything but a `verified` run.
- It pushes every `cleave/*` layer branch with `git push --force-with-lease` of explicit
  refspecs (no checkout, reset or commit), then opens one PR per layer with `gh pr create`:
  layer 1 into `main`, layer n into layer n-1's branch.
- Titles are `n/k · <layer name>`; bodies carry the layer's description, its line counts, the
  check command and the run id.
- It writes the PRs into `report.json` (`report.publish`), rewrites `report.md` and adds a
  `stack.published` event, so the next `cleave push` makes the stack **published**.
- `--method stacked` (gh-stack) is refused until open check C6 settles its commands. `auto`
  means chained.

## Fork prep (once, before task08's run: it's task08's step 0)

GitHub runs a `pull_request` workflow from the PR's merge commit. In a chained stack, layer
n's PR merges into layer n-1's branch, so the workflow file must already be in the commit
the stack is built on. The Galaxium fork has no test workflow (only `bob-review.yml`, which
needs a Bob API key the fork doesn't have and would mark every PR red).

1. Add `docs/tasks/phase-5/galaxium-backend-tests.yml` to the fork's `main` as
   `.github/workflows/backend-tests.yml` and push.
2. In the fork: Actions → **🤖 Bob Review** → ⋯ → Disable workflow.
3. `git checkout feat/loyalty-and-seat-upgrades && git merge main && git push`.
   PR #1's diff stays the same (GitHub diffs against the merge base); Cleave splits against
   that same merge base, which contains the workflow.
4. `gh auth login` on your machine (publish uses `gh`), and `gh auth setup-git` so `git push`
   uses the same login.

## Run it (you)

```bash
cd ~/galaxium-travels
cleave publish --base main            # the latest run; --run <id> for another
cleave push --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main --bob-stats bob-stats.json
```

It prints one line per layer (`layer 1: #2 https://github.com/…/pull/2 (into main)`).
Re-pushing the same run replaces it; the Published tab lists the PRs with links and
refreshes CI badges while checks are pending.

If a step fails halfway (for example `gh` isn't logged in after the push), fix it and run
`cleave publish` again: the push is idempotent, and a layer branch that already has an open
PR keeps it (its base is corrected if needed) instead of getting a second one.

## Done when (M2)

The stacked PRs are open on the fork, each with a green **Backend tests** check, and the
stack's Published tab shows them.

## Commit (you)

Nothing new to commit (the code is in the pack); screenshot the Published tab for the video.
