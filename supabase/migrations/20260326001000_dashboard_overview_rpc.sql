-- Dashboard overview aggregation (server-side).
-- Returns a single JSON payload for the main dashboard tab.

CREATE OR REPLACE FUNCTION public.dashboard_overview_rpc(
  p_month_year TEXT,
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := to_date(p_month_year || '-01', 'YYYY-MM-DD');
  v_end DATE := (v_start + INTERVAL '1 month - 1 day')::date;
  v_prev_start DATE := (v_start - INTERVAL '1 month')::date;
  v_prev_end DATE := (v_start - INTERVAL '1 day')::date;
  v_week_start DATE := (p_today - INTERVAL '6 day')::date;
BEGIN
  IF NOT (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'hr'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
      OR has_role(auth.uid(), 'operations'::app_role)
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN (
    WITH
      apps_active AS (
        SELECT a.id, a.name, COALESCE(a.brand_color, '#6366f1') AS brand_color, COALESCE(a.text_color, '#ffffff') AS text_color
        FROM public.apps a
        WHERE a.is_active = true
      ),
      emp_details AS (
        SELECT e.id, e.city, e.license_status, e.sponsorship_status
        FROM public.employees e
        WHERE e.status = 'active'
      ),
      att_today AS (
        SELECT
          COUNT(*) FILTER (WHERE a.status = 'present')::INT AS present,
          COUNT(*) FILTER (WHERE a.status = 'absent')::INT  AS absent,
          COUNT(*) FILTER (WHERE a.status = 'late')::INT    AS late,
          COUNT(*) FILTER (WHERE a.status = 'leave')::INT   AS leave,
          COUNT(*) FILTER (WHERE a.status = 'sick')::INT    AS sick
        FROM public.attendance a
        WHERE a.date = p_today
      ),
      att_week AS (
        SELECT
          a.date::TEXT AS date,
          COUNT(*) FILTER (WHERE a.status = 'present')::INT AS present,
          COUNT(*) FILTER (WHERE a.status = 'absent')::INT  AS absent,
          COUNT(*) FILTER (WHERE a.status = 'late')::INT    AS late,
          COUNT(*) FILTER (WHERE a.status = 'leave')::INT   AS leave,
          COUNT(*) FILTER (WHERE a.status = 'sick')::INT    AS sick
        FROM public.attendance a
        WHERE a.date BETWEEN v_week_start AND p_today
        GROUP BY a.date
        ORDER BY a.date
      ),
      prev_month_orders AS (
        SELECT COALESCE(SUM(d.orders_count), 0)::INT AS total
        FROM public.daily_orders d
        WHERE d.date BETWEEN v_prev_start AND v_prev_end
      ),
      best_rate AS (
        SELECT DISTINCT ON (pr.app_id)
          pr.app_id,
          COALESCE(pr.rate_per_order, 0)::NUMERIC AS rate
        FROM public.pricing_rules pr
        WHERE pr.is_active = true
          AND pr.rule_type = 'per_order'
          AND pr.min_orders = 0
          AND pr.max_orders IS NULL
          AND pr.rate_per_order IS NOT NULL
        ORDER BY pr.app_id, COALESCE(pr.priority, 0) DESC
      ),
      targets AS (
        SELECT t.app_id, COALESCE(t.target_orders, 0)::INT AS target_orders
        FROM public.app_targets t
        WHERE t.month_year = p_month_year
      ),
      orders_by_app AS (
        SELECT
          d.app_id,
          COALESCE(a.name, '—') AS app,
          COALESCE(a.brand_color, '#6366f1') AS brand_color,
          COALESCE(a.text_color, '#ffffff') AS text_color,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders,
          COUNT(DISTINCT d.employee_id)::INT AS riders,
          COALESCE(t.target_orders, 0)::INT AS target,
          COALESCE(br.rate, 0)::NUMERIC AS rate_per_order,
          (COALESCE(SUM(d.orders_count), 0) * COALESCE(br.rate, 0))::NUMERIC AS est_revenue
        FROM public.daily_orders d
        LEFT JOIN apps_active a ON a.id = d.app_id
        LEFT JOIN targets t ON t.app_id = d.app_id
        LEFT JOIN best_rate br ON br.app_id = d.app_id
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
        GROUP BY d.app_id, a.name, a.brand_color, a.text_color, t.target_orders, br.rate
        ORDER BY orders DESC
      ),
      orders_by_city AS (
        SELECT
          COALESCE(e.city, 'unknown') AS city,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders
        FROM public.daily_orders d
        JOIN public.employees e ON e.id = d.employee_id
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
          AND e.city IN ('makkah', 'jeddah')
        GROUP BY e.city
        ORDER BY orders DESC
      ),
      rider_app AS (
        SELECT
          d.employee_id,
          d.app_id,
          COALESCE(SUM(d.orders_count), 0)::INT AS orders,
          ROW_NUMBER() OVER (PARTITION BY d.employee_id ORDER BY COALESCE(SUM(d.orders_count), 0) DESC) AS rn
        FROM public.daily_orders d
        WHERE d.date BETWEEN v_start AND LEAST(v_end, p_today)
        GROUP BY d.employee_id, d.app_id
      ),
      riders AS (
        SELECT
          r.employee_id,
          COALESCE(e.name, '') AS name,
          r.orders,
          r.app_id,
          COALESCE(a.name, '—') AS app,
          COALESCE(a.brand_color, '#6366f1') AS app_color
        FROM rider_app r
        LEFT JOIN public.employees e ON e.id = r.employee_id
        LEFT JOIN apps_active a ON a.id = r.app_id
        WHERE r.rn = 1
        ORDER BY r.orders DESC
      ),
      recent_activity AS (
        SELECT al.action, al.table_name, al.created_at, al.user_id
        FROM public.audit_log al
        ORDER BY al.created_at DESC
        LIMIT 6
      ),
      counts AS (
        SELECT
          (SELECT COUNT(*)::INT FROM public.vehicles v WHERE v.status = 'active') AS active_vehicles,
          (SELECT COUNT(*)::INT FROM public.alerts al WHERE al.is_resolved = false) AS active_alerts,
          (SELECT COUNT(*)::INT FROM apps_active) AS active_apps
      ),
      totals AS (
        SELECT
          COALESCE((SELECT SUM(o.orders)::INT FROM orders_by_app o), 0) AS total_orders,
          COALESCE((SELECT SUM(o.est_revenue)::NUMERIC FROM orders_by_app o), 0) AS est_revenue_total
      )
    SELECT jsonb_build_object(
      'monthYear', p_month_year,
      'today', p_today::TEXT,
      'apps', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.name) FROM apps_active a), '[]'::jsonb),
      'empDetails', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM emp_details e), '[]'::jsonb),
      'attendanceToday', (SELECT to_jsonb(t) FROM att_today t),
      'attendanceWeek', COALESCE((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.date) FROM att_week w), '[]'::jsonb),
      'ordersByApp', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'appId', o.app_id,
            'app', o.app,
            'orders', o.orders,
            'riders', o.riders,
            'brandColor', o.brand_color,
            'textColor', o.text_color,
            'target', o.target,
            'estRevenue', ROUND(o.est_revenue)
          )
          ORDER BY o.orders DESC
        )
        FROM orders_by_app o
      ), '[]'::jsonb),
      'ordersByCity', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.orders DESC) FROM orders_by_city c), '[]'::jsonb),
      'riders', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employee_id', r.employee_id,
            'name', r.name,
            'orders', r.orders,
            'appId', r.app_id,
            'app', r.app,
            'appColor', r.app_color
          )
          ORDER BY r.orders DESC
        )
        FROM riders r
      ), '[]'::jsonb),
      'recentActivity', COALESCE((SELECT jsonb_agg(to_jsonb(ra) ORDER BY ra.created_at DESC) FROM recent_activity ra), '[]'::jsonb),
      'kpis', jsonb_build_object(
        'prevMonthOrders', (SELECT total FROM prev_month_orders),
        'activeVehicles', (SELECT active_vehicles FROM counts),
        'activeAlerts', (SELECT active_alerts FROM counts),
        'activeApps', (SELECT active_apps FROM counts),
        'totalOrders', (SELECT total_orders FROM totals),
        'estRevenueTotal', (SELECT est_revenue_total FROM totals)
      )
    )
  );
END;
$$;

