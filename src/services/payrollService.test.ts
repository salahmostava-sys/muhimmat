import { describe, expect, it } from 'vitest';
import { payrollService, type PayrollTier } from './payrollService';

describe('payrollService', () => {
  const tiers: PayrollTier[] = [
    { from_orders: 0, to_orders: 10, price_per_order: 2, tier_order: 1 },
    { from_orders: 11, to_orders: null, price_per_order: 3, tier_order: 2 },
  ];

  it('calculateTierSalary returns 0 for empty tiers or zero orders', () => {
    expect(payrollService.calculateTierSalary(5, [], null, null)).toBe(0);
    expect(payrollService.calculateTierSalary(0, tiers, null, null)).toBe(0);
  });

  it('calculateTierSalary applies target bonus', () => {
    expect(payrollService.calculateTierSalary(100, tiers, 50, 500)).toBeGreaterThan(500);
  });

  it('calculateTierSalary fixed_amount tier type', () => {
    const fixed: PayrollTier[] = [
      { from_orders: 0, to_orders: 999, price_per_order: 400, tier_order: 1, tier_type: 'fixed_amount' },
    ];
    expect(payrollService.calculateTierSalary(50, fixed, null, null)).toBe(400);
  });

  it('calculateTierSalary base_plus_incremental', () => {
    const t: PayrollTier[] = [
      {
        from_orders: 0,
        to_orders: 999,
        price_per_order: 100,
        tier_order: 1,
        tier_type: 'base_plus_incremental',
        incremental_threshold: 10,
        incremental_price: 5,
      },
    ];
    expect(payrollService.calculateTierSalary(12, t, null, null)).toBe(110);
  });

  it('calculateFixedMonthlySalary', () => {
    expect(payrollService.calculateFixedMonthlySalary(0, 10)).toBe(0);
    expect(payrollService.calculateFixedMonthlySalary(3000, 15)).toBe(1500);
  });

  it('calculatePlatformSalary', () => {
    expect(payrollService.calculatePlatformSalary(10, 20, null)).toBe(0);
    expect(
      payrollService.calculatePlatformSalary(10, 20, {
        id: 's1',
        scheme_type: 'fixed_monthly',
        monthly_amount: 3000,
        target_orders: null,
        target_bonus: null,
      })
    ).toBe(2000);
  });
});
