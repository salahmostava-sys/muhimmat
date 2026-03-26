# Project Current State Report

This file is a current-state snapshot only.

## Architecture Status

- Backend runtime: Supabase only.
- Active backend path: `supabase/` (migrations + functions).
- Legacy backend runtimes (`backend/`, `api/`) are removed.
- Primary frontend source path: `frontend/src/`.
- Legacy mirror path `src/` still exists and should be treated as technical debt unless explicitly targeted.

## Core Delivery Status

- QueryClient global retry policy is active (no retry on 401/403, max 2 retries otherwise).
- Auth-gated React Query pattern is applied broadly in active frontend paths.
- Service-level error handling is largely strict (log + throw) in active service layer files.
- Historical documentation was updated to remove stale backend path references.

## Current Operational Risks

- Duplicate frontend trees (`frontend/src/` and `src/`) can reintroduce drift.
- Some UI handlers still use mixed patterns (`if (error) return` vs `try/catch/finally`) and need full harmonization.
- Sonar warnings remain in several large pages and are non-blocking for runtime but still technical debt.

## Next Recommended Actions

- Standardize all mutation handlers to `try/catch/finally` in active pages.
- Continue consolidating to one frontend source tree (`frontend/src/`) and retire legacy duplicates safely.
- Add CI checks for:
  - auth-gated queries
  - user-scoped query keys
  - strict service throw policy
