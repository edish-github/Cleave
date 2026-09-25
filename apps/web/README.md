# Cleave web app (`apps/web`)

The web surface of Cleave: start splits, follow a run, review the proof, publish the stack,
and share a public proof page. It never splits anything itself. Bob and the engine do that;
this app shows what they produced.

Today it runs on a built-in **sample workspace** (clearly labelled in the UI). The backend
client plugs in behind one interface without touching pages. See `src/services/README.md`.

## Run it

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Sign in with any email and an 8+ character password, or "Continue with GitHub", which opens
the sample workspace and says so. Requires Node 20.9+.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint 9 flat config (`eslint-config-next`) |
| `npm run typecheck` | `next typegen` then `tsc --noEmit` |

## Routes

| Route | Page | Notes |
| --- | --- | --- |
| `/` | Landing | Hero visual, product, Map · Layer · Prove, Bob section |
| `/login`, `/signup` | Auth | Validation, pending states, GitHub option |
| `/docs/bob` | Bob setup guide | Mode, MCP tools, hooks, IDE and `bob run` usage |
| `/proof/[stackId]` | Public proof | No login. Real 404 unless the stack is public |
| `/app` | Overview | Needs-you cards, recent stacks, largest open PR, activity |
| `/app/new` | New split | Repo → PR → review; deep link `?repo=&pr=` |
| `/app/stacks` | Stacks | Status filter with counts, search, empty states |
| `/app/stacks/[id]` | Stack overview | Status hero, sizes, layers, proof, Bob's work |
| `/app/stacks/[id]/layers` | Layers | Rationale, stats, branch per layer |
| `/app/stacks/[id]/layers/[n]` | One layer | Verbatim hunks, needs / needed-by edges, prev/next |
| `/app/stacks/[id]/verification` | Verification | Checks, tree fidelity, per-layer results, rounds, review issue |
| `/app/stacks/[id]/activity` | Activity | Timeline with source filter and detail drawer |
| `/app/stacks/[id]/publish` | Publish | Branch plan, pre-publish checks, guards for other states |
| `/app/stacks/[id]/published` | Published | Stacked PR list |
| `/app/repositories` | Repositories | |
| `/app/repositories/[id]` | Repository | Open PRs by size, stacks, run settings |
| `/app/settings` (+ `/github`, `/runners`, `/appearance`) | Settings | Profile, GitHub, Bob & runners, theme and motion |

`/app/overview` redirects to `/app`. `src/proxy.ts` sends signed-out visitors to
`/login?next=…` and signed-in visitors away from `/login` and `/signup`.

Every data route has a `loading.tsx` skeleton shaped like the page, an `error.tsx` boundary
with retry, and a not-found state (stack, layer, repository, proof, global 404).

## How data flows

```
page (server component) ──► api (CleaveClient) ──► sample workspace   CLEAVE_DATA_SOURCE=sample
server action           ──┘                    └─► http client       CLEAVE_DATA_SOURCE=api (to build)
```

- `src/services/types.ts`: the `CleaveClient` contract (session, user, repositories,
  stacks, activity, search).
- `src/services/sample/`: dataset specs, `build.ts` (derives every number from the specs),
  cookie state for mutations, simulated read latency (`SAMPLE_LATENCY_MS`).
- `src/server/actions/`: server actions for auth, starting a split, publishing, resolving a
  review, sharing and the profile. They call `api` only.
- `src/lib/types.ts`: domain models mirroring the planned JSON Schemas.

### Sample dataset

| Stack | State | Shape |
| --- | --- | --- |
| galaxium-travels #184 "Add cancellations & refunds" | Verified, public proof | 5 layers, 37 atoms, 12 dependencies, 1 repair |
| galaxium-travels #179 "Loyalty tiers & seat upgrades" | Published | 4 layers, 21 atoms |
| orbit-pricing #57 "Move fare math to Decimal" | Review required | Layer 02 fails alone after 2 repairs; merge resolves it |
| ledger-sync #41 "Batch reconciliation job" | Verified (via `bob run`) | 3 layers, 12 atoms |
| galaxium-travels #188 "Waitlist for sold-out flights" | Open PR → analyze it | 3 layers, 18 atoms |

## What is honest about the sample workspace

- A "Sample workspace" pill sits in the top bar; publish, published and proof pages say
  what is simulated.
- Starting a split replays the recorded run for that PR (14 s), and the progress page says so.
- Actions that need GitHub or the backend (connect GitHub, connect repository, runner tokens,
  open on GitHub, edit run settings) open a dialog explaining why they aren't available,
  instead of pretending.
- Verification shows Cleave's real checks: atom coverage, dependency order, tree fidelity,
  layer shippability and "no new code" (0 lines).

## Design

Warm neutral canvas, one indigo accent, green for proven and amber for "needs you". Geist
Sans and Mono for the app, Instrument Serif for editorial headlines on public pages. Tokens
live in `src/app/globals.css` (`@theme inline`). The app supports light, dark and system
themes and a reduce-motion switch; public pages stay light. Native `<dialog>` for modals and
drawers, radio-group semantics for segmented controls, skip link, visible focus rings.

Images: two landing placeholders. See `ASSETS.md`.

## Dependencies

Runtime: `next` 16.3.6, `react` / `react-dom` 19.3.0, `lucide-react`, `geist`,
`@fontsource/instrument-serif`, `server-only`, `tailwind-merge`.
Dev: `tailwindcss` 4 + `@tailwindcss/postcss`, `typescript` 5, `eslint` 9 +
`eslint-config-next`, `@types/node`, `@types/react`, `@types/react-dom`.

## Known gaps

- `/results` (B1 vs Cleave) is left out until real evaluation runs exist. The New split
  mode selector (Cleave or baseline) and runner picker ship with it.
- Activity is a static timeline; live runs will stream over SSE (`/api/runs/:id/stream`).
- `/docs/bob` content lives in `src/content/bob.ts`. Once the engine is in the repo, read
  `packages/engine/src/cleave/bob_config/*` at build time instead. The hook JSON shape is
  still open check C1.
- Auth is a sample cookie session. The routes doc plans GitHub-only sign-in with Auth.js;
  decide then whether `/signup` stays or redirects to `/login`.
- Inside `/app`, not-found pages render correctly but return HTTP 200, because loading
  boundaries start streaming first. Public `/proof/[id]` returns a real 404.
- Times are shown in UTC.
- No automated test suite is committed yet. Verified manually with Playwright; see the
  handoff report.
