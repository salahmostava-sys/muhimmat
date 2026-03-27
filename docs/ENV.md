# Environment variables (Supabase)

**Audience:** developers running the app locally or configuring Vercel.

The Vite app reads **only** variables prefixed with `VITE_`. Values are baked in at **build time** for production — set them in the hosting dashboard (e.g. Vercel), not only on your laptop.

## Where to put files

| Location | Role |
|----------|------|
| `frontend/.env.example` | Committed template — copy to `.env.local` |
| `frontend/.env.local` | Local overrides — **not** committed (see `frontend/.gitignore`) |

From the repo root, `npm run dev` runs Vite inside `frontend/`; Vite loads env files from **`frontend/`**.

## Required variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **anon** public key (safe for the browser; RLS still applies) |

Implementation: `frontend/services/supabase/client.ts` — missing values throw at startup with a clear error.

## Production builds

For `vite build` / production, `VITE_SUPABASE_URL` must point to your **cloud** Supabase project. If the URL looks like `localhost` or `127.0.0.1`, the client logs a **console error** in production to catch misconfigured deploys.

## Vercel

Add the same `VITE_*` names under **Project → Settings → Environment Variables** for Production (and Preview if you use preview deploys).

## Tests

Vitest uses mocks in `frontend/shared/test/setup.ts` so unit tests do not require real `VITE_SUPABASE_*` values or live Auth.

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `Missing Supabase environment variables` | `.env.local` exists under `frontend/`, names are exact, dev server restarted after edits |
| App works locally but not after deploy | Variables set on Vercel (or host) for the right environment; redeploy after changing env |
| Production console warning about localhost URL | `VITE_SUPABASE_URL` on the host still points to local — use the `https://….supabase.co` URL |
