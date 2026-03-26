import { supabase } from '@services/supabase/client';
import type { Json } from '@services/supabase/types';
import { throwIfError } from '@services/serviceError';

interface SchemePayload {
  name: string;
  scheme_type: 'order_based' | 'fixed_monthly';
  monthly_amount: number | null;
  target_orders: number | null;
  target_bonus: number | null;
}

interface TierInsertPayload {
  scheme_id: string;
  from_orders: number;
  to_orders: number | null;
  price_per_order: number;
  tier_order: number;
  tier_type: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental';
  incremental_threshold: number | null;
  incremental_price: number | null;
}

export const salarySchemeService = {
  getSchemes: async () => {
    const { data, error } = await supabase.from('salary_schemes').select('*').order('created_at', { ascending: false });
    throwIfError(error, 'salarySchemeService.getSchemes');
    return { data, error: null };
  },

  getTiers: async () => {
    const { data, error } = await supabase.from('salary_scheme_tiers').select('*').order('tier_order');
    throwIfError(error, 'salarySchemeService.getTiers');
    return { data, error: null };
  },

  getSnapshots: async () => {
    const { data, error } = await supabase.from('scheme_month_snapshots').select('scheme_id, month_year');
    throwIfError(error, 'salarySchemeService.getSnapshots');
    return { data, error: null };
  },

  updateScheme: async (schemeId: string, payload: SchemePayload) => {
    const { data, error } = await supabase.from('salary_schemes').update(payload).eq('id', schemeId);
    throwIfError(error, 'salarySchemeService.updateScheme');
    return { data, error: null };
  },

  createScheme: async (payload: SchemePayload) => {
    const { data, error } = await supabase.from('salary_schemes').insert(payload).select('id').single();
    throwIfError(error, 'salarySchemeService.createScheme');
    return { data, error: null };
  },

  deleteSchemeTiers: async (schemeId: string) => {
    const { error } = await supabase.from('salary_scheme_tiers').delete().eq('scheme_id', schemeId);
    throwIfError(error, 'salarySchemeService.deleteSchemeTiers');
    return { error: null };
  },

  insertSchemeTiers: async (payload: TierInsertPayload[]) => {
    const { data, error } = await supabase.from('salary_scheme_tiers').insert(payload);
    throwIfError(error, 'salarySchemeService.insertSchemeTiers');
    return { data, error: null };
  },

  updateSchemeStatus: async (schemeId: string, status: 'active' | 'archived') => {
    const { data, error } = await supabase.from('salary_schemes').update({ status }).eq('id', schemeId);
    throwIfError(error, 'salarySchemeService.updateSchemeStatus');
    return { data, error: null };
  },

  upsertSnapshot: async (schemeId: string, monthYear: string, snapshot: Json) => {
    const { data, error } = await supabase
      .from('scheme_month_snapshots')
      .upsert({ scheme_id: schemeId, month_year: monthYear, snapshot }, { onConflict: 'scheme_id,month_year' });
    throwIfError(error, 'salarySchemeService.upsertSnapshot');
    return { data, error: null };
  },

  deleteSnapshot: async (schemeId: string, monthYear: string) => {
    const { error } = await supabase.from('scheme_month_snapshots').delete().eq('scheme_id', schemeId).eq('month_year', monthYear);
    throwIfError(error, 'salarySchemeService.deleteSnapshot');
    return { error: null };
  },
};
