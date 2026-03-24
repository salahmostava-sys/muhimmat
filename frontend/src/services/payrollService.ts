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
};

export default payrollService;
// payrollService.ts

/**
 * Calculate order based salary
 * @param {number} orderAmount - The amount of the order
 * @param {number} rate - The rate of salary per order
 * @returns {number} - The calculated salary
 */
function calcOrderBasedSalary(orderAmount, rate) {
    return orderAmount * rate;
}

/**
 * Calculate fixed monthly salary
 * @param {number} baseSalary - The base salary per month
 * @returns {number} - The fixed monthly salary
 */
function calcFixedMonthlySalary(baseSalary) {
    return baseSalary;
}

/**
 * Compute salary row for an employee
 * @param {Object} employee - The employee object
 * @param {number} orderAmount - The amount of orders completed
 * @param {number} orderRate - The rate of salary per order
 * @returns {Object} - The computed salary row
 */
function computeSalaryRow(employee, orderAmount, orderRate) {
    const orderBasedSalary = calcOrderBasedSalary(orderAmount, orderRate);
    const fixedMonthlySalary = calcFixedMonthlySalary(employee.baseSalary);
    return {
        employeeId: employee.id,
        employeeName: employee.name,
        totalSalary: orderBasedSalary + fixedMonthlySalary,
    };
}

module.exports = { calcOrderBasedSalary, calcFixedMonthlySalary, computeSalaryRow };