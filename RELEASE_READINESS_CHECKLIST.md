# Release Readiness Checklist

## 1) Pre-Deploy

- [ ] Confirm latest `main` is pulled in deployment environment.
- [ ] Verify `.env`/Supabase keys are set correctly for target environment.
- [ ] Confirm required migrations exist:
  - `supabase/migrations/20260324140000_pricing_rules.sql`
  - `supabase/migrations/20260324150000_rls_payroll_attendance_employees_hardening.sql`
- [ ] Confirm frontend build works on CI/target machine (`npm run build` in `frontend`).

## 2) Database Migration Order

1. Apply schema/rules migration:
   - `20260324140000_pricing_rules.sql`
2. Apply RLS hardening migration:
   - `20260324150000_rls_payroll_attendance_employees_hardening.sql`

Post-migration quick checks:
- [ ] `pricing_rules` table exists and is queryable by active users.
- [ ] Finance/Admin can insert/update/delete in `pricing_rules`.
- [ ] HR/Admin can insert attendance.
- [ ] Finance/Admin can read/manage salary records.

## 3) Smoke Test (Critical Paths)

- [ ] Login with each role (`admin`, `hr`, `finance`, `operations`, `viewer`).
- [ ] Orders page loads and saves without direct page-level query issues.
- [ ] Salaries page loads monthly context and computes rows.
- [ ] Pricing rules affect salary computation when matching rules exist.
- [ ] Fallback to legacy scheme logic works when no rules exist.
- [ ] Approve single salary record works.
- [ ] Mark-as-paid flow updates installments and advance completion.
- [ ] Bulk approve flow writes salary records correctly.

## 4) Security Validation (Role Matrix)

- [ ] `viewer` cannot mutate `employees` / `attendance` / `salary_records`.
- [ ] `hr` can manage `employees` and `attendance`, cannot manage `salary_records`.
- [ ] `finance` can manage `salary_records` and `pricing_rules`.
- [ ] `operations` can use orders flows but cannot edit payroll master records.
- [ ] Disabled user session is revoked and blocked from protected views.

## 5) Frontend Stability

- [ ] App routing works with v7 future flags enabled.
- [ ] No runtime errors in browser console on core pages:
  - `Dashboard`, `Employees`, `Orders`, `Salaries`, `Settings`
- [ ] Known non-blocking build warnings reviewed (bundle size, browserslist).

## 6) Rollback Plan (Minimal)

If release fails:
1. Revert application deployment to previous stable build.
2. Keep DB migrations (preferred) unless a critical schema issue is found.
3. If DB rollback is required, execute controlled SQL rollback scripts manually (do not hard-reset production schema).
4. Re-run smoke tests on the restored version.

## 7) Go-Live Gate

- [ ] Product owner sign-off on payroll calculations.
- [ ] Finance sign-off on salary approval/payment paths.
- [ ] HR sign-off on attendance and employee update permissions.
- [ ] Final green signal from staging smoke test report.
