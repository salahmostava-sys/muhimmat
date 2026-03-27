import { supabase } from '@services/supabase/client';
import { isEmployeeIdUuid, isValidSalaryMonthYear } from '@shared/lib/salaryValidation';
import { handleSupabaseError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';

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

const sortSalarySchemeTiers = (tiers: SalarySchemeTier[]): SalarySchemeTier[] => {
  return [...tiers].sort((a, b) => a.tier_order - b.tier_order);
};

const findMatchedSalaryTier = (tiers: SalarySchemeTier[], orders: number): SalarySchemeTier => {
  let matchedTier = tiers[0];
  for (const tier of tiers) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders >= from && orders <= to) {
      matchedTier = tier;
      break;
    }
    if (orders > to) matchedTier = tier;
  }
  return matchedTier;
};

const calculateTotalMultiplierSalary = (orders: number, tiers: SalarySchemeTier[]): number => {
  let total = 0;
  for (const tier of tiers) {
    const from = tier.from_orders;
    const to = tier.to_orders ?? Infinity;
    if (orders < from) break;
    const inTier = Math.min(orders, to) - from + 1;
    if (inTier <= 0) continue;
    total += inTier * tier.price_per_order;
  }
  return total;
};

const addTargetBonusIfEligible = (
  total: number,
  orders: number,
  targetOrders: number | null,
  targetBonus: number | null
): number => {
  if (targetOrders && targetBonus && orders >= targetOrders) {
    return total + targetBonus;
  }
  return total;
};

export const salaryService = {
  calculateTierSalary: (
    orders: number,
    tiers: SalarySchemeTier[] | undefined,
    targetOrders: number | null,
    targetBonus: number | null
  ): number => {
    if (!tiers || tiers.length === 0 || orders === 0) return 0;
    const sorted = sortSalarySchemeTiers(tiers);
    const matchedTier = findMatchedSalaryTier(sorted, orders);

    const tierType = matchedTier.tier_type || 'total_multiplier';
    let total: number;
    if (tierType === 'fixed_amount') {
      total = matchedTier.price_per_order;
    } else if (tierType === 'base_plus_incremental') {
      const threshold = matchedTier.incremental_threshold ?? matchedTier.from_orders;
      const incrPrice = matchedTier.incremental_price ?? 0;
      const extra = Math.max(0, orders - threshold);
      total = matchedTier.price_per_order + extra * incrPrice;
    } else {
      total = calculateTotalMultiplierSalary(orders, sorted);
    }

    return Math.round(addTargetBonusIfEligible(total, orders, targetOrders, targetBonus));
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
    if (error) handleSupabaseError(error, 'salaryService.getPricingRules');
    return (data || []) as PricingRule[];
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

    if (error) handleSupabaseError(error, 'salaryService.getOrderCount');
    return (data || []).reduce((sum, row) => sum + (row.orders_count ?? 0), 0);
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
    const [rules, total] = await Promise.all([
      salaryService.getPricingRules(appId),
      salaryService.getOrderCount(employeeId, appId, monthYear),
    ]);
    return salaryService.applyPricingRules(rules, total);
  },

  calculateSalaryForEmployeeMonth: async (
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) => {
    if (!isEmployeeIdUuid(employeeId) || !isValidSalaryMonthYear(monthYear)) {
      handleSupabaseError(new Error('Invalid employee_id or month_year'), 'salaryService.calculateSalaryForEmployeeMonth');
    }
    const { data, error } = await supabase.rpc('calculate_salary', {
      p_employee_id: employeeId,
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
      p_manual_deduction: manualDeduction,
      p_manual_deduction_note: manualDeductionNote,
    });
    if (error) handleSupabaseError(error, 'salaryService.calculateSalaryForEmployeeMonth.rpc');
    return data;
  },

  calculateSalaryForMonth: async ({ monthYear, paymentMethod = 'cash' }: SalaryRpcParams) => {
    if (!isValidSalaryMonthYear(monthYear)) {
      handleSupabaseError(new Error('Invalid month_year'), 'salaryService.calculateSalaryForMonth');
    }
    const { data, error } = await supabase.rpc('calculate_salary_for_month', {
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
    });
    if (error) handleSupabaseError(error, 'salaryService.calculateSalaryForMonth.rpc');
    return data;
  },

  getSalaryPreviewForMonth: async (monthYear: string) => {
    const my = String(monthYear ?? '').trim();
    if (!isValidSalaryMonthYear(my)) {
      return [] as SalaryPreviewRow[];
    }
    const { data, error } = await supabase.functions.invoke('salary-engine', {
      body: {
        mode: 'month_preview',
        month_year: my,
      },
    });
    if (error) handleSupabaseError(error, 'salaryService.getSalaryPreviewForMonth');
    const payload = ((data as { data?: unknown } | null)?.data ?? data) as SalaryPreviewRow[] | null;
    return payload || [];
  },

  getByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*, employees(name, national_id, salary_type)')
      .eq('month_year', monthYear)
      .order('created_at', { ascending: false });
    if (error) handleSupabaseError(error, 'salaryService.getByMonth');
    return data ?? [];
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
    if (error) handleSupabaseError(error, 'salaryService.getPagedByMonth');
    return createPagedResult({
      rows: data,
      total: count,
      page,
      pageSize,
    });
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
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
    return all;
  },

  getMonthRecordsForSalaryContext: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('employee_id, is_approved, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction')
      .eq('month_year', monthYear);
    if (error) handleSupabaseError(error, 'salaryService.getMonthRecordsForSalaryContext');
    return data ?? [];
  },

  getByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('employee_id', employeeId)
      .order('month_year', { ascending: false });
    if (error) handleSupabaseError(error, 'salaryService.getByEmployee');
    return data ?? [];
  },

  upsert: async (payload: SalaryRecordPayload) => {
    const { data, error } = await supabase
      .from('salary_records')
      .upsert(payload, { onConflict: 'employee_id,month_year' })
      .select()
      .single();
    if (error) handleSupabaseError(error, 'salaryService.upsert');
    return data;
  },

  upsertMany: async (records: Record<string, unknown>[]) => {
    const { error } = await supabase
      .from('salary_records')
      .upsert(records, { onConflict: 'employee_id,month_year' });
    if (error) handleSupabaseError(error, 'salaryService.upsertMany');
  },

  update: async (id: string, payload: Partial<SalaryRecordPayload>) => {
    const { data, error } = await supabase
      .from('salary_records')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'salaryService.update');
    return data;
  },

  approve: async (id: string) => {
    const { error } = await supabase
      .from('salary_records')
      .update({ is_approved: true })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'salaryService.approve');
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('salary_records').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'salaryService.delete');
  },

  getMonthTotal: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('salary_records')
      .select('net_salary')
      .eq('month_year', monthYear)
      .eq('is_approved', true);
    if (error) handleSupabaseError(error, 'salaryService.getMonthTotal');
    return data?.reduce((sum, r) => sum + (r.net_salary ?? 0), 0) ?? 0;
  },

  getActiveAdvanceDeductionsByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, advances(employee_id)')
      .eq('month_year', monthYear)
      .eq('status', 'pending');
    if (error) handleSupabaseError(error, 'salaryService.getActiveAdvanceDeductionsByMonth');
    return data ?? [];
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, salary_type, status, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    if (error) handleSupabaseError(error, 'salaryService.getEmployees');
    return data ?? [];
  },
};
