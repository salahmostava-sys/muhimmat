-- ============================================================================
-- PHASE 1: Supabase-only backend consolidation (core DB layer)
-- - Helper functions: is_internal_user, has_permission
-- - Explicit RLS policies for core tables (no global dynamic loops)
-- - Audit columns + admin_action_log triggers
-- - Core RPCs: check_in, check_out, calculate_salary
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1) Helper functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND COALESCE(p.is_active, true) = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_resource text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF NOT public.is_internal_user() THEN
    RETURN false;
  END IF;

  -- Admin always allowed.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND (
        ur.role = 'admin'::public.app_role
        OR lower(COALESCE(r.title, '')) = 'admin'
      )
  ) THEN
    RETURN true;
  END IF;

  -- Permissions from roles.permissions JSONB (supports '*' wildcard).
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND COALESCE(r.is_active, true) = true
      AND (
        COALESCE((r.permissions -> '*' ->> p_action)::boolean, false)
        OR COALESCE((r.permissions -> p_resource ->> p_action)::boolean, false)
      )
  ) INTO v_allowed;

  IF v_allowed THEN
    RETURN true;
  END IF;

  -- Fallback matrix for legacy users where JSON permissions are missing/empty.
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (
        -- HR
        (ur.role = 'hr'::public.app_role AND (
          (p_resource = 'employees'  AND p_action IN ('view','write')) OR
          (p_resource = 'orders'     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR
          (p_resource = 'salary'     AND p_action = 'view') OR
          (p_resource = 'roles'      AND p_action = 'view') OR
          (p_resource = 'financials' AND p_action = 'view')
        ))
        OR
        -- Finance
        (ur.role = 'finance'::public.app_role AND (
          (p_resource = 'employees'  AND p_action = 'view') OR
          (p_resource = 'orders'     AND p_action = 'view') OR
          (p_resource = 'attendance' AND p_action = 'view') OR
          (p_resource = 'salary'     AND p_action IN ('view','write','approve')) OR
          (p_resource = 'financials' AND p_action IN ('view','write','approve')) OR
          (p_resource = 'roles'      AND p_action = 'view')
        ))
        OR
        -- Operations
        (ur.role = 'operations'::public.app_role AND (
          (p_resource = 'employees'  AND p_action = 'view') OR
          (p_resource = 'orders'     AND p_action IN ('view','write')) OR
          (p_resource = 'attendance' AND p_action IN ('view','write')) OR
          (p_resource = 'salary'     AND p_action = 'view') OR
          (p_resource = 'financials' AND p_action = 'view')
        ))
        OR
        -- Viewer
        (ur.role = 'viewer'::public.app_role AND p_action = 'view')
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_internal_user() FROM public;
REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.is_internal_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

-- --------------------------------------------------------------------------
-- 2) Normalize role permissions (action-based, single-organization)
-- --------------------------------------------------------------------------

INSERT INTO public.roles (title, permissions, is_active)
VALUES
  ('admin', '{}'::jsonb, true),
  ('hr', '{}'::jsonb, true),
  ('finance', '{}'::jsonb, true),
  ('accountant', '{}'::jsonb, true),
  ('operations', '{}'::jsonb, true),
  ('viewer', '{}'::jsonb, true)
ON CONFLICT (title) DO UPDATE
SET is_active = EXCLUDED.is_active;

UPDATE public.roles
SET permissions = jsonb_build_object(
  '*', jsonb_build_object('view', true, 'write', true, 'delete', true, 'approve', true),
  'employees',  jsonb_build_object('view', true, 'write', true, 'delete', true),
  'orders',     jsonb_build_object('view', true, 'write', true, 'delete', true),
  'attendance', jsonb_build_object('view', true, 'write', true, 'delete', true),
  'salary',     jsonb_build_object('view', true, 'write', true, 'approve', true),
  'financials', jsonb_build_object('view', true, 'write', true, 'delete', true, 'approve', true),
  'roles',      jsonb_build_object('view', true, 'write', true, 'delete', true),
  'audit',      jsonb_build_object('view', true, 'write', true)
)
WHERE title = 'admin';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'orders',     jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance', jsonb_build_object('view', true, 'write', true, 'delete', false),
  'salary',     jsonb_build_object('view', true, 'write', false, 'approve', false),
  'financials', jsonb_build_object('view', true, 'write', false, 'delete', false, 'approve', false),
  'roles',      jsonb_build_object('view', true, 'write', false, 'delete', false),
  'audit',      jsonb_build_object('view', true, 'write', true)
)
WHERE title = 'hr';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',     jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance', jsonb_build_object('view', true, 'write', false, 'delete', false),
  'salary',     jsonb_build_object('view', true, 'write', true, 'approve', true),
  'financials', jsonb_build_object('view', true, 'write', true, 'delete', false, 'approve', true),
  'roles',      jsonb_build_object('view', true, 'write', false, 'delete', false),
  'audit',      jsonb_build_object('view', true, 'write', true)
)
WHERE title IN ('finance', 'accountant');

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',     jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance', jsonb_build_object('view', true, 'write', true, 'delete', false),
  'salary',     jsonb_build_object('view', true, 'write', false, 'approve', false),
  'financials', jsonb_build_object('view', true, 'write', false, 'delete', false, 'approve', false),
  'roles',      jsonb_build_object('view', false, 'write', false, 'delete', false),
  'audit',      jsonb_build_object('view', true, 'write', true)
)
WHERE title = 'operations';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees',  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',     jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance', jsonb_build_object('view', true, 'write', false, 'delete', false),
  'salary',     jsonb_build_object('view', true, 'write', false, 'approve', false),
  'financials', jsonb_build_object('view', true, 'write', false, 'delete', false, 'approve', false),
  'roles',      jsonb_build_object('view', false, 'write', false, 'delete', false),
  'audit',      jsonb_build_object('view', false, 'write', false)
)
WHERE title = 'viewer';

-- --------------------------------------------------------------------------
-- 3) Explicit RLS (core tables only, no branch/company row isolation)
-- --------------------------------------------------------------------------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pl_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

-- roles
DROP POLICY IF EXISTS "Active users can view roles" ON public.roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.roles;
DROP POLICY IF EXISTS roles_select_policy ON public.roles;
DROP POLICY IF EXISTS roles_insert_policy ON public.roles;
DROP POLICY IF EXISTS roles_update_policy ON public.roles;
DROP POLICY IF EXISTS roles_delete_policy ON public.roles;

CREATE POLICY roles_select_policy
  ON public.roles FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'view'));
CREATE POLICY roles_insert_policy
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('roles', 'write'));
CREATE POLICY roles_update_policy
  ON public.roles FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('roles', 'write'));
CREATE POLICY roles_delete_policy
  ON public.roles FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'delete'));

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update_policy ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete_policy ON public.user_roles;

CREATE POLICY user_roles_select_policy
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'view'));
CREATE POLICY user_roles_insert_policy
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('roles', 'write'));
CREATE POLICY user_roles_update_policy
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('roles', 'write'));
CREATE POLICY user_roles_delete_policy
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('roles', 'delete'));

-- employees
DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin/finance/ops can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role scoped select employees" ON public.employees;
DROP POLICY IF EXISTS "HR admin manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees: select own company" ON public.employees;
DROP POLICY IF EXISTS "Employees: insert" ON public.employees;
DROP POLICY IF EXISTS "Employees: update" ON public.employees;
DROP POLICY IF EXISTS "Employees: delete" ON public.employees;
DROP POLICY IF EXISTS employees_select_policy ON public.employees;
DROP POLICY IF EXISTS employees_insert_policy ON public.employees;
DROP POLICY IF EXISTS employees_update_policy ON public.employees;
DROP POLICY IF EXISTS employees_delete_policy ON public.employees;

CREATE POLICY employees_select_policy
  ON public.employees FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('employees', 'view'));
CREATE POLICY employees_insert_policy
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('employees', 'write'));
CREATE POLICY employees_update_policy
  ON public.employees FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('employees', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('employees', 'write'));
CREATE POLICY employees_delete_policy
  ON public.employees FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('employees', 'delete'));

-- daily_orders
DROP POLICY IF EXISTS "Authenticated can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Active users can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Operations/admin can manage daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Ops/HR/admin can manage daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Ops/HR/admin/finance can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: select own company" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: manage own company" ON public.daily_orders;
DROP POLICY IF EXISTS daily_orders_select_policy ON public.daily_orders;
DROP POLICY IF EXISTS daily_orders_insert_policy ON public.daily_orders;
DROP POLICY IF EXISTS daily_orders_update_policy ON public.daily_orders;
DROP POLICY IF EXISTS daily_orders_delete_policy ON public.daily_orders;

CREATE POLICY daily_orders_select_policy
  ON public.daily_orders FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('orders', 'view'));
CREATE POLICY daily_orders_insert_policy
  ON public.daily_orders FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('orders', 'write'));
CREATE POLICY daily_orders_update_policy
  ON public.daily_orders FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('orders', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('orders', 'write'));
CREATE POLICY daily_orders_delete_policy
  ON public.daily_orders FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('orders', 'delete'));

-- attendance
DROP POLICY IF EXISTS "Authenticated can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Active users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR/admin can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR/admin/finance/ops can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Role scoped select attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR admin insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR admin update attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR admin delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: select own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: insert own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: update own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: delete own company" ON public.attendance;
DROP POLICY IF EXISTS attendance_select_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_insert_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_update_policy ON public.attendance;
DROP POLICY IF EXISTS attendance_delete_policy ON public.attendance;

CREATE POLICY attendance_select_policy
  ON public.attendance FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('attendance', 'view'));
CREATE POLICY attendance_insert_policy
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('attendance', 'write'));
CREATE POLICY attendance_update_policy
  ON public.attendance FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('attendance', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('attendance', 'write'));
CREATE POLICY attendance_delete_policy
  ON public.attendance FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('attendance', 'delete'));

-- advances
DROP POLICY IF EXISTS "Authenticated can view advances" ON public.advances;
DROP POLICY IF EXISTS "Active users can view advances" ON public.advances;
DROP POLICY IF EXISTS "Finance/admin can manage advances" ON public.advances;
DROP POLICY IF EXISTS "Finance/admin/hr can view advances" ON public.advances;
DROP POLICY IF EXISTS "Advances: select own company" ON public.advances;
DROP POLICY IF EXISTS "Advances: manage own company" ON public.advances;
DROP POLICY IF EXISTS advances_select_policy ON public.advances;
DROP POLICY IF EXISTS advances_insert_policy ON public.advances;
DROP POLICY IF EXISTS advances_update_policy ON public.advances;
DROP POLICY IF EXISTS advances_delete_policy ON public.advances;

CREATE POLICY advances_select_policy
  ON public.advances FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'view'));
CREATE POLICY advances_insert_policy
  ON public.advances FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY advances_update_policy
  ON public.advances FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY advances_delete_policy
  ON public.advances FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'delete'));

-- advance_installments
DROP POLICY IF EXISTS "Authenticated can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Active users can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin can manage advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin/hr can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: select own company" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: manage own company" ON public.advance_installments;
DROP POLICY IF EXISTS advance_installments_select_policy ON public.advance_installments;
DROP POLICY IF EXISTS advance_installments_insert_policy ON public.advance_installments;
DROP POLICY IF EXISTS advance_installments_update_policy ON public.advance_installments;
DROP POLICY IF EXISTS advance_installments_delete_policy ON public.advance_installments;

CREATE POLICY advance_installments_select_policy
  ON public.advance_installments FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'view'));
CREATE POLICY advance_installments_insert_policy
  ON public.advance_installments FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY advance_installments_update_policy
  ON public.advance_installments FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY advance_installments_delete_policy
  ON public.advance_installments FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'delete'));

-- external_deductions
DROP POLICY IF EXISTS "Finance/admin can view external_deductions" ON public.external_deductions;
DROP POLICY IF EXISTS "Finance/admin can manage external_deductions" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: select own company" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: manage own company" ON public.external_deductions;
DROP POLICY IF EXISTS external_deductions_select_policy ON public.external_deductions;
DROP POLICY IF EXISTS external_deductions_insert_policy ON public.external_deductions;
DROP POLICY IF EXISTS external_deductions_update_policy ON public.external_deductions;
DROP POLICY IF EXISTS external_deductions_delete_policy ON public.external_deductions;

CREATE POLICY external_deductions_select_policy
  ON public.external_deductions FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'view'));
CREATE POLICY external_deductions_insert_policy
  ON public.external_deductions FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY external_deductions_update_policy
  ON public.external_deductions FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY external_deductions_delete_policy
  ON public.external_deductions FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'delete'));

-- salary_records
DROP POLICY IF EXISTS "Finance/admin can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance admin select salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance admin manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: select own company" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: manage own company" ON public.salary_records;
DROP POLICY IF EXISTS salary_records_select_policy ON public.salary_records;
DROP POLICY IF EXISTS salary_records_insert_policy ON public.salary_records;
DROP POLICY IF EXISTS salary_records_update_policy ON public.salary_records;
DROP POLICY IF EXISTS salary_records_delete_policy ON public.salary_records;

CREATE POLICY salary_records_select_policy
  ON public.salary_records FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('salary', 'view'));
CREATE POLICY salary_records_insert_policy
  ON public.salary_records FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('salary', 'write'));
CREATE POLICY salary_records_update_policy
  ON public.salary_records FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('salary', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('salary', 'write'));
CREATE POLICY salary_records_delete_policy
  ON public.salary_records FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('salary', 'delete'));

-- pl_records (financials)
DROP POLICY IF EXISTS "Finance/admin can view pl_records" ON public.pl_records;
DROP POLICY IF EXISTS "Finance/admin can manage pl_records" ON public.pl_records;
DROP POLICY IF EXISTS pl_records_select_policy ON public.pl_records;
DROP POLICY IF EXISTS pl_records_insert_policy ON public.pl_records;
DROP POLICY IF EXISTS pl_records_update_policy ON public.pl_records;
DROP POLICY IF EXISTS pl_records_delete_policy ON public.pl_records;

CREATE POLICY pl_records_select_policy
  ON public.pl_records FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'view'));
CREATE POLICY pl_records_insert_policy
  ON public.pl_records FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY pl_records_update_policy
  ON public.pl_records FOR UPDATE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'write'))
  WITH CHECK (public.is_internal_user() AND public.has_permission('financials', 'write'));
CREATE POLICY pl_records_delete_policy
  ON public.pl_records FOR DELETE TO authenticated
  USING (public.is_internal_user() AND public.has_permission('financials', 'delete'));

-- admin_action_log
DROP POLICY IF EXISTS "Admin actions: select" ON public.admin_action_log;
DROP POLICY IF EXISTS "Admin actions: insert" ON public.admin_action_log;
DROP POLICY IF EXISTS admin_action_log_select_policy ON public.admin_action_log;
DROP POLICY IF EXISTS admin_action_log_insert_policy ON public.admin_action_log;

CREATE POLICY admin_action_log_select_policy
  ON public.admin_action_log FOR SELECT TO authenticated
  USING (public.is_internal_user() AND public.has_permission('audit', 'view'));
CREATE POLICY admin_action_log_insert_policy
  ON public.admin_action_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_user()
    AND public.has_permission('audit', 'write')
    AND user_id IS NOT DISTINCT FROM auth.uid()
  );

-- --------------------------------------------------------------------------
-- 4) Audit trail columns + triggers
-- --------------------------------------------------------------------------

ALTER TABLE public.employees            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.daily_orders         ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.attendance           ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advances             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advances             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advance_installments ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.advance_installments ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.external_deductions  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.external_deductions  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.salary_records       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.salary_records       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pl_records           ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles           ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_audit_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    IF NEW.updated_by IS NULL THEN
      NEW.updated_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action_cud()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_record_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE(OLD.id::text, NULL);
    INSERT INTO public.admin_action_log (user_id, action, table_name, record_id, meta)
    VALUES (
      v_actor,
      lower(TG_OP),
      TG_TABLE_NAME,
      v_record_id,
      jsonb_build_object('old', to_jsonb(OLD))
    );
    RETURN OLD;
  ELSE
    v_record_id := COALESCE(NEW.id::text, NULL);
    INSERT INTO public.admin_action_log (user_id, action, table_name, record_id, meta)
    VALUES (
      v_actor,
      lower(TG_OP),
      TG_TABLE_NAME,
      v_record_id,
      CASE
        WHEN TG_OP = 'INSERT' THEN jsonb_build_object('new', to_jsonb(NEW))
        ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
      END
    );
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_set_audit_columns ON public.employees;
CREATE TRIGGER trg_employees_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_daily_orders_set_audit_columns ON public.daily_orders;
CREATE TRIGGER trg_daily_orders_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.daily_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_attendance_set_audit_columns ON public.attendance;
CREATE TRIGGER trg_attendance_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_advances_set_audit_columns ON public.advances;
CREATE TRIGGER trg_advances_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_advance_installments_set_audit_columns ON public.advance_installments;
CREATE TRIGGER trg_advance_installments_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.advance_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_external_deductions_set_audit_columns ON public.external_deductions;
CREATE TRIGGER trg_external_deductions_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.external_deductions
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_salary_records_set_audit_columns ON public.salary_records;
CREATE TRIGGER trg_salary_records_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.salary_records
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_pl_records_set_audit_columns ON public.pl_records;
CREATE TRIGGER trg_pl_records_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.pl_records
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();
DROP TRIGGER IF EXISTS trg_user_roles_set_audit_columns ON public.user_roles;
CREATE TRIGGER trg_user_roles_set_audit_columns
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_columns();

DROP TRIGGER IF EXISTS trg_employees_admin_log ON public.employees;
CREATE TRIGGER trg_employees_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_daily_orders_admin_log ON public.daily_orders;
CREATE TRIGGER trg_daily_orders_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_attendance_admin_log ON public.attendance;
CREATE TRIGGER trg_attendance_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_advances_admin_log ON public.advances;
CREATE TRIGGER trg_advances_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.advances
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_advance_installments_admin_log ON public.advance_installments;
CREATE TRIGGER trg_advance_installments_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.advance_installments
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_external_deductions_admin_log ON public.external_deductions;
CREATE TRIGGER trg_external_deductions_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.external_deductions
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_salary_records_admin_log ON public.salary_records;
CREATE TRIGGER trg_salary_records_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.salary_records
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_pl_records_admin_log ON public.pl_records;
CREATE TRIGGER trg_pl_records_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.pl_records
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();
DROP TRIGGER IF EXISTS trg_user_roles_admin_log ON public.user_roles;
CREATE TRIGGER trg_user_roles_admin_log
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_action_cud();

-- --------------------------------------------------------------------------
-- 5) Core RPCs (attendance + salary)
-- --------------------------------------------------------------------------

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS total_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS late BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_leave BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.check_in(
  p_employee_id uuid,
  p_checkin_at timestamptz DEFAULT now()
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance;
  v_date date := (p_checkin_at AT TIME ZONE 'UTC')::date;
  v_time time := (p_checkin_at AT TIME ZONE 'UTC')::time;
  v_start time := time '09:00:00';
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('attendance', 'write') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  INSERT INTO public.attendance (employee_id, date, status, check_in, late)
  VALUES (p_employee_id, v_date, 'present'::public.attendance_status, v_time, v_time > v_start)
  ON CONFLICT (employee_id, date)
  DO UPDATE SET
    check_in = EXCLUDED.check_in,
    status = 'present'::public.attendance_status,
    late = EXCLUDED.late
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out(
  p_employee_id uuid,
  p_checkout_at timestamptz DEFAULT now()
)
RETURNS public.attendance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.attendance;
  v_date date := (p_checkout_at AT TIME ZONE 'UTC')::date;
  v_time time := (p_checkout_at AT TIME ZONE 'UTC')::time;
  v_end time := time '18:00:00';
  v_hours numeric(6,2);
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('attendance', 'write') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  SELECT * INTO v_row
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND a.date = v_date
  LIMIT 1;

  IF v_row.id IS NULL OR v_row.check_in IS NULL THEN
    RAISE EXCEPTION 'No check-in found for this employee/date';
  END IF;

  v_hours := ROUND(GREATEST(EXTRACT(EPOCH FROM (v_time - v_row.check_in)), 0) / 3600.0, 2);

  UPDATE public.attendance
  SET
    check_out = v_time,
    total_hours = v_hours,
    early_leave = (v_time < v_end)
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_salary(
  p_employee_id uuid,
  p_month_year text,
  p_payment_method text DEFAULT 'cash',
  p_manual_deduction numeric DEFAULT 0,
  p_manual_deduction_note text DEFAULT NULL
)
RETURNS TABLE (
  employee_id uuid,
  month_year text,
  total_orders integer,
  attendance_days integer,
  base_salary numeric,
  attendance_deduction numeric,
  external_deduction numeric,
  advance_deduction numeric,
  manual_deduction numeric,
  net_salary numeric,
  calc_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_internal_user() OR NOT public.has_permission('salary', 'approve') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.calculate_salary_for_employee_month(
    p_employee_id,
    p_month_year,
    p_payment_method,
    p_manual_deduction,
    p_manual_deduction_note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_in(uuid, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.check_out(uuid, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_in(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary(uuid, text, text, numeric, text) TO authenticated;

