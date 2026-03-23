import { supabase } from '@/integrations/supabase/client';

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

export const orderService = {
  getByDate: async (date: string, filters: Pick<OrderFilter, 'employeeId' | 'appId'> = {}) => {
    let query = supabase
      .from('daily_orders')
      .select('*, employees(name, name_en), apps(name, name_en, brand_color)')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);

    const { data, error } = await query;
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
    return { data, error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('daily_orders').delete().eq('id', id);
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

    const total = data?.reduce((sum, row) => sum + (row.orders_count ?? 0), 0) ?? 0;
    return { total, error };
  },

  getAppTargets: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('*, apps(name, name_en, brand_color)')
      .eq('month_year', monthYear);
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
};
