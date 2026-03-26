-- Fix employees RLS when jwt_company_id() is NULL.
-- In SQL, `NULL = NULL` yields NULL (not TRUE), causing WITH CHECK to fail.
-- Use `IS NOT DISTINCT FROM` for tenant comparisons so NULL-safe equality works.

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employees: select own company" ON public.employees;
DROP POLICY IF EXISTS "Employees: insert" ON public.employees;
DROP POLICY IF EXISTS "Employees: update" ON public.employees;
DROP POLICY IF EXISTS "Employees: delete" ON public.employees;

CREATE POLICY "Employees: select own company"
ON public.employees
FOR SELECT
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id IS NOT DISTINCT FROM public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

CREATE POLICY "Employees: insert"
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id IS NOT DISTINCT FROM public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Employees: update"
ON public.employees
FOR UPDATE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id IS NOT DISTINCT FROM public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND company_id IS NOT DISTINCT FROM public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Employees: delete"
ON public.employees
FOR DELETE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND company_id IS NOT DISTINCT FROM public.jwt_company_id()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

