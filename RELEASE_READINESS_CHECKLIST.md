# Release Readiness Checklist (Current State)

## Environment and Build

- [ ] Target environment has correct Supabase keys and app env vars.
- [ ] Frontend build passes from active app path (`frontend/`).
- [ ] Deployment points to the active frontend output only.

## Database State (Supabase)

- [ ] Required migrations are present under `supabase/migrations/`.
- [ ] Staging database is fully migrated and in sync.
- [ ] RLS is enabled and validated for payroll-critical tables.

## Runtime Behavior

- [ ] Global Query retry policy is active:
  - no retry for 401/403
  - max 2 retries for other errors
- [ ] Auth-gated queries do not run before session readiness.
- [ ] User-scoped query keys prevent cache sharing across users.

## Critical Smoke Tests

- [ ] Login and role access (`admin`, `hr`, `finance`, `operations`, `viewer`).
- [ ] Dashboard loads without infinite loading loops.
- [ ] Orders, Salaries, Advances, Fuel flows complete successfully.
- [ ] High-risk mutations do not leave stuck loading states.

## Security and Permissions

- [ ] Viewer cannot mutate protected tables.
- [ ] HR/Finance permissions match policy expectations.
- [ ] Disabled users cannot access protected views.

## Go-Live Gate

- [ ] Product and operations sign-off.
- [ ] Finance sign-off for payroll flows.
- [ ] Final staging smoke-test sign-off.
