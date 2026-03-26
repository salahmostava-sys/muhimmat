# Security Audit Report (Current State)

## Scope

- Supabase-first architecture (`supabase/` as backend authority).
- Active frontend runtime paths under `frontend/src/`.
- Authentication gating, query isolation, and service error propagation behavior.

## Current Security Posture

- RLS-backed access controls are active for core operational/payroll flows.
- Global query retry policy avoids permission retry loops (401/403 no retry).
- Auth-gated queries are broadly applied to prevent pre-session fetches.
- User-scoped query keys are broadly applied to avoid cross-user cache leakage.
- Service error handling is largely strict (`console.error` + throw) in active services.

## Residual Risks

- Dual frontend trees (`frontend/src` and `src`) can cause policy drift if both are edited.
- Some UI mutation handlers still use mixed error handling patterns, which can affect consistency.
- Role-policy regression checks are still mostly manual.

## Priority Actions

1. Enforce one active frontend source tree and freeze/deprecate legacy mirror paths.
2. Normalize all mutation handlers to `try/catch/finally` in active pages.
3. Add CI checks for:
   - auth-gated queries
   - user-scoped query keys
   - throw-on-error service contract
4. Add repeatable role-matrix smoke tests for every release.

## Verdict

- Current baseline is deployable for staged rollout.
- Main risk now is consistency drift, not missing core controls.
