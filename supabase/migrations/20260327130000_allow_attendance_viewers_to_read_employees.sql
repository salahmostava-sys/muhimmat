-- Fix: Attendance page needs active employees list.
-- Some roles have attendance:view without employees:view, causing empty riders.

BEGIN;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_policy ON public.employees;

CREATE POLICY employees_select_policy
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.is_internal_user()
  AND (
    public.has_permission('employees', 'view')
    OR public.has_permission('attendance', 'view')
  )
);

COMMIT;

