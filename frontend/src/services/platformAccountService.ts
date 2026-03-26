import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';

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
  getApps: async () => {
    const { data, error } = await supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name');
    throwIfError(error, 'platformAccountService.getApps');
    return { data, error: null };
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, national_id, residency_expiry, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'platformAccountService.getEmployees');
    return { data, error: null };
  },

  getAccounts: async () => {
    const { data, error } = await supabase.from('platform_accounts').select('*').order('created_at', { ascending: false });
    throwIfError(error, 'platformAccountService.getAccounts');
    return { data, error: null };
  },

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
    throwIfError(error, 'platformAccountService.getAccountsPaged');
    return { data: data || [], error: null, count: count ?? 0 };
  },

  /** Export helper for large datasets (chunked). */
  exportAccounts: async (params: {
    filters?: {
      employeeId?: string;
      appId?: string;
      status?: 'active' | 'inactive';
      branch?: 'makkah' | 'jeddah';
      search?: string;
    };
    chunkSize?: number;
    maxRows?: number;
  }) => {
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 20_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await platformAccountService.getAccountsPaged({
        page,
        pageSize: chunkSize,
        filters,
      });
      all.push(...(res.data || []));
      if ((res.data || []).length < chunkSize) break;
    }
    return { data: all, error: null };
  },

  createAccount: async (payload: PlatformAccountWritePayload) => {
    const { data, error } = await supabase.from('platform_accounts').insert(payload);
    throwIfError(error, 'platformAccountService.createAccount');
    return { data, error: null };
  },

  updateAccount: async (id: string, payload: PlatformAccountWritePayload) => {
    const { data, error } = await supabase.from('platform_accounts').update(payload).eq('id', id);
    throwIfError(error, 'platformAccountService.updateAccount');
    return { data, error: null };
  },

  syncAccountEmployee: async (id: string, employeeId: string) => {
    const { data, error } = await supabase.from('platform_accounts').update({ employee_id: employeeId }).eq('id', id);
    throwIfError(error, 'platformAccountService.syncAccountEmployee');
    return { data, error: null };
  },
};