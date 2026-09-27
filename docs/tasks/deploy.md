# Deploy the web app (do this before task08)

M1 needs the live app: `cleave push` sends the run there, and the proof page is the link
judges open. About 15 minutes. You set every secret yourself; none goes into the repo.

## 1. Vercel project

- Import `edish-github/Cleave` in Vercel. **Root Directory:** `apps/web`. Framework: Next.js.
- The `vercel-build` script applies database migrations, then builds. Nothing else to set.

## 2. Database

- Vercel → Storage → Marketplace → **Neon** → connect to the project.
  It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you.

## 3. GitHub sign-in

- GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
  - Homepage URL: `https://<your-domain>`
  - Authorization callback URL: `https://<your-domain>/api/auth/callback/github`
- Copy the client ID, generate a client secret.

## 4. Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
| --- | --- |
| `AUTH_SECRET` | output of `openssl rand -base64 32` |
| `AUTH_GITHUB_ID` | the OAuth app's client ID |
| `AUTH_GITHUB_SECRET` | the OAuth app's client secret |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` |
| `NEXT_PUBLIC_GITHUB_URL` | `https://github.com/edish-github/Cleave` (optional: shows the GitHub link) |

Don't set `CLEAVE_DEV_LOGIN` in production.

## 5. Deploy and check

1. Redeploy. The build log shows `Migrations applied.`
2. Open `/login` → **Continue with GitHub** → you land on `/app` (empty live workspace).
3. Settings → Bob & runners → **Create token**. Copy it once; it's stored only as a hash.
4. From any machine with the engine installed:

   ```bash
   export CLEAVE_URL=https://<your-domain> CLEAVE_TOKEN=clv_…
   ```

   The first real `cleave push` (task08) creates the repository and the stack.
5. `/`, `/docs/bob`, `/results` and `/login` load signed out.

If `/app` shows the sample workspace after signing in with GitHub, `DATABASE_URL` or the
`AUTH_*` variables are missing from the deployment.
