# Security Audit Report (Batch 8)

## Scope

- Backend RLS migrations reviewed:
  - `backend/supabase/migrations/20260320000002_rls_comprehensive_fix.sql`
  - `backend/supabase/migrations/20260324140000_pricing_rules.sql`
  - `backend/supabase/migrations/20260324150000_rls_payroll_attendance_employees_hardening.sql`
- Frontend data-access usage reviewed from:
  - `frontend/src/pages/*`
  - `frontend/src/services/*`
  - `frontend/src/hooks/*`

## Access Matrix (Current Effective Policy)

- `employees`
  - `SELECT`: active `admin/hr/operations/finance/viewer`
  - `INSERT/UPDATE/DELETE`: active `admin/hr`
- `attendance`
  - `SELECT`: active `admin/hr/operations/finance`
  - `INSERT/UPDATE/DELETE`: active `admin/hr`
- `salary_records`
  - `SELECT`: active `admin/finance`
  - `INSERT/UPDATE/DELETE`: active `admin/finance`
- `pricing_rules`
  - `SELECT`: active users
  - `INSERT/UPDATE/DELETE`: active `admin/finance`
- `daily_orders`
  - `SELECT`: active users
  - `INSERT/UPDATE/DELETE`: active `admin/operations/hr`
- `app_targets`
  - `SELECT`: active users
  - `INSERT/UPDATE/DELETE`: active `admin/operations/finance`
- `apps`
  - `SELECT`: active users
  - `INSERT/UPDATE/DELETE`: active `admin`
- `advances`, `advance_installments`, `external_deductions`
  - `SELECT/ALL`: active `admin/finance`

## Findings

- **Good:** payroll-critical tables now have role-scoped policies aligned with finance/HR boundaries.
- **Good:** `pricing_rules` is protected with admin/finance write controls and full RLS enabled.
- **Risk (Medium):** direct Supabase calls still exist in pages (`Salaries`, `Orders`) in addition to service-layer calls.
  - Impact: hard to uniformly enforce audit/logging and access conventions at application layer.
- **Risk (Low):** broad `SELECT` on some operational tables (e.g., `daily_orders`, `app_targets`) to all active roles may exceed strict least-privilege targets depending on business policy.
- **Risk (Low):** no automated policy regression tests are present (cannot prove policy behavior after future migrations without manual checks).

## Recommended Next Actions

1. Complete migration to services-only data access in `Salaries` and `Orders` (remove remaining direct `supabase.from(...)` calls from pages).
2. Add policy test checklist in CI for role scenarios:
   - viewer cannot mutate payroll/attendance
   - HR can insert/update attendance but cannot manage salary records
   - Finance can manage salary records/pricing rules but not employee master mutations.
3. If stricter least privilege is desired, narrow `SELECT` on `daily_orders`/`app_targets` to explicit role sets.
4. Add audit trail insertion for pricing rule changes (who changed what, old/new values).

## Verdict

- Current posture is **materially improved and production-viable for staged rollout**.
- Main remaining gap is **application-layer consistency** (services-only access), not core table-level authorization.
