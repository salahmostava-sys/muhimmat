import { supabase } from '@/integrations/supabase/client';

export type PayrollTier = {
  from_orders: number;
  to_orders: number | null;
  price_per_order: number;
  tier_order: number;
  tier_type?: 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental';
  incremental_threshold?: number | null;
  incremental_price?: number | null;
};

export type PayrollScheme = {
  id: string;
  scheme_type?: 'order_based' | 'fixed_monthly';
  monthly_amount?: number | null;
  target_orders: number | null;
  target_bonus: number | null;
  salary_scheme_tiers?: PayrollTier[];
};

export type PricingRule = {
  id: string;
  app_id: string;
  min_orders: number;
  max_orders: number | null;
  rule_type: 'per_order' | 'fixed' | 'hybrid';
  rate_per_order: number | null;
  fixed_salary: number | null;
  bonus_target_orders: number | null;
  bonus_amount: number | null;
  is_active: boolean;
  priority: number;
};

export const payrollService = {
  calculateTierSalary(
    orders: number,
    tiers: PayrollTier[] | undefined,
    targetOrders: number | null,
    targetBonus: number | null
  ): number {
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

  calculateFixedMonthlySalary(monthlyAmount: number, attendanceDays: number): number {
    if (!monthlyAmount || monthlyAmount <= 0) return 0;
    return Math.round((monthlyAmount / 30) * attendanceDays);
  },

  calculatePlatformSalary(orders: number, attendanceDays: number, scheme: PayrollScheme | null): number {
    if (!scheme) return 0;
    if (scheme.scheme_type === 'fixed_monthly') {
      return this.calculateFixedMonthlySalary(scheme.monthly_amount || 0, attendanceDays);
    }
    if (orders === 0) return 0;
    return this.calculateTierSalary(
      orders,
      scheme.salary_scheme_tiers,
      scheme.target_orders,
      scheme.target_bonus
    );
  },

  async getPricingRulesForApp(appId: string) {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select(
        'id, app_id, min_orders, max_orders, rule_type, rate_per_order, fixed_salary, bonus_target_orders, bonus_amount, is_active, priority'
      )
      .eq('app_id', appId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('min_orders', { ascending: true });

    return { data: (data || []) as PricingRule[], error };
  },

  async getPricingRulesForApps(appIds: string[]) {
    if (!appIds.length) return { data: [] as PricingRule[], error: null };
    const { data, error } = await supabase
      .from('pricing_rules')
      .select(
        'id, app_id, min_orders, max_orders, rule_type, rate_per_order, fixed_salary, bonus_target_orders, bonus_amount, is_active, priority'
      )
      .in('app_id', appIds)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .order('min_orders', { ascending: true });
    return { data: (data || []) as PricingRule[], error };
  },

  calculateFromPricingRules(orders: number, rules: PricingRule[]): number | null {
    if (!rules || rules.length === 0) return null;
    const matched = rules.find((rule) => {
      const inMin = orders >= rule.min_orders;
      const inMax = rule.max_orders === null || orders <= rule.max_orders;
      return inMin && inMax;
    });
    if (!matched) return null;

    let salary = 0;
    if (matched.rule_type === 'fixed') {
      salary = Number(matched.fixed_salary || 0);
    } else if (matched.rule_type === 'hybrid') {
      salary = Number(matched.fixed_salary || 0) + orders * Number(matched.rate_per_order || 0);
    } else {
      salary = orders * Number(matched.rate_per_order || 0);
    }

    if (
      matched.bonus_target_orders !== null &&
      matched.bonus_amount !== null &&
      orders >= matched.bonus_target_orders
    ) {
      salary += Number(matched.bonus_amount);
    }
    return Math.round(salary);
  },
};

export default payrollService;