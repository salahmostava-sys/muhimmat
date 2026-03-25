import { supabase } from '@/integrations/supabase/client';

export interface SalaryRecordPayload {
  employee_id: string;
  month_year: string;
  base_salary?: number;
  orders_count?: number;
  order_bonus?: number;
  attendance_deduction?: number;
  advance_deduction?: number;
  other_deduction?: number;
  other_bonus?: number;
  net_salary?: number;
  is_approved?: boolean;
  notes?: string;
}

export interface SalaryRpcParams {
  monthYear: string;
  paymentMethod?: string;
}

export interface SalaryPreviewRow {
  employee_id: string;
  total_orders: number;
  base_salary: number;
  external_deduction: number;
  advance_deduction: number;
  net_salary: number;
}

export type PricingCalcType = 'per_order' | 'fixed' | 'hybrid';

export interface PricingRule {
  id: string;
  app_id: string;
  min_orders: number;
  max_orders: number | null;
  rule_type: PricingCalcType;
  rate_per_order: number | null;
  fixed_salary: number | null;
  is_active?: boolean;
  priority?: number;
}

export interface SalaryCalculationResult {
  totalOrders: number;
  matchedRule: PricingRule | null;
  salary: number;
}

export interface SalarySchemeTier {
  from_orders: number;
  to_orders: number | null;
  price_per_order: number;
  tier_order: number;
  tier_type?: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental';
  incremental_threshold?: number | null;
  incremental_price?: number | null;
}

export const salaryService = {
  calculateTierSalary: (
    orders: number,
    tiers: SalarySchemeTier[] | undefined,
    targetOrders: number | null,
    targetBonus: number | null
  ): number => {
    if (!tiers || tiers.length === 0 || orders === 0) return 0;
    const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);

    let matchedTier = sorted[0];
    for (const tier of sorted) {
      const from = tier.from_orders;
      const to = tier.to_orders ?? Infinity;
      if (orders >= from && orders <= to) {
        matchedTier = tier;
        break;
      }
      if (orders > (tier.to_orders ?? Infinity)) matchedTier = tier;
    }

    let total = 0;
    const tierType = matchedTier?.tier_type || 'total_multiplier';

    if (tierType === 'fixed_amount') {
      total = matchedTier.price_per_order;
    } else if (tierType === 'base_plus_incremental') {
      const threshold = matchedTier.incremental_threshold ?? matchedTier.from_orders;
      const incrPrice = matchedTier.incremental_price ?? 0;
      const extra = Math.max(0, orders - threshold);
      total = matchedTier.price_per_order + extra * incrPrice;
    } else {
      for (const tier of sorted) {
        const from = tier.from_orders;
        const to = tier.to_orders ?? Infinity;
        if (orders < from) break;
        const inTier = Math.min(orders, to) - from + 1;
        if (inTier <= 0) continue;
        total += inTier * tier.price_per_order;
      }
    }

    if (targetOrders && targetBonus && orders >= targetOrders) {
      total += targetBonus;
    }
    return Math.round(total);
  },

  calculateFixedMonthlySalary: (monthlyAmount: number, attendanceDays: number): number => {
    if (!monthlyAmount || monthlyAmount <= 0) return 0;
    return Math.round((monthlyAmount / 30) * attendanceDays);
  },

  getPricingRules: async (appId: string) => {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('id, app_id, min_orders, max_orders, rule_type, rate_per_order, fixed_salary, is_active, priority')
      .eq('app_id', appId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('min_orders', { ascending: true });
    return { data: (data || []) as PricingRule[], error };
  },

  getOrderCount: async (employeeId: string, appId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_orders')
      .select('orders_count')
      .eq('employee_id', employeeId)
      .eq('app_id', appId)
      .gte('date', from)
      .lte('date', to);

    const total = (data || []).reduce((sum, row) => sum + (row.orders_count ?? 0), 0);
    return { total, error };
  },

  applyPricingRules: (rules: PricingRule[], orders: number): SalaryCalculationResult => {
    const matched = rules.find(
      (rule) => orders >= rule.min_orders && (rule.max_orders === null || orders <= rule.max_orders)
    ) ?? null;

    if (!matched) {
      return { totalOrders: orders, matchedRule: null, salary: 0 };
    }

    if (matched.rule_type === 'fixed') {
      return { totalOrders: orders, matchedRule: matched, salary: Number(matched.fixed_salary || 0) };
    }
    if (matched.rule_type === 'per_order') {
      return { totalOrders: orders, matchedRule: matched, salary: orders * Number(matched.rate_per_order || 0) };
    }

    return {
      totalOrders: orders,
      matchedRule: matched,
      salary: Number(matched.fixed_salary || 0) + orders * Number(matched.rate_per_order || 0),
    };
  },

  calculateSalaryByRules: async (employeeId: string, appId: string, monthYear: string) => {
    const [{ data: rules, error: rulesError }, { total, error: ordersError }] = await Promise.all([
      salaryService.getPricingRules(appId),
      salaryService.getOrderCount(employeeId, appId, monthYear),
    ]);
    if (rulesError) {
      return { data: null, error: rulesError };
    }
    if (ordersError) {
      return { data: null, error: ordersError };
    }

    const result = salaryService.applyPricingRules(rules, total);
    return { data: result, error: null };
  },

  calculateSalaryForEmployeeMonth: async (
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) => {
    const { data, error } = await supabase.rpc('calculate_salary', {
      p_employee_id: employeeId,
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
      p_manual_deduction: manualDeduction,
      p_manual_deduction_note: manualDeductionNote,
    });
    return { data, error };
  },

  calculateSalaryForMonth: async ({ monthYear, paymentMethod = 'cash' }: SalaryRpcParams) => {
    const { data, error } = await supabase.rpc('calculate_salary_for_month', {
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
    });
    return { data, error };
  },

  getSalaryPreviewForMonth: async (monthYear: string) => {
    const { data, error } = await supabase.functions.invoke('salary-engine', {
      body: {
        mode: 'month_preview',
        month_year: monthYear,
      },
    });
    if (error) return { data: null, error };
    const payload = ((data as { data?: unknown } | null)?.data ?? data) as SalaryPreviewRow[] | null;
    return { data: payload || [], error: null };
  },

  getByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*, employees(name, national_id, salary_type)')
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  /** Server-side salary_records list for large volumes (pagination + filters). */
  getPagedByMonth: async (params: {
    monthYear: string;
    page: number; // 1-based
    pageSize: number;
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string; // employee name/national id
      approved?: 'all' | 'approved' | 'pending';
    };
  }) => {
    const { monthYear, page, pageSize } = params;
    const filters = params.filters ?? {};
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('salary_records')
      .select(
        'id, employee_id, month_year, net_salary, base_salary, advance_deduction, external_deduction, manual_deduction, attendance_deduction, is_approved, created_at, employees(id, name, national_id, city)',
        { count: 'exact' }
      )
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.approved === 'approved') query = query.eq('is_approved', true);
    if (filters.approved === 'pending') query = query.eq('is_approved', false);
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      query = query.or(`employees.name.ilike.%${q}%,employees.national_id.ilike.%${q}%`);
    }

    const { data, error, count } = await query;
    return { data: data || [], error, count: count ?? 0 };
  },

  /** Export helper for large salary_records datasets (chunked). */
  exportMonth: async (params: {
    monthYear: string;
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string;
      approved?: 'all' | 'approved' | 'pending';
    };
    chunkSize?: number;
    maxRows?: number;
  }) => {
    const { monthYear } = params;
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 50_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await salaryService.getPagedByMonth({ monthYear, page, pageSize: chunkSize, filters });
      if (res.error) return { data: all, error: res.error };
      all.push(...(res.data || []));
      if ((res.data || []).length < chunkSize) break;
    }
    return { data: all, error: null };
  },

  getMonthRecordsForSalaryContext: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('employee_id, is_approved, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction')
      .eq('month_year', monthYear);
    return { data, error };
  },

  getByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('month_year', { ascending: false });
    return { data, error };
  },

  upsert: async (payload: SalaryRecordPayload) => {
    const { data, error } = await supabase
      .from('salary_records')
      .upsert(payload, { onConflict: 'employee_id,month_year' })
      .select()
      .single();
    return { data, error };
  },

  upsertMany: async (records: Record<string, unknown>[]) => {
    const { error } = await supabase
      .from('salary_records')
      .upsert(records, { onConflict: 'employee_id,month_year' });
    return { error };
  },

  update: async (id: string, payload: Partial<SalaryRecordPayload>) => {
    const { data, error } = await supabase
      .from('salary_records')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  approve: async (id: string) => {
    const { error } = await supabase
      .from('salary_records')
      .update({ is_approved: true })
      .eq('id', id);
    return { error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('salary_records').delete().eq('id', id);
    return { error };
  },

  getMonthTotal: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('net_salary')
      .eq('month_year', monthYear)
      .eq('is_approved', true);
    const total = data?.reduce((sum, r) => sum + (r.net_salary ?? 0), 0) ?? 0;
    return { total, error };
  },

  getActiveAdvanceDeductionsByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, advances(employee_id)')
      .eq('month_year', monthYear)
      .eq('status', 'pending');
    return { data, error };
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, salary_type, status, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    return { data, error };
  },
};
