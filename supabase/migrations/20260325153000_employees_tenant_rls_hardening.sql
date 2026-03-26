-- ============================================================================
-- Employees RLS hardening (tenant-aware)
-- ----------------------------------------------------------------------------
-- NOTE:
-- - Current schema uses employees.trade_register_id (UUID) as tenant key.
-- - JWT claim expected: company_id (UUID string).
-- - We map JWT company_id -> trade_register_id in policies below.
-- ============================================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Safe helper: parse company_id from JWT without raising cast errors.
CREATE OR REPLACE FUNCTION public.jwt_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN COALESCE(
      auth.jwt() ->> 'company_id',
      auth.jwt() -> 'app_metadata' ->> 'company_id',
      auth.jwt() -> 'user_metadata' ->> 'company_id',
      ''
    ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    THEN COALESCE(
      auth.jwt() ->> 'company_id',
      auth.jwt() -> 'app_metadata' ->> 'company_id',
      auth.jwt() -> 'user_metadata' ->> 'company_id'
    )::uuid
    ELSE NULL
  END;
$$;

-- Cleanup old policy variants created by earlier migrations.
DROP POLICY IF EXISTS "Authenticated can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin/finance/ops can view employees" ON public.employees;
DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Role scoped select employees" ON public.employees;
DROP POLICY IF EXISTS "HR admin manage employees" ON public.employees;
DROP POLICY IF EXISTS "Employees: select own company" ON public.employees;
DROP POLICY IF EXISTS "Employees: insert" ON public.employees;
DROP POLICY IF EXISTS "Employees: update" ON public.employees;
DROP POLICY IF EXISTS "Employees: delete" ON public.employees;

-- SELECT: active + role + tenant isolation.
CREATE POLICY "Employees: select own company"
ON public.employees
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND trade_register_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

-- INSERT: active + role + enforce tenant on inserted rows.
CREATE POLICY "Employees: insert"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND trade_register_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- UPDATE: active + role + tenant isolation (old and new row).
CREATE POLICY "Employees: update"
ON public.employees
FOR UPDATE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND trade_register_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND trade_register_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- DELETE: active + role + tenant isolation.
CREATE POLICY "Employees: delete"
ON public.employees
FOR DELETE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND trade_register_id = public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);
