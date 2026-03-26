# Tenant RLS Rollout Checklist

## Before Deployment

- Take a full DB backup / snapshot.
- Confirm JWT payload includes `company_id` for active users.
- Confirm role assignment exists in `user_roles` for all active users.
- Notify team about short read/write validation window.
- Prepare two test accounts:
  - Account A in Company A
  - Account B in Company B

## Deployment Order

- Run migrations in this order:
  1. `20260325153000_employees_tenant_rls_hardening.sql`
  2. `20260325154500_unify_company_id_on_employees.sql`
  3. `20260325160000_drop_legacy_trade_register_id_on_employees.sql`
  4. `20260325163000_tenant_rls_platform_accounts_and_employee_links.sql`
  5. `20260325170000_tenant_rls_ops_finance_tables.sql`
  6. `20260325173000_tenant_integrity_assertions_and_not_null.sql`
  7. `20260325174500_add_company_id_to_operational_tables.sql`
  8. `20260325181500_company_id_rollout_remaining_tables.sql`
  9. `20260325190000_salary_engine_tenant_secure.sql`
  10. `20260325193000_salary_preview_rpc.sql`

- Deploy edge function:
  - `supabase functions deploy salary-engine`

## Immediate Post-Deployment Validation (SQL)

- Run `supabase/tenant_rls_smoke_tests.sql`.
- Ensure all "should_be_zero" counters are `0`.
- Ensure integrity mismatch counters are `0`.
- Ensure helper functions exist.
- Ensure policy coverage appears for all scoped tables.

## App Runtime Validation

- Login as Company A user:
  - Can read Company A employees/orders/attendance/accounts.
  - Cannot see Company B records.
- Login as Company B user:
  - Same expectation in reverse.
- Validate key writes:
  - Create employee (Company A) succeeds.
  - Create platform account linked to Company A employee succeeds.
  - Cross-company link attempt fails.
  - Salary/advance operations remain functional for allowed roles.

## Observability (first 24h)

- Monitor Supabase logs for:
  - `new row violates row-level security policy`
  - permission denied errors on scoped tables
- Watch API error rates and key pages:
  - Employees
  - Orders
  - Attendance
  - Platform Accounts
  - Salaries / Advances

## Rollback Plan

- If critical outage:
  - Restore latest backup/snapshot.
  - Roll back app deployment if it depends on the new tenant schema.
  - Re-run validation on restored snapshot before reopening traffic.

## Hardening Follow-up

- Add automated CI smoke test that runs a subset of tenant checks.
- Keep a lightweight quarterly audit:
  - policy drift
  - null tenant fields
  - cross-tenant linkage mismatches
