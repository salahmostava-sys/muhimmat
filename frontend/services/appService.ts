import { supabase } from '@services/supabase/client';
import type { Json } from '@services/supabase/types';
import { toServiceError } from '@services/serviceError';

export interface AppUpsertPayload {
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  custom_columns: Json;
}

export const appService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active, custom_columns')
      .order('name');
    if (error) throw toServiceError(error, 'appService.getAll');
    return data ?? [];
  },

  create: async (payload: AppUpsertPayload) => {
    const { error } = await supabase.from('apps').insert(payload);
    if (error) throw toServiceError(error, 'appService.create');
  },

  update: async (id: string, payload: AppUpsertPayload) => {
    const { error } = await supabase.from('apps').update(payload).eq('id', id);
    if (error) throw toServiceError(error, 'appService.update');
  },

  toggleActive: async (id: string, isActive: boolean) => {
    const { error } = await supabase.from('apps').update({ is_active: isActive }).eq('id', id);
    if (error) throw toServiceError(error, 'appService.toggleActive');
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('apps').delete().eq('id', id);
    if (error) throw toServiceError(error, 'appService.delete');
  },

  countActiveEmployeeApps: async (appId: string) => {
    const { error, count } = await supabase
      .from('employee_apps')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', appId)
      .eq('status', 'active');
    if (error) throw toServiceError(error, 'appService.countActiveEmployeeApps');
    return count ?? 0;
  },

  getActiveEmployeeAppsWithEmployees: async (appId: string) => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, employees!inner(id, name, status, sponsorship_status)')
      .eq('app_id', appId)
      .eq('status', 'active');
    if (error) throw toServiceError(error, 'appService.getActiveEmployeeAppsWithEmployees');
    return data ?? [];
  },

  getEmployeeMonthlyOrders: async (employeeId: string, appId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw toServiceError(error, 'appService.getEmployeeMonthlyOrders');
    return data ?? [];
  },

  assignScheme: async (appId: string, schemeId: string | null) => {
    const { error } = await supabase.from('apps').update({ scheme_id: schemeId }).eq('id', appId);
    if (error) throw toServiceError(error, 'appService.assignScheme');
  },

  getActiveWithScheme: async () => {
    const { data, error } = await supabase.from('apps').select('id, name, scheme_id').eq('is_active', true).order('name');
    if (error) throw toServiceError(error, 'appService.getActiveWithScheme');
    return data ?? [];
  },

  getActiveWithSalarySchemes: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, scheme_id, salary_schemes(id, name, name_en, status, scheme_type, monthly_amount, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order, tier_type, incremental_threshold, incremental_price))')
      .eq('is_active', true);
    if (error) throw toServiceError(error, 'appService.getActiveWithSalarySchemes');
    return data ?? [];
  },

  /** Monthly order target for one app (YYYY-MM), or null if not set */
  getAppTargetForMonth: async (appId: string, monthYear: string) => {
    const { data, error } = await supabase
      .from('app_targets')
      .select('target_orders')
      .eq('app_id', appId)
      .eq('month_year', monthYear)
      .maybeSingle();
    if (error) throw toServiceError(error, 'appService.getAppTargetForMonth');
    return data?.target_orders ?? null;
  },
};
