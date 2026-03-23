import { supabase } from '@/integrations/supabase/client';

export interface DriverFilters {
  status?: 'active' | 'inactive' | 'ended';
  city?: string;
  search?: string;
}

export const driverService = {
  getAll: async (filters: DriverFilters = {}) => {
    let query = supabase
      .from('employees')
      .select(`
        *,
        departments(id, name, name_en),
        positions(id, name, name_en),
        employee_apps(app_id, username, status, apps(name, name_en, brand_color))
      `)
      .order('name', { ascending: true });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.city) query = query.eq('city', filters.city as any);
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,name_en.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,national_id.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    return { data, error };
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        departments(id, name, name_en),
        positions(id, name, name_en),
        employee_apps(app_id, username, status, joined_date, apps(name, name_en, brand_color)),
        employee_scheme(scheme_id, assigned_date, salary_schemes(name, name_en))
      `)
      .eq('id', id)
      .single();
    return { data, error };
  },

  create: async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    return { data, error };
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    return { error };
  },

  deactivate: async (id: string) => {
    const { data, error } = await supabase
      .from('employees')
      .update({ status: 'inactive' })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  getStats: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('status, city');

    const stats = {
      total: data?.length ?? 0,
      active: data?.filter(e => e.status === 'active').length ?? 0,
      inactive: data?.filter(e => e.status === 'inactive').length ?? 0,
      ended: data?.filter(e => e.status === 'ended').length ?? 0,
    };

    return { stats, error };
  },

  getAttendanceToday: async (date: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, employees(name, name_en)')
      .eq('date', date);
    return { data, error };
  },

  assignApp: async (employeeId: string, appId: string, username?: string) => {
    const { data, error } = await supabase
      .from('employee_apps')
      .upsert(
        { employee_id: employeeId, app_id: appId, username: username ?? null },
        { onConflict: 'employee_id,app_id' }
      )
      .select()
      .single();
    return { data, error };
  },
};
