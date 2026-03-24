import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AppUpsertPayload {
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  custom_columns: Json;
}

export const appService = {
  getAll: async () =>
    supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active, custom_columns')
      .order('name'),

  create: async (payload: AppUpsertPayload) =>
    supabase.from('apps').insert(payload),

  update: async (id: string, payload: AppUpsertPayload) =>
    supabase.from('apps').update(payload).eq('id', id),

  toggleActive: async (id: string, isActive: boolean) =>
    supabase.from('apps').update({ is_active: isActive }).eq('id', id),

  delete: async (id: string) =>
    supabase.from('apps').delete().eq('id', id),

  countActiveEmployeeApps: async (appId: string) =>
    supabase
      .from('employee_apps')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', appId)
      .eq('status', 'active'),

  getActiveEmployeeAppsWithEmployees: async (appId: string) =>
    supabase
      .from('employee_apps')
      .select('employee_id, employees!inner(id, name, status, sponsorship_status)')
      .eq('app_id', appId)
      .eq('status', 'active'),

  getEmployeeMonthlyOrders: async (employeeId: string, appId: string, startDate: string, endDate: string) =>
    supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', startDate)
      .lte('date', endDate),

  assignScheme: async (appId: string, schemeId: string | null) =>
    supabase.from('apps').update({ scheme_id: schemeId }).eq('id', appId),

  getActiveWithScheme: async () =>
    supabase.from('apps').select('id, name, scheme_id').eq('is_active', true).order('name'),
};
