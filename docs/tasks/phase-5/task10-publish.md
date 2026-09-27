# task10 · publish the stack as pull requests → M2

**Phase 5** (10:45–11:45) · **Budget:** 1 Bobcoin · **Evidence:** `bob_sessions/SsnFall_task10_publish_summary.png`

## Fork prep (once, before task08's run — it's task08's step 0)

GitHub runs a `pull_request` workflow from the PR's merge commit. In a chained stack, layer
n's PR merges into layer n-1's branch, so the workflow file must already be in the commit
the stack is built on. The Galaxium fork has no test workflow (only `bob-review.yml`, which
needs a Bob API key the fork doesn't have and would mark every PR red).

1. Add `docs/tasks/phase-5/galaxium-backend-tests.yml` to the fork's `main` as
   `.github/workflows/backend-tests.yml` and push.
2. In the fork: Actions → **🤖 Bob Review** → ⋯ → Disable workflow.
3. `git checkout feat/loyalty-and-seat-upgrades && git merge main && git push`.
   PR #1's diff stays the same (GitHub diffs against the merge base); Cleave now splits
   against that same merge base, which contains the workflow.
4. `gh auth login` on your machine (publish uses `gh`).

## Brief for Bob (Code mode, Cleave repository)

```
Task 10: publish a verified stack as chained pull requests.

Read AGENTS.md §1, packages/engine/src/cleave/publish.py and the spec
packages/engine/tests/test_publish.py (it replaces `gh` with a recording stand-in and uses a
local bare repository as origin).

Change only:
- packages/engine/src/cleave/publish.py
- packages/engine/src/cleave/cli.py          (`cleave publish --base <branch> [--run ID] [--method auto|chained|stacked] [--remote origin]`)
- .github/workflows/ci.yml                    (drop `and not publish` from the default markers
                                               in packages/engine/pyproject.toml once green)

Requirements:
1. publish(repo, report, base_branch, remote="origin", method="auto") -> Publish.
   Refuse (ValueError) unless report.status == "verified".
2. Push every layer branch (report.layers[i].branch) to the remote with plain `git push`
   of explicit refspecs; never check out, reset or commit.
3. method "chained": one `gh pr create --head <branch> --base <base> --title <t> --body <b>`
   per layer, in order; layer 1's base is base_branch, layer n's base is layer n-1's branch.
   Title "<n>/<k> · <layer name>", body: the layer's description (or rationale), its line
   counts, and "Part <n> of a stack split by Cleave; every layer passes the tests on its own."
   Parse the number from the URL gh prints.
4. method "auto": "stacked" when `gh extension list` shows gh-stack (open check C6), else
   "chained". Implement "stacked" only if C6 said yes; otherwise auto always means chained.
5. `cleave publish` writes the result into report.json (report.publish), rewrites report.md,
   and emits stack.published with {"pull_requests": k}.

Check: uv run pytest -q -m publish && uv run pytest -q
Finish with a summary: files changed, tests passing, anything left undone.
```

## Then, for real (you)

```bash
cd ~/galaxium-travels
cleave publish --base main
cleave push --title "Loyalty tiers & seat upgrades" --pr 1 \
  --head-branch feat/loyalty-and-seat-upgrades --base-branch main --bob-stats bob-stats.json
```

Re-pushing the same run replaces it, and the stack becomes **published**: the Published tab
lists the PRs with links and refreshes CI badges while checks are pending.

## Done when (M2)

The stacked PRs are open on the fork, each with a green **Backend tests** check, and the
stack's Published tab shows them.

## Commit (you)

`engine: publish stacks as chained pull requests (task10)` + the screenshot.
