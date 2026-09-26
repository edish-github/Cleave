# Services

Pages and server actions talk to one object: `api` from `src/services/index.ts`. It
implements the `CleaveClient` contract (`./types.ts`) and picks a client per request:

```
page / server action ──► api ──► live/client.ts     signed in with GitHub, DATABASE_URL set
                                └► sample/client.ts   everyone else (labelled sample workspace)
```

`api.isSample()` tells pages which one served the request, so they can label sample data.
Public proof pages use `getPublicStack(id)`: a public live stack first, else a public sample
stack (labelled). A private live stack never falls back to a sample stack with the same id.

## Live (`./live`)

- `client.ts` reads the signed-in user's repositories, stacks, runs and events from Postgres.
- `map.ts` turns rows (engine contracts from `/schemas`) into the view models pages render.
- Runs arrive through `POST /api/ingest/bundle` (`src/server/ingest.ts`), sent by `cleave push`.
- Actions that need the user's machine (start a split, publish, merge layers after review)
  throw `NeedsRunnerError` with the exact command to run instead. The runner (P1) replaces them.

## Sample (`./sample`)

- `data/`: three repositories, six pull requests, six stacks, as compact specs.
- `build.ts` derives every number from the specs; `state.ts` keeps visitor actions in a cookie.
- Starting a split replays a recorded run (14 s), and the UI says so.

`scripts/export-sample-bundle.ts` exports a sample stack as a push bundle
(`test/fixtures/sample-bundle.json`) to exercise ingest and the live pages end to end.
