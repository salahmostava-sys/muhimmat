-- ============================================================================
-- Read-only salary preview RPC (no persistence)
-- Used by edge function to power Salaries table preview from backend engine.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_salary_for_month(
  p_month_year TEXT
)
RETURNS TABLE (
  employee_id UUID,
  total_orders INTEGER,
  base_salary NUMERIC,
  external_deduction NUMERIC,
  advance_deduction NUMERIC,
  net_salary NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE;
  v_end DATE;
  v_company_id UUID := public.jwt_company_id();
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Missing company_id in JWT';
  END IF;

  v_start := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end := (v_start + INTERVAL '1 month - 1 day')::date;

  RETURN QUERY
  WITH active_emp AS (
    SELECT e.id
    FROM public.employees e
    WHERE e.status = 'active'
      AND e.company_id = v_company_id
  ),
  orders_cte AS (
    SELECT
      d.employee_id,
      COALESCE(SUM(d.orders_count), 0)::INTEGER AS total_orders
    FROM public.daily_orders d
    JOIN active_emp ae ON ae.id = d.employee_id
    WHERE d.company_id = v_company_id
      AND d.date BETWEEN v_start AND v_end
      AND (d.status IS NULL OR d.status <> 'cancelled')
    GROUP BY d.employee_id
  ),
  ext_cte AS (
    SELECT
      ed.employee_id,
      COALESCE(SUM(ed.amount), 0)::NUMERIC AS external_deduction
    FROM public.external_deductions ed
    JOIN active_emp ae ON ae.id = ed.employee_id
    WHERE ed.company_id = v_company_id
      AND ed.apply_month = p_month_year
      AND ed.approval_status = 'approved'
    GROUP BY ed.employee_id
  ),
  adv_cte AS (
    SELECT
      ad.employee_id,
      COALESCE(SUM(ai.amount), 0)::NUMERIC AS advance_deduction
    FROM public.advances ad
    JOIN public.advance_installments ai ON ai.advance_id = ad.id
    JOIN active_emp ae ON ae.id = ad.employee_id
    WHERE ad.company_id = v_company_id
      AND ai.company_id = v_company_id
      AND ai.month_year = p_month_year
      AND ai.status IN ('pending', 'deferred')
    GROUP BY ad.employee_id
  )
  SELECT
    ae.id AS employee_id,
    COALESCE(o.total_orders, 0) AS total_orders,
    public.calc_tier_salary(COALESCE(o.total_orders, 0)) AS base_salary,
    COALESCE(ex.external_deduction, 0) AS external_deduction,
    COALESCE(ad.advance_deduction, 0) AS advance_deduction,
    GREATEST(
      public.calc_tier_salary(COALESCE(o.total_orders, 0))
      - COALESCE(ex.external_deduction, 0)
      - COALESCE(ad.advance_deduction, 0),
      0
    ) AS net_salary
  FROM active_emp ae
  LEFT JOIN orders_cte o ON o.employee_id = ae.id
  LEFT JOIN ext_cte ex ON ex.employee_id = ae.id
  LEFT JOIN adv_cte ad ON ad.employee_id = ae.id
  ORDER BY ae.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.preview_salary_for_month(TEXT) TO service_role;
