# Services

Pages and server actions talk to exactly one object: `api` from `src/services/index.ts`.
It implements `CleaveClient` (`./types.ts`). Nothing under `src/app` or `src/components`
imports sample data directly.

```
page / server action ──► api (CleaveClient) ──► sample/client.ts   (today)
                                             └► http/client.ts     (backend, not written yet)
```

## Sample workspace (`./sample`)

- `data/` holds the dataset as compact specs: three repositories, six open pull requests
  and six stacks. The flagship is `galaxium-travels-184` (5 layers, 37 atoms, 12 dependencies).
- `build.ts` expands a spec into the full `Stack` model: ids, totals, layer stats, the five
  checks, verification rounds, repairs and the activity timeline. Every page reads the same numbers.
- `state.ts` keeps what the visitor did (started a run, published, resolved a review, sharing,
  profile name) in an httpOnly cookie, so it works on serverless hosting with no database.
- Reads wait `SAMPLE_LATENCY_MS` (default 280 ms) so loading states behave like a real backend.
- Starting a split replays the recorded run: the stack is "analyzing" for 14 s, computed on the
  server from the start time, then shows the recorded result. The UI says so.

## Adding the backend client

1. Create `./http/client.ts` exporting an object that implements `CleaveClient`, with
   `source: "api"`. Map each method to the routes in the routes doc (section 6):
   stacks and runs from Postgres, `POST /api/ingest/bundle` for `cleave push`, runner endpoints
   for live runs, Auth.js for the session.
2. In `./index.ts`, return it when `CLEAVE_DATA_SOURCE=api`.
3. Generate `src/lib/types.ts` from `/schemas/*.schema.json` instead of editing it by hand.
4. With `source: "api"`, the "Sample workspace" labels disappear and the GitHub-only buttons
   (`BackendRequiredButton`) should be swapped for their real actions.

No page or component changes are needed for steps 1–3.
