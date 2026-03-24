-- RLS hardening for core payroll-related tables
-- Scope: employees, attendance, salary_records

-- ============================================================================
-- employees
-- ============================================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR/admin can manage employees" ON public.employees;

CREATE POLICY "Role scoped select employees"
  ON public.employees FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role) OR
      has_role(auth.uid(), 'viewer'::app_role)
    )
  );

CREATE POLICY "HR admin manage employees"
  ON public.employees FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- ============================================================================
-- attendance
-- ============================================================================
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "HR/admin can manage attendance" ON public.attendance;

CREATE POLICY "Role scoped select attendance"
  ON public.attendance FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role) OR
      has_role(auth.uid(), 'operations'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "HR admin insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE POLICY "HR admin update attendance"
  ON public.attendance FOR UPDATE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

CREATE POLICY "HR admin delete attendance"
  ON public.attendance FOR DELETE
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'hr'::app_role)
    )
  );

-- ============================================================================
-- salary_records
-- ============================================================================
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance/admin can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;

CREATE POLICY "Finance admin select salary_records"
  ON public.salary_records FOR SELECT
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );

CREATE POLICY "Finance admin manage salary_records"
  ON public.salary_records FOR ALL
  USING (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid()) AND (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'finance'::app_role)
    )
  );
