import { supabase } from '@services/supabase/client';
import { format, endOfMonth } from 'date-fns';
import { throwIfError } from '@services/serviceError';

export interface DashboardKPIs {
  totalOrders: number;
  totalSalaries: number;
  activeAdvances: number;
  activeEmployees: number;
  presentToday: number;
  absentToday: number;
}

export interface AppOrderSummary {
  appId: string;
  appName: string;
  brandColor: string;
  textColor: string;
  totalOrders: number;
  employeeCount: number;
}

export interface AttendanceTrendPoint {
  date: string;
  present: number;
  absent: number;
  leave: number;
}

export const dashboardService = {
  /** Server-side aggregated overview (RPC) */
  getOverviewRpc: async (monthYear: string, today: string) => {
    const { data, error } = await supabase.rpc('dashboard_overview_rpc', {
      p_month_year: monthYear,
      p_today: today,
    });
    throwIfError(error, 'dashboardService.getOverviewRpc');
    return { data, error: null };
  },

  /** Active apps with basic metadata */
  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, brand_color, text_color')
      .eq('is_active', true);
    throwIfError(error, 'dashboardService.getActiveApps');
    return { data, error: null };
  },

  /** Active employee count */
  getActiveEmployeeCount: async () => {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    throwIfError(error, 'dashboardService.getActiveEmployeeCount');
    return { count: count ?? 0, error: null };
  },

  /** Approved salary totals for a given month (YYYY-MM) */
  getMonthSalaryTotal: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('net_salary')
      .eq('month_year', monthYear)
      .eq('is_approved', true);
    const total = data?.reduce((sum, r) => sum + (r.net_salary ?? 0), 0) ?? 0;
    throwIfError(error, 'dashboardService.getMonthSalaryTotal');
    return { total, error: null };
  },

  /** Total active advance amount */
  getActiveAdvancesTotal: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('amount')
      .eq('status', 'active');
    const total = data?.reduce((sum, r) => sum + (r.amount ?? 0), 0) ?? 0;
    throwIfError(error, 'dashboardService.getActiveAdvancesTotal');
    return { total, error: null };
  },

  /** Today's attendance breakdown */
  getAttendanceToday: async (date: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('status')
      .eq('date', date);
    const present = data?.filter(r => r.status === 'present').length ?? 0;
    const absent  = data?.filter(r => r.status === 'absent').length  ?? 0;
    const leave   = data?.filter(r => r.status === 'leave').length   ?? 0;
    throwIfError(error, 'dashboardService.getAttendanceToday');
    return { present, absent, leave, error: null };
  },

  /** Orders per month with employee+app detail (for platform breakdown) */
  getMonthOrders: async (monthYear: string) => {
    const start = `${monthYear}-01`;
    const end   = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, app_id, orders_count, apps(id, name, brand_color, text_color), employees(name)')
      .gte('date', start)
      .lte('date', end);
    throwIfError(error, 'dashboardService.getMonthOrders');
    return { data, error: null };
  },

  /** Simple orders count for a previous month (for trend comparison) */
  getMonthOrdersCount: async (monthYear: string) => {
    const start = `${monthYear}-01`;
    const end   = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .gte('date', start)
      .lte('date', end);
    const total = data?.reduce((sum, r) => sum + (r.orders_count ?? 0), 0) ?? 0;
    throwIfError(error, 'dashboardService.getMonthOrdersCount');
    return { total, error: null };
  },

  /** Attendance trend for the last N days */
  getAttendanceTrend: async (from: string, to: string): Promise<{ data: AttendanceTrendPoint[]; error: unknown }> => {
    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    const grouped: Record<string, AttendanceTrendPoint> = {};
    data?.forEach(r => {
      if (!grouped[r.date]) grouped[r.date] = { date: r.date, present: 0, absent: 0, leave: 0 };
      if (r.status === 'present') grouped[r.date].present++;
      else if (r.status === 'absent') grouped[r.date].absent++;
      else if (r.status === 'leave') grouped[r.date].leave++;
    });

    throwIfError(error, 'dashboardService.getAttendanceTrend');
    return { data: Object.values(grouped), error: null };
  },

  /** Latest audit log entries */
  getRecentActivity: async (limit = 6) => {
    const { data, error } = await supabase
      .from('audit_log')
      .select('action, table_name, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfError(error, 'dashboardService.getRecentActivity');
    return { data, error: null };
  },

  /** Active employee-app assignments (for platform employee map) */
  getEmployeeAppAssignments: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('app_id, employee_id, apps(name, brand_color, text_color)')
      .eq('status', 'active');
    throwIfError(error, 'dashboardService.getEmployeeAppAssignments');
    return { data, error: null };
  },

  /** System settings (project name, logo, subtitle) */
  getSystemSettings: async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('project_name_ar, project_name_en, project_subtitle_ar, project_subtitle_en, logo_url')
      .limit(1)
      .maybeSingle();
    throwIfError(error, 'dashboardService.getSystemSettings');
    return { data, error: null };
  },

  /** Employee city + license + sponsorship distribution (for map/stats) */
  getEmployeeDistribution: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, city, license_status, sponsorship_status')
      .eq('status', 'active');
    throwIfError(error, 'dashboardService.getEmployeeDistribution');
    return { data, error: null };
  },

  /** Active vehicles count */
  getActiveVehiclesCount: async () => {
    const { count, error } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    throwIfError(error, 'dashboardService.getActiveVehiclesCount');
    return { count: count ?? 0, error: null };
  },

  /** Unresolved alerts count */
  getUnresolvedAlertsCount: async () => {
    const { count, error } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('is_resolved', false);
    throwIfError(error, 'dashboardService.getUnresolvedAlertsCount');
    return { count: count ?? 0, error: null };
  },

  /** App monthly targets */
  getAppTargets: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('app_id, target_orders')
      .eq('month_year', monthYear);
    throwIfError(error, 'dashboardService.getAppTargets');
    return { data, error: null };
  },

  /**
   * Main dashboard data — all 11 queries in one parallel call.
   * Returns raw Supabase response objects so callers need zero reshaping.
   */
  fetchMainData: async (today: string, currentMonth: string, prevStart: string, prevEnd: string, sixDaysAgo: string) => {
    const [empRes, attRes, ordersRes, prevOrdersRes, weekAttRes, auditRes, empDetailsRes, vehiclesRes, alertsRes, appsRes, targetsRes, pricingRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('daily_orders').select('employee_id, app_id, orders_count, apps(id, name, brand_color, text_color), employees(name, city)').gte('date', currentMonth + '-01').lte('date', today),
      supabase.from('daily_orders').select('orders_count').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
      supabase.from('audit_log').select('action, table_name, created_at, user_id').order('created_at', { ascending: false }).limit(6),
      supabase.from('employees').select('id, city, license_status, sponsorship_status').eq('status', 'active'),
      supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
      supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
      supabase.from('app_targets').select('app_id, target_orders').eq('month_year', currentMonth),
      supabase.from('pricing_rules').select('app_id, rule_type, rate_per_order, fixed_salary, is_active, priority, min_orders, max_orders').eq('is_active', true),
    ]);
    throwIfError(empRes.error, 'dashboardService.fetchMainData.empRes');
    throwIfError(attRes.error, 'dashboardService.fetchMainData.attRes');
    throwIfError(ordersRes.error, 'dashboardService.fetchMainData.ordersRes');
    throwIfError(prevOrdersRes.error, 'dashboardService.fetchMainData.prevOrdersRes');
    throwIfError(weekAttRes.error, 'dashboardService.fetchMainData.weekAttRes');
    throwIfError(auditRes.error, 'dashboardService.fetchMainData.auditRes');
    throwIfError(empDetailsRes.error, 'dashboardService.fetchMainData.empDetailsRes');
    throwIfError(vehiclesRes.error, 'dashboardService.fetchMainData.vehiclesRes');
    throwIfError(alertsRes.error, 'dashboardService.fetchMainData.alertsRes');
    throwIfError(appsRes.error, 'dashboardService.fetchMainData.appsRes');
    throwIfError(targetsRes.error, 'dashboardService.fetchMainData.targetsRes');
    throwIfError(pricingRes.error, 'dashboardService.fetchMainData.pricingRes');
    return { empRes, attRes, ordersRes, prevOrdersRes, weekAttRes, auditRes, empDetailsRes, vehiclesRes, alertsRes, appsRes, targetsRes, pricingRes };
  },

  /**
   * Historical chart data — apps + employees list + N-month orders.
   */
  fetchHistoricalData: async (months: { start: string; end: string }[]) => {
    const [appsRes, empRes, ...monthOrdersResults] = await Promise.all([
      supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
      supabase.from('employees').select('id, name').eq('status', 'active'),
      ...months.map(m =>
        supabase.from('daily_orders').select('employee_id, orders_count, app_id').gte('date', m.start).lte('date', m.end)
      ),
    ]);
    throwIfError(appsRes.error, 'dashboardService.fetchHistoricalData.appsRes');
    throwIfError(empRes.error, 'dashboardService.fetchHistoricalData.empRes');
    monthOrdersResults.forEach((result, idx) => {
      throwIfError(result.error, `dashboardService.fetchHistoricalData.monthOrdersResults.${idx}`);
    });
    return { appsRes, empRes, monthOrdersResults };
  },

  /** All KPIs in one parallel fetch */
  getKPIs: async (monthYear: string, today: string): Promise<{ kpis: DashboardKPIs; error: unknown }> => {
    const [empRes, attRes, advRes, salRes] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('advances').select('amount').eq('status', 'active'),
      supabase.from('salary_records').select('net_salary').eq('month_year', monthYear).eq('is_approved', true),
    ]);

    const kpis: DashboardKPIs = {
      activeEmployees: empRes.count ?? 0,
      presentToday:   attRes.data?.filter(r => r.status === 'present').length ?? 0,
      absentToday:    attRes.data?.filter(r => r.status === 'absent').length  ?? 0,
      activeAdvances: advRes.data?.reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0,
      totalSalaries:  salRes.data?.reduce((s, r) => s + (r.net_salary ?? 0), 0) ?? 0,
      totalOrders:    0, // filled separately via getMonthOrders
    };

    throwIfError(empRes.error, 'dashboardService.getKPIs.empRes');
    throwIfError(attRes.error, 'dashboardService.getKPIs.attRes');
    throwIfError(advRes.error, 'dashboardService.getKPIs.advRes');
    throwIfError(salRes.error, 'dashboardService.getKPIs.salRes');
    return { kpis, error: null };
  },
};
