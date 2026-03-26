-- ============================================================================
-- Tenant RLS Smoke Tests
-- Run manually in Supabase SQL Editor after migrations deployment.
--
-- Covers:
-- 1) Schema + constraints sanity
-- 2) Data integrity across tenant-linked tables
-- 3) Policy coverage checks
-- 4) Runtime RLS behavior (same-tenant allowed, cross-tenant denied)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A: schema and constraints sanity
-- Expected: all checks return 0 (or expected small fixed values noted inline).
-- ----------------------------------------------------------------------------

-- A1) Legacy column should be removed from employees.
SELECT COUNT(*) AS should_be_zero
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employees'
  AND column_name = 'trade_register_id';

-- A2) Canonical company_id columns must exist.
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'employees',
    'profiles',
    'user_roles',
    'user_permissions',
    'departments',
    'positions',
    'apps',
    'app_targets',
    'salary_schemes',
    'salary_scheme_tiers',
    'scheme_month_snapshots',
    'employee_scheme',
    'employee_apps',
    'employee_tiers',
    'vehicles',
    'vehicle_assignments',
    'maintenance_logs',
    'vehicle_mileage',
    'vehicle_mileage_daily',
    'pl_records',
    'alerts',
    'locked_months',
    'system_settings',
    'audit_log',
    'platform_accounts',
    'account_assignments',
    'attendance',
    'daily_orders',
    'advances',
    'advance_installments',
    'external_deductions',
    'salary_records'
  )
  AND column_name = 'company_id'
ORDER BY table_name;

-- A2b) Any required table still missing company_id?
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'profiles',
    'user_roles',
    'user_permissions',
    'departments',
    'positions',
    'apps',
    'app_targets',
    'salary_schemes',
    'salary_scheme_tiers',
    'scheme_month_snapshots',
    'employees',
    'employee_scheme',
    'employee_apps',
    'employee_tiers',
    'vehicles',
    'vehicle_assignments',
    'maintenance_logs',
    'vehicle_mileage',
    'vehicle_mileage_daily',
    'platform_accounts',
    'account_assignments',
    'attendance',
    'daily_orders',
    'advances',
    'advance_installments',
    'external_deductions',
    'salary_records',
    'pl_records',
    'alerts',
    'locked_months',
    'system_settings',
    'audit_log'
  ]) AS table_name
)
SELECT rt.table_name AS missing_company_id_column
FROM required_tables rt
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = rt.table_name
 AND c.column_name = 'company_id'
WHERE c.column_name IS NULL
ORDER BY rt.table_name;

-- A3) company_id must be NOT NULL on canonical operational tables.
SELECT table_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'employees',
    'platform_accounts',
    'account_assignments',
    'attendance',
    'daily_orders',
    'advances',
    'advance_installments',
    'external_deductions',
    'salary_records'
  )
  AND column_name = 'company_id';

-- ----------------------------------------------------------------------------
-- SECTION B: tenant data integrity
-- Expected: all counts = 0.
-- ----------------------------------------------------------------------------

SELECT COUNT(*) AS employees_company_null
FROM public.employees
WHERE company_id IS NULL;

SELECT COUNT(*) AS platform_accounts_company_null
FROM public.platform_accounts
WHERE company_id IS NULL;

SELECT COUNT(*) AS account_assignments_company_null
FROM public.account_assignments
WHERE company_id IS NULL;

SELECT COUNT(*) AS attendance_company_null
FROM public.attendance
WHERE company_id IS NULL;

SELECT COUNT(*) AS daily_orders_company_null
FROM public.daily_orders
WHERE company_id IS NULL;

SELECT COUNT(*) AS advances_company_null
FROM public.advances
WHERE company_id IS NULL;

SELECT COUNT(*) AS advance_installments_company_null
FROM public.advance_installments
WHERE company_id IS NULL;

SELECT COUNT(*) AS external_deductions_company_null
FROM public.external_deductions
WHERE company_id IS NULL;

SELECT COUNT(*) AS salary_records_company_null
FROM public.salary_records
WHERE company_id IS NULL;

SELECT COUNT(*) AS platform_accounts_company_mismatch_employee
FROM public.platform_accounts pa
JOIN public.employees e ON e.id = pa.employee_id
WHERE pa.employee_id IS NOT NULL
  AND pa.company_id <> e.company_id;

SELECT COUNT(*) AS account_assignments_company_mismatch
FROM public.account_assignments aa
JOIN public.employees e ON e.id = aa.employee_id
JOIN public.platform_accounts pa ON pa.id = aa.account_id
WHERE aa.company_id <> e.company_id
   OR aa.company_id <> pa.company_id;

SELECT COUNT(*) AS attendance_orphan_or_unscoped
FROM public.attendance a
LEFT JOIN public.employees e ON e.id = a.employee_id
WHERE e.id IS NULL OR e.company_id IS NULL;

SELECT COUNT(*) AS daily_orders_orphan_or_unscoped
FROM public.daily_orders d
LEFT JOIN public.employees e ON e.id = d.employee_id
WHERE e.id IS NULL OR e.company_id IS NULL;

SELECT COUNT(*) AS advances_orphan_or_unscoped
FROM public.advances a
LEFT JOIN public.employees e ON e.id = a.employee_id
WHERE e.id IS NULL OR e.company_id IS NULL;

SELECT COUNT(*) AS salary_records_orphan_or_unscoped
FROM public.salary_records s
LEFT JOIN public.employees e ON e.id = s.employee_id
WHERE e.id IS NULL OR e.company_id IS NULL;

SELECT COUNT(*) AS external_deductions_orphan_or_unscoped
FROM public.external_deductions x
LEFT JOIN public.employees e ON e.id = x.employee_id
WHERE e.id IS NULL OR e.company_id IS NULL;

SELECT COUNT(*) AS advance_installments_orphan_or_unscoped
FROM public.advance_installments ai
LEFT JOIN public.advances a ON a.id = ai.advance_id
LEFT JOIN public.employees e ON e.id = a.employee_id
WHERE a.id IS NULL OR e.id IS NULL OR e.company_id IS NULL;

-- ----------------------------------------------------------------------------
-- SECTION C: policy coverage check
-- Expected: each table has at least 1 SELECT policy and at least 1 write policy.
-- ----------------------------------------------------------------------------

WITH policy_counts AS (
  SELECT
    tablename,
    SUM(CASE WHEN cmd = 'SELECT' THEN 1 ELSE 0 END) AS select_policies,
    SUM(CASE WHEN cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL') THEN 1 ELSE 0 END) AS write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'employees',
      'employee_apps',
      'employee_scheme',
      'platform_accounts',
      'account_assignments',
      'attendance',
      'daily_orders',
      'advances',
      'advance_installments',
      'salary_records',
      'external_deductions'
    )
  GROUP BY tablename
)
SELECT *
FROM policy_counts
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- SECTION D: runtime RLS behavior checks
-- IMPORTANT:
--   Replace UUID placeholders before running this section.
--   It simulates an authenticated JWT context.
--
-- Expected:
--   - own-company SELECT returns >= 0 rows (query succeeds)
--   - cross-company probes return 0 rows
-- ----------------------------------------------------------------------------

BEGIN;

-- Replace these values:
-- 11111111-1111-1111-1111-111111111111 => test user id
-- 22222222-2222-2222-2222-222222222222 => test company id (same tenant)
-- 33333333-3333-3333-3333-333333333333 => another company id (different tenant)
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-1111-1111-1111-111111111111',
    'role', 'authenticated',
    'company_id', '22222222-2222-2222-2222-222222222222',
    'app_metadata', json_build_object('company_id', '22222222-2222-2222-2222-222222222222')
  )::text,
  true
);

SET LOCAL ROLE authenticated;

-- D1) own-tenant read should succeed.
SELECT COUNT(*) AS own_tenant_employees_visible
FROM public.employees;

-- D2) cross-tenant reads should be blocked by policy filter (0 rows).
SELECT COUNT(*) AS should_be_zero
FROM public.employees
WHERE company_id = '33333333-3333-3333-3333-333333333333'::uuid;

SELECT COUNT(*) AS should_be_zero
FROM public.platform_accounts
WHERE company_id = '33333333-3333-3333-3333-333333333333'::uuid;

SELECT COUNT(*) AS should_be_zero
FROM public.account_assignments
WHERE company_id = '33333333-3333-3333-3333-333333333333'::uuid;

ROLLBACK;

-- ----------------------------------------------------------------------------
-- SECTION E: helper function existence check
-- Expected: all rows present.
-- ----------------------------------------------------------------------------

SELECT proname
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'jwt_company_id',
    'employee_in_my_company',
    'platform_account_in_my_company',
    'assignment_in_my_company',
    'advance_in_my_company'
  )
ORDER BY proname;

-- E2) Salary RPC execution should be edge-only (service_role).
SELECT
  p.proname,
  r.rolname AS grantee,
  has_function_privilege(
    r.rolname,
    p.oid,
    'EXECUTE'
  ) AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated', 'service_role')
WHERE n.nspname = 'public'
  AND p.proname IN ('calculate_salary_for_employee_month', 'calculate_salary_for_month', 'preview_salary_for_month')
ORDER BY p.proname, r.rolname;
