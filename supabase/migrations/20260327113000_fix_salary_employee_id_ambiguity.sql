-- Fix ambiguous employee_id references in salary RPC path.
-- Recreates salary functions with fully-qualified column references.

CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id uuid,
  p_month_year text,
  p_payment_method text DEFAULT 'cash'::text,
  p_manual_deduction numeric DEFAULT 0,
  p_manual_deduction_note text DEFAULT NULL::text
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
DECLARE
  v_start date;
  v_end date;
  v_orders integer := 0;
  v_attendance_days integer := 0;
  v_base_salary numeric := 0;
  v_attendance_deduction numeric := 0;
  v_external_deduction numeric := 0;
  v_advance_deduction numeric := 0;
  v_manual_deduction numeric := GREATEST(COALESCE(p_manual_deduction, 0), 0);
  v_net numeric := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.employees AS e
    WHERE e.id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  SELECT COALESCE(SUM(d.orders_count), 0)::integer
  INTO v_orders
  FROM public.daily_orders AS d
  WHERE d.employee_id = p_employee_id
    AND d.date BETWEEN v_start AND v_end
    AND (d.status IS NULL OR d.status <> 'cancelled');

  SELECT COALESCE(COUNT(*), 0)::integer
  INTO v_attendance_days
  FROM public.attendance AS a
  WHERE a.employee_id = p_employee_id
    AND a.date BETWEEN v_start AND v_end
    AND a.status IN ('present', 'late');

  v_base_salary := public.calc_tier_salary(v_orders);

  SELECT COALESCE(SUM(ed.amount), 0)
  INTO v_external_deduction
  FROM public.external_deductions AS ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = 'approved';

  SELECT COALESCE(SUM(ai.amount), 0)
  INTO v_advance_deduction
  FROM public.advances AS ad
  JOIN public.advance_installments AS ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN ('pending', 'deferred');

  v_attendance_deduction := 0;
  v_net := GREATEST(
    v_base_salary
    - v_attendance_deduction
    - v_external_deduction
    - v_advance_deduction
    - v_manual_deduction,
    0
  );

  INSERT INTO public.salary_records (
    employee_id,
    month_year,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    manual_deduction_note,
    net_salary,
    payment_method,
    calc_status,
    calc_source,
    is_approved
  )
  VALUES (
    p_employee_id,
    p_month_year,
    v_base_salary,
    v_attendance_deduction,
    v_external_deduction,
    v_advance_deduction,
    v_manual_deduction,
    p_manual_deduction_note,
    v_net,
    COALESCE(NULLIF(TRIM(p_payment_method), ''), 'cash'),
    'calculated',
    'engine_v3',
    false
  )
  ON CONFLICT (employee_id, month_year)
  DO UPDATE SET
    base_salary = EXCLUDED.base_salary,
    attendance_deduction = EXCLUDED.attendance_deduction,
    external_deduction = EXCLUDED.external_deduction,
    advance_deduction = EXCLUDED.advance_deduction,
    manual_deduction = EXCLUDED.manual_deduction,
    manual_deduction_note = EXCLUDED.manual_deduction_note,
    net_salary = EXCLUDED.net_salary,
    payment_method = EXCLUDED.payment_method,
    calc_status = EXCLUDED.calc_status,
    calc_source = EXCLUDED.calc_source,
    updated_at = now()
  RETURNING
    public.salary_records.employee_id,
    public.salary_records.month_year,
    v_orders,
    v_attendance_days,
    public.salary_records.base_salary,
    public.salary_records.attendance_deduction,
    public.salary_records.external_deduction,
    public.salary_records.advance_deduction,
    public.salary_records.manual_deduction,
    public.salary_records.net_salary,
    public.salary_records.calc_status
  INTO
    employee_id,
    month_year,
    total_orders,
    attendance_days,
    base_salary,
    attendance_deduction,
    external_deduction,
    advance_deduction,
    manual_deduction,
    net_salary,
    calc_status;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year text,
  p_payment_method text DEFAULT 'cash'::text
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
DECLARE
  v_emp record;
BEGIN
  FOR v_emp IN
    SELECT e.id
    FROM public.employees AS e
    WHERE e.status = 'active'
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      v_emp.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
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

