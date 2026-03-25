-- ============================================================================
-- PHASE 1.1 - Remove company_id tech debt (single-organization architecture)
-- ----------------------------------------------------------------------------
-- Goal:
--   - Remove company_id from employees and all related operational/core tables
--   - Remove orphan company-related constraints and helper functions
--   - Keep migration idempotent (IF EXISTS) and safe to re-run
--
-- IMPORTANT:
--   - DROP COLUMN ... CASCADE is intentional here to automatically remove
--     dependent indexes/defaults/policies/checks tied to company_id.
--   - This migration assumes the product is strictly single-organization.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 0) Drop legacy helpers tied to company_id tenant model
-- --------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.jwt_company_id() CASCADE;

-- --------------------------------------------------------------------------
-- 1) Drop explicit company_id FKs/constraints where known
-- --------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employees DROP CONSTRAINT IF EXISTS employees_company_id_fkey;
ALTER TABLE IF EXISTS public.user_roles DROP CONSTRAINT IF EXISTS user_roles_company_id_fkey;
ALTER TABLE IF EXISTS public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_company_id_fkey;
ALTER TABLE IF EXISTS public.departments DROP CONSTRAINT IF EXISTS departments_company_id_fkey;
ALTER TABLE IF EXISTS public.positions DROP CONSTRAINT IF EXISTS positions_company_id_fkey;
ALTER TABLE IF EXISTS public.apps DROP CONSTRAINT IF EXISTS apps_company_id_fkey;
ALTER TABLE IF EXISTS public.app_targets DROP CONSTRAINT IF EXISTS app_targets_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_schemes DROP CONSTRAINT IF EXISTS salary_schemes_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_scheme_tiers DROP CONSTRAINT IF EXISTS salary_scheme_tiers_company_id_fkey;
ALTER TABLE IF EXISTS public.scheme_month_snapshots DROP CONSTRAINT IF EXISTS scheme_month_snapshots_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_scheme DROP CONSTRAINT IF EXISTS employee_scheme_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_apps DROP CONSTRAINT IF EXISTS employee_apps_company_id_fkey;
ALTER TABLE IF EXISTS public.employee_tiers DROP CONSTRAINT IF EXISTS employee_tiers_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicles DROP CONSTRAINT IF EXISTS vehicles_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_assignments DROP CONSTRAINT IF EXISTS vehicle_assignments_company_id_fkey;
ALTER TABLE IF EXISTS public.maintenance_logs DROP CONSTRAINT IF EXISTS maintenance_logs_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_mileage DROP CONSTRAINT IF EXISTS vehicle_mileage_company_id_fkey;
ALTER TABLE IF EXISTS public.vehicle_mileage_daily DROP CONSTRAINT IF EXISTS vehicle_mileage_daily_company_id_fkey;
ALTER TABLE IF EXISTS public.daily_orders DROP CONSTRAINT IF EXISTS daily_orders_company_id_fkey;
ALTER TABLE IF EXISTS public.attendance DROP CONSTRAINT IF EXISTS attendance_company_id_fkey;
ALTER TABLE IF EXISTS public.external_deductions DROP CONSTRAINT IF EXISTS external_deductions_company_id_fkey;
ALTER TABLE IF EXISTS public.advances DROP CONSTRAINT IF EXISTS advances_company_id_fkey;
ALTER TABLE IF EXISTS public.advance_installments DROP CONSTRAINT IF EXISTS advance_installments_company_id_fkey;
ALTER TABLE IF EXISTS public.salary_records DROP CONSTRAINT IF EXISTS salary_records_company_id_fkey;
ALTER TABLE IF EXISTS public.pl_records DROP CONSTRAINT IF EXISTS pl_records_company_id_fkey;
ALTER TABLE IF EXISTS public.alerts DROP CONSTRAINT IF EXISTS alerts_company_id_fkey;
ALTER TABLE IF EXISTS public.locked_months DROP CONSTRAINT IF EXISTS locked_months_company_id_fkey;
ALTER TABLE IF EXISTS public.system_settings DROP CONSTRAINT IF EXISTS system_settings_company_id_fkey;
ALTER TABLE IF EXISTS public.audit_log DROP CONSTRAINT IF EXISTS audit_log_company_id_fkey;
ALTER TABLE IF EXISTS public.admin_action_log DROP CONSTRAINT IF EXISTS admin_action_log_company_id_fkey;
ALTER TABLE IF EXISTS public.platform_accounts DROP CONSTRAINT IF EXISTS platform_accounts_company_id_fkey;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP CONSTRAINT IF EXISTS platform_account_assignments_company_id_fkey;

-- --------------------------------------------------------------------------
-- 2) Drop company_id from core and operational tables (explicit list)
-- --------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.employees DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.daily_orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.attendance DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advances DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advance_installments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.external_deductions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.pl_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.user_roles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.user_permissions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.departments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.positions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.apps DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.app_targets DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_schemes DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_scheme_tiers DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.scheme_month_snapshots DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_scheme DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_apps DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employee_tiers DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_assignments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.maintenance_logs DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_mileage DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.vehicle_mileage_daily DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.alerts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.locked_months DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.system_settings DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.audit_log DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.admin_action_log DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_accounts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;

-- --------------------------------------------------------------------------
-- 3) Drop potential standalone companies table (if exists)
-- --------------------------------------------------------------------------
DROP TABLE IF EXISTS public.companies CASCADE;

COMMIT;

