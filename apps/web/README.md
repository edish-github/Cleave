# Cleave web app (`apps/web`)

Stack pages, public proof pages and the ingest API. The app never splits anything itself:
Bob and the engine do that on your machine, and `cleave push` sends the finished run here.

Two workspaces, one UI:

- **Live**: sign in with GitHub. Your repositories, stacks and runs, stored in Postgres.
- **Sample**: "Explore the sample workspace" on `/login`. Labelled sample data, no account.

## Run it locally

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev                      # sample workspace only: http://localhost:3000
```

For the live workspace locally, add a Postgres URL, `AUTH_SECRET`, and either a GitHub
OAuth app or `CLEAVE_DEV_LOGIN=1` (development builds only), then `npm run db:migrate`.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint 9, `next typegen && tsc --noEmit` |
| `npm run contracts` | Regenerate `src/lib/contracts.ts` and the server's schema copy from `/schemas`, and `src/content/bob.generated.ts` from the engine's shipped Bob config |
| `npm run contracts:check` | Fail if they're out of date (CI) |
| `npm run db:generate` | New migration from `src/server/db/schema.ts` into `drizzle/` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

## Deploy on Vercel

1. **Import** the repository. Root Directory: `apps/web`. Framework: Next.js.
   The `vercel-build` script applies migrations, then builds.
2. **Database:** add Neon from the Vercel Marketplace. It sets `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED`.
3. **GitHub OAuth app** (GitHub → Settings → Developer settings → OAuth Apps):
   Homepage `https://<your-domain>`, callback `https://<your-domain>/api/auth/callback/github`.
4. **Environment variables:** `AUTH_SECRET` (`openssl rand -base64 32`), `AUTH_GITHUB_ID`,
   `AUTH_GITHUB_SECRET`, `NEXT_PUBLIC_SITE_URL=https://<your-domain>`.
5. **Deploy**, sign in with GitHub, open Settings → Bob & runners, create a token.
6. **Push a run** from the repository you split:

   ```bash
   export CLEAVE_URL=https://<your-domain> CLEAVE_TOKEN=clv_…
   cleave push --title "Loyalty tiers & seat upgrades" --pr 1 \
     --head-branch feat/loyalty-and-seat-upgrades --base-branch main
   ```

   The response includes the stack and proof URLs. Make the proof public from the stack's
   Share proof button.

Without step 2–4 the deployment serves the sample workspace only, and says so.

## Routes

| Route | Page |
| --- | --- |
| `/`, `/docs/bob`, `/login` | Landing (links the newest public proof), Bob setup guide, sign-in. `/signup` redirects to `/login` |
| `/results` | Evaluation table: B1 vs Cleave per constructed diff, from runs pushed with `--eval-group` |
| `/proof/[stackId]` | Public proof, with a share image (`opengraph-image`). 404 unless the stack is public |
| `/app` | Overview |
| `/app/new` | New split. Live: your open pull requests from GitHub, then the exact Bob IDE commands for the one you pick |
| `/app/stacks`, `/app/stacks/[id]` | Stacks list, stack overview |
| `/app/stacks/[id]/layers`, `…/layers/[layer]` | Layers, one layer's hunks and edges |
| `/app/stacks/[id]/verification`, `…/activity` | Checks and rounds, run timeline |
| `/app/stacks/[id]/publish`, `…/published` | Publish plan, published pull requests |
| `/app/runs/[runId]` | A split started from New split: status, runner, live events (refreshes every 2 s), cancel |
| `/app/repositories`, `/app/repositories/[id]` | Repositories (connect one from your GitHub list), one repository with its open pull requests |
| `/app/settings` (+ `/github`, `/runners`, `/appearance`) | Profile, GitHub, runner tokens, theme |

| API | Auth | Purpose |
| --- | --- | --- |
| `POST /api/ingest/bundle` | `Bearer clv_…` runner token | Store a run pushed by `cleave push` (gzip JSON, validated against `/schemas/bundle.schema.json`). Runs with `eval` are public and feed `/results` |
| `POST /api/runner/claim` | runner token | Long poll (≤ 25 s) for a queued run: a Job (`/schemas/job.schema.json`) or 204 |
| `POST /api/runner/heartbeat` | runner token | Runner and Bob versions; 409 when its job is no longer running |
| `POST /api/runner/runs/[runId]/events` | runner token | NDJSON of events while the run works (≤ 500 per request) |
| `POST /api/runner/runs/[runId]/complete` | runner token | `{status: "succeeded", bundle}` (stored like a push) or `{status: "failed", error}` |
| `GET/POST /api/auth/[...nextauth]` | — | GitHub sign-in (Auth.js) |

## How it's built

```
src/app/            routes (App Router); (public) group for landing, docs, login
src/components/     ui primitives, stack views, landing, settings
src/services/       api → live (Postgres) or sample client; see src/services/README.md
src/server/         db (Drizzle schema, client), auth, ingest, runner tokens, schema validation, actions,
                    github.ts (REST calls with the signed-in user's token: repos, open PRs, CI state)
src/lib/contracts.ts  generated from /schemas — engine shapes
src/lib/types.ts    view models the pages render
drizzle/            SQL migrations
test/fixtures/      sample-bundle.json: a sample stack exported as a push bundle
```

Twelve tables (`src/server/db/schema.ts`): users, repositories, stacks, runs, atoms,
plan_versions, layers, checks, events, runners, and jobs + job_events for runs started
from the browser. Runner tokens are stored as SHA-256 hashes
and shown once.

## Dependencies

Runtime: `next` 16.3.6, `react` 19.3, `next-auth` 5 (beta), `drizzle-orm`, `postgres`,
`ajv` + `ajv-formats`, `lucide-react`, `geist`, `@fontsource/instrument-serif`,
`tailwind-merge`, `server-only`.
Dev: `tailwindcss` 4, `typescript` 5, `eslint` 9 + `eslint-config-next`, `drizzle-kit`,
`json-schema-to-typescript`, `tsx`.

## Known gaps

- The runner's engine side (`cleave runner`, task13) isn't built yet. Until it is, New split
  can queue a run but nothing claims it; the run page says it's waiting for a runner, and
  the Bob IDE steps beside it work today.
- Publishing and merging layers after review still run on your machine (`cleave publish`,
  Bob IDE); the pages show the commands.
- Open pull requests and CI state need a GitHub sign-in. The development login has no
  GitHub token, and the pages say so instead of showing an empty list.
- Inside `/app`, not-found pages return HTTP 200 (streaming); `/proof/[id]` returns a real 404.
