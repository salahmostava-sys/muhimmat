import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';
import { authService } from '@/services/authService';

export interface DailyOrder {
  id: string;
  employee_id: string;
  date: string;
  app_id: string;
  orders_count: number;
  created_at: string;
  updated_at: string;
}

export interface OrderFilter {
  employeeId?: string;
  appId?: string;
  date?: string;
  monthYear?: string;
}

type ActiveEmployee = {
  id: string;
  name: string;
  salary_type: string;
  status: string;
  sponsorship_status: string | null;
};

type ActiveApp = {
  id: string;
  name: string;
  name_en: string | null;
  logo_url?: string | null;
};

type EmployeeAppRow = {
  employee_id: string;
  app_id: string;
};

export const orderService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('*')
      .order('date', { ascending: false });
    throwIfError(error, 'orderService.getAll');
    return { data, error };
  },

  getOrdersByEmployeeMonth: async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_orders')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    throwIfError(error, 'orderService.getOrdersByEmployeeMonth');
    return { data, error };
  },

  getSalaryContextOrdersByMonth: async (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, app_id, orders_count, apps(name, id)')
      .gte('date', from)
      .lte('date', to);
    throwIfError(error, 'orderService.getSalaryContextOrdersByMonth');
    return { data, error };
  },

  getByDate: async (date: string, filters: Pick<OrderFilter, 'employeeId' | 'appId'> = {}) => {
    let query = supabase
      .from('daily_orders')
      .select('*, employees(name, name_en), apps(name, name_en, brand_color)')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);

    const { data, error } = await query;
    throwIfError(error, 'orderService.getByDate');
    return { data, error };
  },

  getByMonth: async (monthYear: string, filters: Pick<OrderFilter, 'employeeId' | 'appId'> = {}) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    let query = supabase
      .from('daily_orders')
      .select('*, employees(name, name_en), apps(name, name_en, brand_color)')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);

    const { data, error } = await query;
    throwIfError(error, 'orderService.getByMonth');
    return { data, error };
  },

  upsert: async (employeeId: string, date: string, appId: string, ordersCount: number) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .upsert(
        { employee_id: employeeId, date, app_id: appId, orders_count: ordersCount },
        { onConflict: 'employee_id,date,app_id' }
      )
      .select()
      .single();
    throwIfError(error, 'orderService.upsert');
    return { data, error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('daily_orders').delete().eq('id', id);
    throwIfError(error, 'orderService.delete');
    return { error };
  },

  getTotalByEmployee: async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to);
    throwIfError(error, 'orderService.getTotalByEmployee');

    const total = data?.reduce((sum, row) => sum + (row.orders_count ?? 0), 0) ?? 0;
    return { total, error };
  },

  getAppTargets: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('*, apps(name, name_en, brand_color)')
      .eq('month_year', monthYear);
    throwIfError(error, 'orderService.getAppTargets');
    return { data, error };
  },

  upsertAppTarget: async (appId: string, monthYear: string, targetOrders: number) => {
    const { data, error } = await supabase
      .from('app_targets')
      .upsert(
        { app_id: appId, month_year: monthYear, target_orders: targetOrders },
        { onConflict: 'app_id,month_year' }
      )
      .select()
      .single();
    throwIfError(error, 'orderService.upsertAppTarget');
    return { data, error };
  },

  getMonthRaw: async (year: number, month: number) => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const to = new Date(year, month, 0).toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, app_id, date, orders_count')
      .gte('date', from)
      .lte('date', to);
    throwIfError(error, 'orderService.getMonthRaw');
    return { data, error };
  },

  bulkUpsert: async (rows: { employee_id: string; app_id: string; date: string; orders_count: number }[], chunkSize = 200) => {
    let saved = 0;
    const failed: string[] = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('daily_orders')
        .upsert(chunk, { onConflict: 'employee_id,app_id,date' });
      if (error) failed.push(...chunk.map(r => r.date));
      else saved += chunk.length;
    }
    return { saved, failed };
  },

  getActiveEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, salary_type, status, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'orderService.getActiveEmployees');
    return { data: (data || []) as ActiveEmployee[], error };
  },

  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, name_en, logo_url')
      .eq('is_active', true)
      .order('name');
    throwIfError(error, 'orderService.getActiveApps');
    return { data: (data || []) as ActiveApp[], error };
  },

  getEmployeeAppAssignments: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, app_id');
    throwIfError(error, 'orderService.getEmployeeAppAssignments');
    return { data: (data || []) as EmployeeAppRow[], error };
  },

  getMonthLockStatus: async (month_year: string) => {
    const { data, error } = await supabase
      .from('locked_months')
      .select('month_year')
      .eq('month_year', month_year)
      .maybeSingle();
    throwIfError(error, 'orderService.getMonthLockStatus');
    return { locked: !!data, error };
  },

  lockMonth: async (month_year: string) => {
    const { user } = await authService.getCurrentUser();
    const userId = user?.id ?? null;
    const { error } = await supabase.from('locked_months').upsert(
      { month_year, locked_at: new Date().toISOString(), locked_by: userId },
      { onConflict: 'month_year' }
    );
    throwIfError(error, 'orderService.lockMonth');
    return { error };
  },
};
