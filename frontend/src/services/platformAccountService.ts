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
      .select('id, name, national_id, residency_expiry')
      .eq('status', 'active')
      .order('name'),

  getAccounts: async () =>
    supabase.from('platform_accounts').select('*').order('created_at', { ascending: false }),

  createAccount: async (payload: PlatformAccountWritePayload) =>
    supabase.from('platform_accounts').insert(payload),

  updateAccount: async (id: string, payload: PlatformAccountWritePayload) =>
    supabase.from('platform_accounts').update(payload).eq('id', id),

  syncAccountEmployee: async (id: string, employeeId: string) =>
    supabase.from('platform_accounts').update({ employee_id: employeeId }).eq('id', id),
};