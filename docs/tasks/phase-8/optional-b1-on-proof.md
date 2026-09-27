# optional · show B1 next to Cleave on the proof page

**When:** only if Phase 8 has slack after M4's must-haves. **Who:** an IDE agent (or Bob in
Code mode). **Budget:** ~1 Bobcoin if Bob does it.

Today a PR baseline (`cleave push --kind baseline_b1 … --pr 1`) is stored with the demo stack,
but only `/results` shows B1 beside Cleave. Judges who open the demo proof page would see the
comparison right where the claim is made.

## Brief

```
Task: on /proof/<stackId> and the stack Overview, show the latest B1 baseline run of the
same stack next to the Cleave run, when there is one.

Read AGENTS.md §1, apps/web/src/services/live/client.ts (loadStack, getEvalResults),
apps/web/src/server/ingest.ts (baseline runs: kind "baseline_b1", never latestRunId),
apps/web/src/lib/eval.ts and apps/web/src/app/proof/[stackId]/page.tsx.

Change only:
- apps/web/src/lib/types.ts                (Stack gets `baseline: BaselineSummary | null`)
- apps/web/src/services/live/client.ts     (loadStack: newest run of kind baseline_b1 for the stack)
- apps/web/src/services/sample/*           (baseline: null, or the sample's own if it has one)
- apps/web/src/components/stack/BaselineCompare.tsx (new)
- apps/web/src/app/proof/[stackId]/page.tsx and the stack Overview page

Requirements:
1. BaselineSummary = the five checks (id, status, value) of the baseline report, its layer
   count, green layers, foreign_lines, largest layer (added + removed) and bob.bobcoins.
   Read them from runs.report; no new tables.
2. BaselineCompare: a two-column table "Cleave" vs "One prompt (B1)" with rows Valid stack,
   Green layers, Foreign lines, Largest layer, Bobcoins, using the same labels and help
   text as /results (app/(public)/results/page.tsx `columns`). Values come from the reports:
   nothing typed in.
3. Show it only when a baseline exists. The proof page stays fully server-rendered.
4. Public proof pages show the baseline only for public stacks (loadStack with userId null
   already enforces that).

Check: cd apps/web && npm run typecheck && npm run lint && npm run build
Then locally: push a baseline for a stack (cleave eval baseline + cleave push --kind
baseline_b1) and open /proof/<id>.
Finish with a summary: files changed, checks passing, a screenshot of the proof page.
```
