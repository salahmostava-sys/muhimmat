# Cleanup Report

This document reflects the current cleanup state and intentionally avoids outdated path history.

## Current Architecture (Source of Truth)

- Backend is Supabase-only.
- Active backend assets live under `supabase/`.
- Frontend app code lives under `frontend/` (with legacy mirror paths still present in `src/`).

## Confirmed Removed Backend Paths

- `backend/server.js`
- `backend/src/`
- `api/`

## Cleanup Notes

- Duplicate migration conflict for `locked_months` was removed.
- Documentation and runtime config were aligned to Supabase-only backend.
- Legacy/historical references should not be used as operational guidance.

## Operational Guidance

- Use `frontend/src/` as the primary frontend source.
- Use `supabase/` for migrations and functions.
- Treat legacy mirror files in `src/` as technical debt unless explicitly needed.
