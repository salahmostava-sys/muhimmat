import { supabase } from '@/integrations/supabase/client';

export interface PlatformApp {
  id: string;
  name: string;
  brand_color: string;
  text_color: string;
}

export interface PlatformEmployee {
  id: string;
  name: string;
  /** رقم الهوية / الإقامة — للاقتراح عند ربط المندوب بالحساب */
  national_id?: string | null;
  /** تاريخ انتهاء الإقامة — للاقتراح التلقائي */
  residency_expiry?: string | null;
}

export interface PlatformAccount {
  id: string;
  app_id: string;
  employee_id?: string | null;
  account_username: string;
  account_id_on_platform: string | null;
  iqama_number: string | null;
  iqama_expiry_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
}

export interface PlatformAccountWritePayload {
  app_id: string;
  account_username: string;
  employee_id: string | null;
  account_id_on_platform: string | null;
  iqama_number: string | null;
  iqama_expiry_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

export const platformAccountService = {
  getApps: async () =>
    supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name'),

  getEmployees: async () =>
    supabase
      .from('employees')
      .select('id, name, national_id, residency_expiry, sponsorship_status')
      .eq('status', 'active')
      .order('name'),

  getAccounts: async () =>
    supabase.from('platform_accounts').select('*').order('created_at', { ascending: false }),

  /**
   * Server-side list for large volumes (pagination + filters).
   * Notes:
   * - Branch filter is derived from employees.city (makkah/jeddah).
   */
  getAccountsPaged: async (params: {
    page: number; // 1-based
    pageSize: number;
    filters?: {
      employeeId?: string;
      appId?: string;
      status?: 'active' | 'inactive';
      branch?: 'makkah' | 'jeddah';
      search?: string;
    };
  }) => {
    const { page, pageSize } = params;
    const filters = params.filters ?? {};

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('platform_accounts')
      .select(
        'id, app_id, employee_id, account_username, account_id_on_platform, iqama_number, iqama_expiry_date, status, notes, created_at, apps(id, name, brand_color, text_color), employees(id, name, city)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.appId) query = query.eq('app_id', filters.appId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      query = query.or(
        [
          `account_username.ilike.%${q}%`,
          `account_id_on_platform.ilike.%${q}%`,
          `iqama_number.ilike.%${q}%`,
          `employees.name.ilike.%${q}%`,
        ].join(',')
      );
    }

    const { data, error, count } = await query;
    return { data: data || [], error, count: count ?? 0 };
  },

  createAccount: async (payload: PlatformAccountWritePayload) =>
    supabase.from('platform_accounts').insert(payload),

  updateAccount: async (id: string, payload: PlatformAccountWritePayload) =>
    supabase.from('platform_accounts').update(payload).eq('id', id),

  syncAccountEmployee: async (id: string, employeeId: string) =>
    supabase.from('platform_accounts').update({ employee_id: employeeId }).eq('id', id),
};