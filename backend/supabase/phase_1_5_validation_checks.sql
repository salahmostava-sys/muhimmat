-- ============================================================================
-- PHASE 1.5 VALIDATION CHECKS
-- Safe + repeatable validation for core RLS, policy drift, and permission matrix.
-- NOTE:
-- - This file never auto-drops policies.
-- - Mutation tests run inside transactions and always ROLLBACK.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0) Canonical core table list
-- --------------------------------------------------------------------------
WITH core_tables AS (
  SELECT unnest(ARRAY[
    'roles',
    'user_roles',
    'employees',
    'daily_orders',
    'attendance',
    'advances',
    'advance_installments',
    'external_deductions',
    'salary_records',
    'pl_records',
    'admin_action_log'
  ]) AS table_name
)
SELECT table_name
FROM core_tables
ORDER BY table_name;

-- --------------------------------------------------------------------------
-- 1) RLS status verification
-- Output: table_name + RLS status
-- --------------------------------------------------------------------------
WITH core_tables AS (
  SELECT unnest(ARRAY[
    'roles',
    'user_roles',
    'employees',
    'daily_orders',
    'attendance',
    'advances',
    'advance_installments',
    'external_deductions',
    'salary_records',
    'pl_records',
    'admin_action_log'
  ]) AS table_name
)
SELECT
  c.table_name,
  cls.relrowsecurity AS rls_enabled,
  cls.relforcerowsecurity AS rls_forced,
  CASE WHEN cls.relrowsecurity THEN 'OK' ELSE 'MISSING_RLS' END AS rls_status
FROM core_tables c
JOIN pg_class cls ON cls.relname = c.table_name
JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
WHERE nsp.nspname = 'public'
ORDER BY c.table_name;

-- --------------------------------------------------------------------------
-- 2) Legacy policy detection + SAFE DROP statement generation
-- Convention required: p_[table_name]_[action]
-- Actions considered: select | insert | update | delete
-- --------------------------------------------------------------------------

-- 2.1 List all existing policies for core tables.
WITH core_tables AS (
  SELECT unnest(ARRAY[
    'roles','user_roles','employees','daily_orders','attendance',
    'advances','advance_installments','external_deductions',
    'salary_records','pl_records','admin_action_log'
  ]) AS table_name
)
SELECT
  p.tablename AS table_name,
  p.policyname,
  p.cmd AS action,
  CASE
    WHEN p.policyname ~ ('^p_' || p.tablename || '_(select|insert|update|delete)$') THEN 'CONVENTION_OK'
    ELSE 'NON_STANDARD'
  END AS naming_status
FROM pg_policies p
JOIN core_tables c ON c.table_name = p.tablename
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;

-- 2.2 Policies NOT following required convention.
WITH core_tables AS (
  SELECT unnest(ARRAY[
    'roles','user_roles','employees','daily_orders','attendance',
    'advances','advance_installments','external_deductions',
    'salary_records','pl_records','admin_action_log'
  ]) AS table_name
)
SELECT
  p.tablename AS table_name,
  p.policyname AS legacy_policy_name,
  p.cmd AS action,
  format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, p.tablename) AS drop_statement
FROM pg_policies p
JOIN core_tables c ON c.table_name = p.tablename
WHERE p.schemaname = 'public'
  AND p.policyname !~ ('^p_' || p.tablename || '_(select|insert|update|delete)$')
ORDER BY p.tablename, p.policyname;

-- 2.3 Duplicate detector by action target.
-- If >1 policy exists for same (table, action), they may conflict.
WITH core_tables AS (
  SELECT unnest(ARRAY[
    'roles','user_roles','employees','daily_orders','attendance',
    'advances','advance_installments','external_deductions',
    'salary_records','pl_records','admin_action_log'
  ]) AS table_name
),
pol AS (
  SELECT p.tablename, p.policyname, p.cmd
  FROM pg_policies p
  JOIN core_tables c ON c.table_name = p.tablename
  WHERE p.schemaname = 'public'
),
dups AS (
  SELECT tablename, cmd, count(*) AS policy_count
  FROM pol
  GROUP BY tablename, cmd
  HAVING count(*) > 1
)
SELECT
  p.tablename AS table_name,
  p.cmd AS action,
  p.policyname,
  format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, p.tablename) AS drop_statement
FROM pol p
JOIN dups d
  ON d.tablename = p.tablename
 AND d.cmd = p.cmd
ORDER BY p.tablename, p.cmd, p.policyname;

-- --------------------------------------------------------------------------
-- 3) Role simulation prerequisites (admin + viewer existence checks)
-- Ensure test users exist in auth.users and user_roles.
-- --------------------------------------------------------------------------
WITH admin_pick AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'admin'::public.app_role
     OR lower(COALESCE(r.title, '')) = 'admin'
  LIMIT 1
),
viewer_pick AS (
  SELECT ur.user_id
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'viewer'::public.app_role
     OR lower(COALESCE(r.title, '')) = 'viewer'
  LIMIT 1
)
SELECT
  'admin' AS role_label,
  a.user_id,
  (a.user_id IS NOT NULL) AS exists_in_user_roles,
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id = a.user_id) AS exists_in_auth_users
FROM admin_pick a
UNION ALL
SELECT
  'viewer' AS role_label,
  v.user_id,
  (v.user_id IS NOT NULL) AS exists_in_user_roles,
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v.user_id) AS exists_in_auth_users
FROM viewer_pick v;

-- --------------------------------------------------------------------------
-- 4) has_permission() validation (direct checks)
-- --------------------------------------------------------------------------
DO $$
DECLARE
  v_admin uuid;
  v_viewer uuid;
  v_can boolean;
BEGIN
  SELECT ur.user_id INTO v_admin
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'admin'::public.app_role OR lower(COALESCE(r.title, '')) = 'admin'
  LIMIT 1;

  SELECT ur.user_id INTO v_viewer
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'viewer'::public.app_role OR lower(COALESCE(r.title, '')) = 'viewer'
  LIMIT 1;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  IF v_admin IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
    SELECT public.has_permission('employees', 'view') INTO v_can;
    RAISE NOTICE '[admin] has_permission(employees, view) => % (expected true)', v_can;
    SELECT public.has_permission('employees', 'write') INTO v_can;
    RAISE NOTICE '[admin] has_permission(employees, write) => % (expected true)', v_can;
  ELSE
    RAISE NOTICE '[admin] no test user found';
  END IF;

  IF v_viewer IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);
    SELECT public.has_permission('employees', 'view') INTO v_can;
    RAISE NOTICE '[viewer] has_permission(employees, view) => % (expected true)', v_can;
    SELECT public.has_permission('employees', 'write') INTO v_can;
    RAISE NOTICE '[viewer] has_permission(employees, write) => % (expected false)', v_can;
  ELSE
    RAISE NOTICE '[viewer] no test user found';
  END IF;
END $$;

-- --------------------------------------------------------------------------
-- 5) Permission testing matrix (SELECT/INSERT/UPDATE/DELETE)
-- - Runs for admin then viewer
-- - Uses transactions + rollback to avoid persistent changes
-- - Uses employees table for controlled CRUD probe
-- --------------------------------------------------------------------------

-- 5.1 Admin matrix
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_test_employee uuid;
  v_ok boolean;
  v_err text;
BEGIN
  SELECT ur.user_id INTO v_admin
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'admin'::public.app_role OR lower(COALESCE(r.title, '')) = 'admin'
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE NOTICE '[admin matrix] skipped (no admin user)';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

  -- SELECT
  BEGIN
    PERFORM 1 FROM public.employees LIMIT 1;
    RAISE NOTICE '[admin][SELECT employees] actual=ALLOW expected=ALLOW';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[admin][SELECT employees] actual=DENY expected=ALLOW err=%', SQLERRM;
  END;

  -- INSERT
  BEGIN
    INSERT INTO public.employees (name, status)
    VALUES ('PHASE15_ADMIN_TEST', 'active')
    RETURNING id INTO v_test_employee;
    RAISE NOTICE '[admin][INSERT employees] actual=ALLOW expected=ALLOW';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    RAISE NOTICE '[admin][INSERT employees] actual=DENY expected=ALLOW err=%', v_err;
  END;

  -- UPDATE
  IF v_test_employee IS NOT NULL THEN
    BEGIN
      UPDATE public.employees
      SET name = 'PHASE15_ADMIN_TEST_UPDATED'
      WHERE id = v_test_employee;
      RAISE NOTICE '[admin][UPDATE employees] actual=ALLOW expected=ALLOW';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[admin][UPDATE employees] actual=DENY expected=ALLOW err=%', SQLERRM;
    END;
  END IF;

  -- DELETE
  IF v_test_employee IS NOT NULL THEN
    BEGIN
      DELETE FROM public.employees WHERE id = v_test_employee;
      RAISE NOTICE '[admin][DELETE employees] actual=ALLOW expected=ALLOW';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[admin][DELETE employees] actual=DENY expected=ALLOW err=%', SQLERRM;
    END;
  END IF;
END $$;
ROLLBACK;

-- 5.2 Viewer matrix
BEGIN;
DO $$
DECLARE
  v_viewer uuid;
  v_any_employee uuid;
BEGIN
  SELECT ur.user_id INTO v_viewer
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'viewer'::public.app_role OR lower(COALESCE(r.title, '')) = 'viewer'
  LIMIT 1;

  IF v_viewer IS NULL THEN
    RAISE NOTICE '[viewer matrix] skipped (no viewer user)';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_viewer::text, true);

  -- SELECT
  BEGIN
    PERFORM 1 FROM public.employees LIMIT 1;
    RAISE NOTICE '[viewer][SELECT employees] actual=ALLOW expected=ALLOW';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[viewer][SELECT employees] actual=DENY expected=ALLOW err=%', SQLERRM;
  END;

  -- INSERT (expected deny)
  BEGIN
    INSERT INTO public.employees (name, status)
    VALUES ('PHASE15_VIEWER_TEST', 'active');
    RAISE NOTICE '[viewer][INSERT employees] actual=ALLOW expected=DENY';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[viewer][INSERT employees] actual=DENY expected=DENY err=%', SQLERRM;
  END;

  -- UPDATE (expected deny)
  SELECT id INTO v_any_employee FROM public.employees LIMIT 1;
  IF v_any_employee IS NOT NULL THEN
    BEGIN
      UPDATE public.employees SET name = name WHERE id = v_any_employee;
      RAISE NOTICE '[viewer][UPDATE employees] actual=ALLOW expected=DENY';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[viewer][UPDATE employees] actual=DENY expected=DENY err=%', SQLERRM;
    END;
  END IF;

  -- DELETE (expected deny)
  IF v_any_employee IS NOT NULL THEN
    BEGIN
      DELETE FROM public.employees WHERE id = v_any_employee;
      RAISE NOTICE '[viewer][DELETE employees] actual=ALLOW expected=DENY';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[viewer][DELETE employees] actual=DENY expected=DENY err=%', SQLERRM;
    END;
  END IF;
END $$;
ROLLBACK;

-- --------------------------------------------------------------------------
-- 6) Audit logging verification
-- - Verify created_by / updated_by population
-- - Verify admin_action_log receives INSERT/UPDATE/DELETE entries
-- - Fully rolled back
-- --------------------------------------------------------------------------
BEGIN;
DO $$
DECLARE
  v_admin uuid;
  v_emp_id uuid;
  v_created_by uuid;
  v_updated_by uuid;
  v_ins_count int;
  v_upd_count int;
  v_del_count int;
BEGIN
  SELECT ur.user_id INTO v_admin
  FROM public.user_roles ur
  LEFT JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.role = 'admin'::public.app_role OR lower(COALESCE(r.title, '')) = 'admin'
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE NOTICE '[audit] skipped (no admin user)';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);

  INSERT INTO public.employees (name, status)
  VALUES ('PHASE15_AUDIT_TEST', 'active')
  RETURNING id, created_by, updated_by
  INTO v_emp_id, v_created_by, v_updated_by;

  RAISE NOTICE '[audit][INSERT] created_by=% updated_by=% expected both=%',
    v_created_by, v_updated_by, v_admin;

  UPDATE public.employees
  SET name = 'PHASE15_AUDIT_TEST_UPDATED'
  WHERE id = v_emp_id
  RETURNING updated_by INTO v_updated_by;

  RAISE NOTICE '[audit][UPDATE] updated_by=% expected=%', v_updated_by, v_admin;

  DELETE FROM public.employees WHERE id = v_emp_id;

  SELECT count(*) INTO v_ins_count
  FROM public.admin_action_log
  WHERE table_name = 'employees'
    AND record_id = v_emp_id::text
    AND action = 'insert';

  SELECT count(*) INTO v_upd_count
  FROM public.admin_action_log
  WHERE table_name = 'employees'
    AND record_id = v_emp_id::text
    AND action = 'update';

  SELECT count(*) INTO v_del_count
  FROM public.admin_action_log
  WHERE table_name = 'employees'
    AND record_id = v_emp_id::text
    AND action = 'delete';

  RAISE NOTICE '[audit][admin_action_log] insert=% update=% delete=% (expected >=1 each)',
    v_ins_count, v_upd_count, v_del_count;
END $$;
ROLLBACK;

