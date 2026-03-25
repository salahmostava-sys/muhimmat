import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
  fnInvoke: { data: null as unknown, error: null as unknown },
  rpcResult: { data: null as unknown, error: null as unknown },
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({
    tables: hoisted.tableState,
    functionsInvoke: () =>
      Promise.resolve({
        data: hoisted.fnInvoke.data,
        error: hoisted.fnInvoke.error,
      }),
  });
  return {
    supabase: Object.assign(base, {
      from: vi.fn((table: string) =>
        createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
      ),
      functions: {
        invoke: vi.fn(async () => ({
          data: hoisted.fnInvoke.data,
          error: hoisted.fnInvoke.error,
        })),
      },
      rpc: vi.fn(async () => ({
        data: hoisted.rpcResult.data,
        error: hoisted.rpcResult.error,
      })),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { salaryService } from './salaryService';

const tier = {
  from_orders: 1,
  to_orders: 10 as number | null,
  price_per_order: 5,
  tier_order: 1,
};

describe('salaryService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    hoisted.fnInvoke = { data: null, error: null };
    hoisted.rpcResult = { data: null, error: null };
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('calculateTierSalary covers tier types and target bonus', () => {
    expect(salaryService.calculateTierSalary(0, [tier], null, null)).toBe(0);
    expect(salaryService.calculateTierSalary(3, [tier], null, null)).toBeGreaterThan(0);
    expect(
      salaryService.calculateTierSalary(5, [{ ...tier, tier_type: 'fixed_amount' as const }], null, null)
    ).toBe(5);
    expect(
      salaryService.calculateTierSalary(
        12,
        [
          {
            ...tier,
            tier_type: 'base_plus_incremental' as const,
            incremental_threshold: 10,
            incremental_price: 2,
          },
        ],
        null,
        null
      )
    ).toBeGreaterThan(0);
    expect(salaryService.calculateTierSalary(10, [tier], 10, 100)).toBeGreaterThanOrEqual(100);
  });

  it('calculateFixedMonthlySalary', () => {
    expect(salaryService.calculateFixedMonthlySalary(0, 15)).toBe(0);
    expect(salaryService.calculateFixedMonthlySalary(3000, 15)).toBe(1500);
  });

  it('applyPricingRules', () => {
    const rules = [
      {
        id: '1',
        app_id: 'a',
        min_orders: 0,
        max_orders: 5,
        rule_type: 'per_order' as const,
        rate_per_order: 10,
        fixed_salary: null,
      },
    ];
    expect(salaryService.applyPricingRules(rules, 3)).toMatchObject({ salary: 30 });
    expect(salaryService.applyPricingRules([], 3).salary).toBe(0);
  });

  it('getPricingRules and getOrderCount', async () => {
    hoisted.tableState.pricing_rules = { data: [], error: null };
    await salaryService.getPricingRules('a1');
    hoisted.tableState.daily_orders = {
      data: [{ orders_count: 2 }, { orders_count: 3 }],
      error: null,
    };
    const oc = await salaryService.getOrderCount('e1', 'a1', '2026-03');
    expect(oc.total).toBe(5);
  });

  it('calculateSalaryByRules propagates errors', async () => {
    hoisted.tableState.pricing_rules = { data: null, error: { message: 'e' } };
    hoisted.tableState.daily_orders = { data: [], error: null };
    const r = await salaryService.calculateSalaryByRules('e', 'a', '2026-03');
    expect(r.error).toBeTruthy();
  });

  it('rpc salary calculation paths', async () => {
    hoisted.rpcResult = { data: null, error: { message: 'rpc' } };
    expect((await salaryService.calculateSalaryForEmployeeMonth('e', '2026-03')).error).toBeTruthy();
    hoisted.rpcResult = { data: { ok: true }, error: null };
    const emp = await salaryService.calculateSalaryForEmployeeMonth('e', '2026-03');
    expect(emp.data).toEqual({ ok: true });

    hoisted.rpcResult = { data: { ok: 'month' }, error: null };
    const month = await salaryService.calculateSalaryForMonth({ monthYear: '2026-03' });
    expect(month.data).toEqual({ ok: 'month' });

    hoisted.fnInvoke = { data: { data: [] as { employee_id: string }[] }, error: null };
    const prev = await salaryService.getSalaryPreviewForMonth('2026-03');
    expect(prev.data).toEqual([]);
  });

  it('salary_records and employees helpers', async () => {
    hoisted.tableState.salary_records = { data: [], error: null };
    await salaryService.getByMonth('2026-03');
    await salaryService.getMonthRecordsForSalaryContext('2026-03');
    await salaryService.getByEmployee('e1');
    hoisted.tableState.salary_records = { data: {}, error: null };
    await salaryService.upsert({
      employee_id: 'e1',
      month_year: '2026-03',
    });
    hoisted.tableState.salary_records = { error: null };
    await salaryService.upsertMany([]);
    hoisted.tableState.salary_records = { data: {}, error: null };
    await salaryService.update('id1', { notes: 'n' });
    hoisted.tableState.salary_records = { error: null };
    await salaryService.approve('id1');
    hoisted.tableState.salary_records = { error: null };
    await salaryService.delete('id1');
    hoisted.tableState.salary_records = {
      data: [{ net_salary: 100 }, { net_salary: 50 }],
      error: null,
    };
    await salaryService.getMonthTotal('2026-03');
    hoisted.tableState.advance_installments = { data: [], error: null };
    await salaryService.getActiveAdvanceDeductionsByMonth('2026-03');
    hoisted.tableState.employees = { data: [], error: null };
    await salaryService.getEmployees();
  });
});
