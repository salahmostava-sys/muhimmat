import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

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
  getSchemes: async () =>
    supabase.from('salary_schemes').select('*').order('created_at', { ascending: false }),

  getTiers: async () =>
    supabase.from('salary_scheme_tiers').select('*').order('tier_order'),

  getSnapshots: async () =>
    supabase.from('scheme_month_snapshots').select('scheme_id, month_year'),

  updateScheme: async (schemeId: string, payload: SchemePayload) =>
    supabase.from('salary_schemes').update(payload).eq('id', schemeId),

  createScheme: async (payload: SchemePayload) =>
    supabase.from('salary_schemes').insert(payload).select('id').single(),

  deleteSchemeTiers: async (schemeId: string) =>
    supabase.from('salary_scheme_tiers').delete().eq('scheme_id', schemeId),

  insertSchemeTiers: async (payload: TierInsertPayload[]) =>
    supabase.from('salary_scheme_tiers').insert(payload),

  updateSchemeStatus: async (schemeId: string, status: 'active' | 'archived') =>
    supabase.from('salary_schemes').update({ status }).eq('id', schemeId),

  upsertSnapshot: async (schemeId: string, monthYear: string, snapshot: Json) =>
    supabase
      .from('scheme_month_snapshots')
      .upsert({ scheme_id: schemeId, month_year: monthYear, snapshot }, { onConflict: 'scheme_id,month_year' }),

  deleteSnapshot: async (schemeId: string, monthYear: string) =>
    supabase.from('scheme_month_snapshots').delete().eq('scheme_id', schemeId).eq('month_year', monthYear),
};
