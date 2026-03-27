-- Final cleanup: remove any remaining company_id dependencies.
-- Single-organization mode: no tenant company_id checks anywhere.

BEGIN;

-- 1) Defensive drop of company_id columns (if any were recreated).
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.employees DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.attendance DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.daily_orders DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advances DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.advance_installments DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.external_deductions DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.salary_records DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_accounts DROP COLUMN IF EXISTS company_id CASCADE;
ALTER TABLE IF EXISTS public.platform_account_assignments DROP COLUMN IF EXISTS company_id CASCADE;

-- 2) Remove old trigger functions that force company_id.
DROP TRIGGER IF EXISTS trg_sync_attendance_company_id ON public.attendance;
DROP TRIGGER IF EXISTS trg_sync_daily_orders_company_id ON public.daily_orders;
DROP TRIGGER IF EXISTS trg_sync_advances_company_id ON public.advances;
DROP TRIGGER IF EXISTS trg_sync_external_deductions_company_id ON public.external_deductions;
DROP TRIGGER IF EXISTS trg_sync_salary_records_company_id ON public.salary_records;
DROP TRIGGER IF EXISTS trg_sync_advance_installments_company_id ON public.advance_installments;

DROP FUNCTION IF EXISTS public.sync_attendance_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_daily_orders_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_advances_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_external_deductions_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_salary_records_company_id() CASCADE;
DROP FUNCTION IF EXISTS public.sync_advance_installments_company_id() CASCADE;

-- 3) Recreate helper functions in single-org-safe form (no company_id).
CREATE OR REPLACE FUNCTION public.employee_in_my_company(_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = _employee_id
  );
$$;

CREATE OR REPLACE FUNCTION public.advance_in_my_company(_advance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.advances AS a
    WHERE a.id = _advance_id
  );
$$;

-- 4) Rebuild key RLS policies without company_id references.
-- attendance
DROP POLICY IF EXISTS "Attendance: select own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: insert own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: update own company" ON public.attendance;
DROP POLICY IF EXISTS "Attendance: delete own company" ON public.attendance;

CREATE POLICY "Attendance: select own company"
ON public.attendance
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Attendance: insert own company"
ON public.attendance
FOR INSERT TO authenticated
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Attendance: update own company"
ON public.attendance
FOR UPDATE TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

CREATE POLICY "Attendance: delete own company"
ON public.attendance
FOR DELETE TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- daily_orders
DROP POLICY IF EXISTS "Daily orders: select own company" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: manage own company" ON public.daily_orders;

CREATE POLICY "Daily orders: select own company"
ON public.daily_orders
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Daily orders: manage own company"
ON public.daily_orders
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  )
);

-- advances
DROP POLICY IF EXISTS "Advances: select own company" ON public.advances;
DROP POLICY IF EXISTS "Advances: manage own company" ON public.advances;

CREATE POLICY "Advances: select own company"
ON public.advances
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Advances: manage own company"
ON public.advances
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

-- advance_installments
DROP POLICY IF EXISTS "Advance installments: select own company" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: manage own company" ON public.advance_installments;

CREATE POLICY "Advance installments: select own company"
ON public.advance_installments
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.advance_in_my_company(advance_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Advance installments: manage own company"
ON public.advance_installments
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.advance_in_my_company(advance_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.advance_in_my_company(advance_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

-- salary_records
DROP POLICY IF EXISTS "Salary records: select own company" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: manage own company" ON public.salary_records;

CREATE POLICY "Salary records: select own company"
ON public.salary_records
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "Salary records: manage own company"
ON public.salary_records
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

-- external_deductions
DROP POLICY IF EXISTS "External deductions: select own company" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: manage own company" ON public.external_deductions;

CREATE POLICY "External deductions: select own company"
ON public.external_deductions
FOR SELECT TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

CREATE POLICY "External deductions: manage own company"
ON public.external_deductions
FOR ALL TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
)
WITH CHECK (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'finance'::app_role)
  )
);

COMMIT;

