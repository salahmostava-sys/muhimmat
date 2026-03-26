## Architecture

This project is a **Vite + React SPA** that talks to **Supabase** directly from the frontend.

### High-level flow

- **Browser (React + Vite)**: lazy-loaded pages, TanStack Query, i18n (AR/EN)
- **UI guards**: `ProtectedRoute` (auth) + `PageGuard` (permissions)
- **Service layer** (`src/services/*`): the app’s data access boundary
- **Supabase JS client** (`src/integrations/supabase/client.ts`): Auth + PostgREST + Realtime
- **Supabase Cloud**
  - **PostgREST**: REST API with **RLS**
  - **Auth (GoTrue)**: JWT + roles
  - **Realtime**: Postgres changes subscriptions
  - **Edge Functions**: backend-only operations (example: `salary-engine`)
- **PostgreSQL + RLS (multi-tenant)**: `company_id` everywhere + `jwt_company_id()` + integrity assertions in migrations

### Access control (3 layers)

1) **JWT + profile activation**
- Auth is Supabase Auth.
- User activation is enforced via `profiles.is_active` checks.

2) **Database RLS**
- Most security is enforced at the DB level.
- Policies rely on:
  - `has_role(auth.uid(), ...)`
  - `is_active_user(auth.uid())`
  - tenant scoping via `company_id` and `jwt_company_id()`

3) **Frontend UI Guard**
- `ProtectedRoute`: blocks unauthenticated users
- `PageGuard`: blocks pages/actions based on permissions

### Backend status

Supabase is the **only backend runtime** for this project.
- Frontend reads/writes simple CRUD directly via Supabase JS.
- Sensitive server-side logic runs in **Supabase Edge Functions** and SQL RPCs.

### Deployment notes (Vercel + SPA routing)

Because this is an SPA using React Router, deep links like `/employees` require the hosting layer to **rewrite all routes to `index.html`**.

This repo includes a root `vercel.json` with SPA rewrites.

