# Web rules (apps/web)

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4. `middleware.ts` is `src/proxy.ts` in Next 16.
- Pages and server actions read data only through `api` from `src/services` (the `CleaveClient` contract).
- Types for engine data come from `src/lib/contracts.ts`, generated from `/schemas` by `npm run contracts`. Don't edit it by hand.
- Every data route keeps its `loading.tsx`, `error.tsx` and not-found state.
- Keep the visual language: tokens in `globals.css`, components in `src/components/ui`.
- Before finishing: `npm run typecheck && npm run lint && npm run build`.
