import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({ tables: hoisted.tableState });
  return {
    supabase: Object.assign(base, {
      from: vi.fn((table: string) =>
        createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { orderService } from './orderService';

describe('orderService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('getAll returns data', async () => {
    hoisted.tableState.daily_orders = { data: [{ id: '1' }], error: null };
    const res = await orderService.getAll();
    expect(res.data).toEqual([{ id: '1' }]);
  });

  it('getAll throws on error', async () => {
    hoisted.tableState.daily_orders = { data: null, error: { message: 'db' } };
    await expect(orderService.getAll()).rejects.toThrow('db');
  });

  it('getOrdersByEmployeeMonth', async () => {
    hoisted.tableState.daily_orders = { data: [], error: null };
    await orderService.getOrdersByEmployeeMonth('e1', '2026-03');
    expect(supabase.from).toHaveBeenCalledWith('daily_orders');
  });

  it('getByDate applies optional filters', async () => {
    hoisted.tableState.daily_orders = { data: [], error: null };
    await orderService.getByDate('2026-03-01', { employeeId: 'e1', appId: 'a1' });
  });

  it('upsert and delete', async () => {
    hoisted.tableState.daily_orders = { data: { id: 'x' }, error: null };
    await orderService.upsert('e', '2026-03-01', 'a', 3);
    hoisted.tableState.daily_orders = { error: null };
    await orderService.delete('id-1');
  });

  it('getTotalByEmployee sums orders_count', async () => {
    hoisted.tableState.daily_orders = {
      data: [{ orders_count: 2 }, { orders_count: 3 }],
      error: null,
    };
    const { total } = await orderService.getTotalByEmployee('e1', '2026-03');
    expect(total).toBe(5);
  });

  it('getAppTargets and upsertAppTarget', async () => {
    hoisted.tableState.app_targets = { data: [], error: null };
    await orderService.getAppTargets('2026-03');
    hoisted.tableState.app_targets = { data: { id: 't' }, error: null };
    await orderService.upsertAppTarget('a1', '2026-03', 50);
  });

  it('getMonthRaw', async () => {
    hoisted.tableState.daily_orders = { data: [], error: null };
    await orderService.getMonthRaw(2026, 3);
  });

  it('bulkUpsert aggregates saved and failed', async () => {
    let n = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table !== 'daily_orders') return createQueryBuilder({ data: null, error: null });
      n += 1;
      return createQueryBuilder(n === 1 ? { error: null } : { error: { message: 'x' } });
    });
    const rows = Array.from({ length: 250 }, (_, i) => ({
      employee_id: 'e',
      app_id: 'a',
      date: `2026-03-${String((i % 28) + 1).padStart(2, '0')}`,
      orders_count: 1,
    }));
    const { saved, failed } = await orderService.bulkUpsert(rows, 200);
    expect(saved).toBe(200);
    expect(failed.length).toBe(50);
  });

  it('getActiveEmployees, getActiveApps, getEmployeeAppAssignments', async () => {
    hoisted.tableState.employees = { data: [{ id: 'e1' }], error: null };
    hoisted.tableState.apps = { data: [{ id: 'a1' }], error: null };
    hoisted.tableState.employee_apps = { data: [], error: null };
    await orderService.getActiveEmployees();
    await orderService.getActiveApps();
    await orderService.getEmployeeAppAssignments();
  });

  it('getMonthLockStatus', async () => {
    hoisted.tableState.locked_months = { data: { month_year: '2026-03' }, error: null };
    const { locked } = await orderService.getMonthLockStatus('2026-03');
    expect(locked).toBe(true);
  });

  it('lockMonth uses auth user id', async () => {
    hoisted.tableState.locked_months = { error: null };
    const spy = vi.spyOn(supabase.auth, 'getUser');
    await orderService.lockMonth('2026-02');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
