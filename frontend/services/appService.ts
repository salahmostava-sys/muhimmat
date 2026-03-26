import { supabase } from '@services/supabase/client';
import type { Json } from '@services/supabase/types';
import { throwIfError } from '@services/serviceError';

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
    throwIfError(error, 'appService.getAll');
    return { data, error: null };
  },

  create: async (payload: AppUpsertPayload) => {
    const { data, error } = await supabase.from('apps').insert(payload);
    throwIfError(error, 'appService.create');
    return { data, error: null };
  },

  update: async (id: string, payload: AppUpsertPayload) => {
    const { data, error } = await supabase.from('apps').update(payload).eq('id', id);
    throwIfError(error, 'appService.update');
    return { data, error: null };
  },

  toggleActive: async (id: string, isActive: boolean) => {
    const { data, error } = await supabase.from('apps').update({ is_active: isActive }).eq('id', id);
    throwIfError(error, 'appService.toggleActive');
    return { data, error: null };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('apps').delete().eq('id', id);
    throwIfError(error, 'appService.delete');
    return { error: null };
  },

  countActiveEmployeeApps: async (appId: string) => {
    const { data, error, count } = await supabase
      .from('employee_apps')
      .select('id', { count: 'exact', head: true })
      .eq('app_id', appId)
      .eq('status', 'active');
    throwIfError(error, 'appService.countActiveEmployeeApps');
    return { data, count, error: null };
  },

  getActiveEmployeeAppsWithEmployees: async (appId: string) => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, employees!inner(id, name, status, sponsorship_status)')
      .eq('app_id', appId)
      .eq('status', 'active');
    throwIfError(error, 'appService.getActiveEmployeeAppsWithEmployees');
    return { data, error: null };
  },

  getEmployeeMonthlyOrders: async (employeeId: string, appId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', startDate)
      .lte('date', endDate);
    throwIfError(error, 'appService.getEmployeeMonthlyOrders');
    return { data, error: null };
  },

  assignScheme: async (appId: string, schemeId: string | null) => {
    const { data, error } = await supabase.from('apps').update({ scheme_id: schemeId }).eq('id', appId);
    throwIfError(error, 'appService.assignScheme');
    return { data, error: null };
  },

  getActiveWithScheme: async () => {
    const { data, error } = await supabase.from('apps').select('id, name, scheme_id').eq('is_active', true).order('name');
    throwIfError(error, 'appService.getActiveWithScheme');
    return { data, error: null };
  },

  getActiveWithSalarySchemes: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, scheme_id, salary_schemes(id, name, name_en, status, scheme_type, monthly_amount, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order, tier_type, incremental_threshold, incremental_price))')
      .eq('is_active', true);
    throwIfError(error, 'appService.getActiveWithSalarySchemes');
    return { data, error: null };
  },
};
