# Phase 8 · submission (15:00–18:00; submit by 19:30 IST)

Nothing here spends Bobcoins. Items marked **(you)** need your accounts, voice or screen.

## 1. Evidence in the repository

- [ ] `bob_sessions/`: one summary screenshot per Bob task, `SsnFall_taskNN_<desc>_summary.png`
      (task01–task13 as done; the task08 and task12 runs included). **(you)**
- [ ] `demo/runs/galaxium-pr1.bundle.json.gz` and `eval/runs/<dataset>/*.bundle.json.gz` committed.
- [ ] `eval/open-checks.md` answers C1–C6; `eval/baselines/` has both B1 runs.
- [ ] `demo/galaxium.md` links the public proof of the M1 run and the stacked PRs (M2).

## 2. Real screenshots on the landing page

`apps/web/src/lib/assets.ts` still points at two placeholders. Replace each `src` with a
file in `apps/web/public/images/`, same aspect ratio: **(you take them, anyone wires them)**

| Key | What to capture | Size |
| --- | --- | --- |
| `landingStackScreenshot` | the M1 stack's overview page in the deployed app | 2400 × 1500 |
| `landingBobScreenshot` | Bob IDE in ✂ Cleave during a run, subagents visible | 1200 × 900 |

## 3. README (root)

- [ ] One-paragraph summary (keep the current opening).
- [ ] **Evidence** table: M1 proof URL, M2 pull requests, `/results`, `bob_sessions/`, CI badge.
- [ ] **Results**: the `/results` numbers, copied from the page, with the date.
- [ ] **Reproduce**: `docs/tasks/deploy.md`, `demo/galaxium.md`, `uv run pytest -q`.
- [ ] How Bob is used: the ✂ Cleave mode (no edit/execute), 11 MCP tools, guard and audit
      hooks, explore subagents, `bob run` for the baseline. Link `/docs/bob`.

## 4. Submission assets (lablab form)

- [ ] Title and one-line description: "Cleave — large pull requests, reviewed as small, proven steps."
- [ ] Long description: problem, how it works (map / layer / prove), what Bob does and can't
      do, the five checks, results vs B1, links.
- [ ] Cover image (1920×1080) in `asset/img/`.
- [ ] Slides (≤ 10): problem, why Bob, how it works, the guard, demo proof, results, what's next.
- [ ] Video ≤ 3 min, ≥ 90 s of the product running: **(you record)**
  1. 0:00 the problem: a 1,000-line PR (Galaxium #1) — 15 s
  2. 0:15 Bob IDE, ✂ Cleave: start, subagents, plan, verify, a repair — 60 s
  3. 1:15 the stack page and the public proof: five checks, tree hashes, hook audit — 40 s
  4. 1:55 the stacked PRs on GitHub, green — 20 s
  5. 2:15 `/results`: Cleave vs B1 — 25 s
  6. 2:40 close: what Bob can't do in this mode, and why that's the point — 15 s
- [ ] GitHub repo link, demo URL (the deployment), team **SsnFall**.

## 5. Final checks (18:00–19:30)

- [ ] CI green on `main` (engine and web).
- [ ] Every link in the README and the form opens signed out.
- [ ] The deployment's landing page links the live proof, not the sample.
- [ ] No secrets or private data in the repo (`git grep -n "clv_\|AUTH_\|postgres://"` shows only docs and examples).
- [ ] Submit on lablab.ai. **(you)**
