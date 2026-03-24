-- ============================================================================
-- Tenant RLS hardening for operations/finance tables
-- Scope:
--   - attendance
--   - daily_orders
--   - advances
--   - advance_installments
--   - salary_records
--   - external_deductions
-- ============================================================================

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_deductions ENABLE ROW LEVEL SECURITY;

-- Helper: installment belongs to my company through advances -> employees.
CREATE OR REPLACE FUNCTION public.advance_in_my_company(_advance_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.advances a
    JOIN public.employees e ON e.id = a.employee_id
    WHERE a.id = _advance_id
      AND e.company_id = public.jwt_company_id()
  );
$$;

-- --------------------------------------------------------------------------
-- attendance
-- --------------------------------------------------------------------------
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

CREATE POLICY "Attendance: select own company"
ON public.attendance
FOR SELECT
TO authenticated
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
FOR INSERT
TO authenticated
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
FOR UPDATE
TO authenticated
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
FOR DELETE
TO authenticated
USING (
  is_active_user(auth.uid())
  AND public.employee_in_my_company(employee_id)
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'hr'::app_role)
  )
);

-- --------------------------------------------------------------------------
-- daily_orders
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Active users can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Operations/admin can manage daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Ops/HR/admin can manage daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Ops/HR/admin/finance can view daily_orders" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: select own company" ON public.daily_orders;
DROP POLICY IF EXISTS "Daily orders: manage own company" ON public.daily_orders;

CREATE POLICY "Daily orders: select own company"
ON public.daily_orders
FOR SELECT
TO authenticated
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
FOR ALL
TO authenticated
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

-- --------------------------------------------------------------------------
-- advances
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view advances" ON public.advances;
DROP POLICY IF EXISTS "Active users can view advances" ON public.advances;
DROP POLICY IF EXISTS "Finance/admin can manage advances" ON public.advances;
DROP POLICY IF EXISTS "Finance/admin/hr can view advances" ON public.advances;
DROP POLICY IF EXISTS "Advances: select own company" ON public.advances;
DROP POLICY IF EXISTS "Advances: manage own company" ON public.advances;

CREATE POLICY "Advances: select own company"
ON public.advances
FOR SELECT
TO authenticated
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
FOR ALL
TO authenticated
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

-- --------------------------------------------------------------------------
-- advance_installments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Active users can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin can manage advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Finance/admin/hr can view advance_installments" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: select own company" ON public.advance_installments;
DROP POLICY IF EXISTS "Advance installments: manage own company" ON public.advance_installments;

CREATE POLICY "Advance installments: select own company"
ON public.advance_installments
FOR SELECT
TO authenticated
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
FOR ALL
TO authenticated
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

-- --------------------------------------------------------------------------
-- salary_records
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Finance/admin can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance/admin can manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance admin select salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Finance admin manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: select own company" ON public.salary_records;
DROP POLICY IF EXISTS "Salary records: manage own company" ON public.salary_records;

CREATE POLICY "Salary records: select own company"
ON public.salary_records
FOR SELECT
TO authenticated
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
FOR ALL
TO authenticated
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

-- --------------------------------------------------------------------------
-- external_deductions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "Finance/admin can view external_deductions" ON public.external_deductions;
DROP POLICY IF EXISTS "Finance/admin can manage external_deductions" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: select own company" ON public.external_deductions;
DROP POLICY IF EXISTS "External deductions: manage own company" ON public.external_deductions;

CREATE POLICY "External deductions: select own company"
ON public.external_deductions
FOR SELECT
TO authenticated
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
FOR ALL
TO authenticated
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
