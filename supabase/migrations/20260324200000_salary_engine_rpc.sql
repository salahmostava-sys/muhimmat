-- Phase 2: Salary engine in DB (month-level calculation + persistence)

-- Piecewise tier function:
-- <=300: x3
-- <=400: 300x3 + (x-300)x4
-- <=440: 300x3 + 100x4 + (x-400)x5
-- <=460: fixed 2500
-- >460 : 2500 + (x-460)x5
CREATE OR REPLACE FUNCTION public.calc_tier_salary(total_orders INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  o INTEGER := GREATEST(COALESCE(total_orders, 0), 0);
BEGIN
  IF o <= 300 THEN
    RETURN o * 3;
  ELSIF o <= 400 THEN
    RETURN (300 * 3) + ((o - 300) * 4);
  ELSIF o <= 440 THEN
    RETURN (300 * 3) + (100 * 4) + ((o - 400) * 5);
  ELSIF o <= 460 THEN
    RETURN 2500;
  END IF;

  RETURN 2500 + ((o - 460) * 5);
END;
$$;

-- Calculate + persist one employee for one month.
CREATE OR REPLACE FUNCTION public.calculate_salary_for_employee_month(
  p_employee_id UUID,
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash',
  p_manual_deduction NUMERIC DEFAULT 0,
  p_manual_deduction_note TEXT DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  attendance_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_orders INTEGER := 0;
  v_attendance_days INTEGER := 0;
  v_base_salary NUMERIC := 0;
  v_attendance_deduction NUMERIC := 0;
  v_external_deduction NUMERIC := 0;
  v_advance_deduction NUMERIC := 0;
  v_manual_deduction NUMERIC := GREATEST(COALESCE(p_manual_deduction, 0), 0);
  v_net NUMERIC := 0;
BEGIN
  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  SELECT COALESCE(SUM(d.orders_count), 0)::INTEGER
    INTO v_orders
  FROM public.daily_orders d
  WHERE d.employee_id = p_employee_id
    AND d.date BETWEEN v_start AND v_end
    AND d.status <> 'cancelled';

  SELECT COALESCE(COUNT(*), 0)::INTEGER
    INTO v_attendance_days
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND a.date BETWEEN v_start AND v_end
    AND a.status IN ('present', 'late');

  v_base_salary := public.calc_tier_salary(v_orders);

  SELECT COALESCE(SUM(ed.amount), 0)
    INTO v_external_deduction
  FROM public.external_deductions ed
  WHERE ed.employee_id = p_employee_id
    AND ed.apply_month = p_month_year
    AND ed.approval_status = 'approved';

  SELECT COALESCE(SUM(ai.amount), 0)
    INTO v_advance_deduction
  FROM public.advances ad
  JOIN public.advance_installments ai ON ai.advance_id = ad.id
  WHERE ad.employee_id = p_employee_id
    AND ai.month_year = p_month_year
    AND ai.status IN ('pending', 'deferred');

  -- Keep compatibility with existing salary_records fields.
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
    'engine_v2',
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
    salary_records.employee_id,
    salary_records.month_year,
    v_orders,
    v_attendance_days,
    salary_records.base_salary,
    salary_records.attendance_deduction,
    salary_records.external_deduction,
    salary_records.advance_deduction,
    salary_records.manual_deduction,
    salary_records.net_salary,
    salary_records.calc_status
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

-- Calculate whole month for all active employees.
CREATE OR REPLACE FUNCTION public.calculate_salary_for_month(
  p_month_year TEXT,
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS TABLE (
  employee_id UUID,
  month_year TEXT,
  total_orders INTEGER,
  attendance_days INTEGER,
  base_salary NUMERIC,
  attendance_deduction NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  manual_deduction NUMERIC,
  net_salary NUMERIC,
  calc_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id
    FROM public.employees e
    WHERE e.status = 'active'
    ORDER BY e.name
  LOOP
    RETURN QUERY
    SELECT *
    FROM public.calculate_salary_for_employee_month(
      r.id,
      p_month_year,
      p_payment_method,
      0,
      NULL
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calc_tier_salary(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_employee_month(UUID, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_salary_for_month(TEXT, TEXT) TO authenticated;
