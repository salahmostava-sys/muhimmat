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
import { dashboardService } from './dashboardService';

describe('dashboardService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('getActiveApps, getActiveEmployeeCount, getMonthSalaryTotal, getActiveAdvancesTotal', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await dashboardService.getActiveApps();
    hoisted.tableState.employees = { count: 2, error: null };
    await dashboardService.getActiveEmployeeCount();
    hoisted.tableState.salary_records = { data: [{ net_salary: 50 }], error: null };
    await dashboardService.getMonthSalaryTotal('2026-03');
    hoisted.tableState.advances = { data: [{ amount: 10 }], error: null };
    await dashboardService.getActiveAdvancesTotal();
  });

  it('getAttendanceToday', async () => {
    hoisted.tableState.attendance = {
      data: [{ status: 'present' }, { status: 'absent' }, { status: 'leave' }],
      error: null,
    };
    const r = await dashboardService.getAttendanceToday('2026-03-01');
    expect(r.present).toBe(1);
    expect(r.absent).toBe(1);
    expect(r.leave).toBe(1);
  });

  it('getMonthOrders, getMonthOrdersCount, getAttendanceTrend', async () => {
    hoisted.tableState.daily_orders = { data: [], error: null };
    await dashboardService.getMonthOrders('2026-03');
    hoisted.tableState.daily_orders = { data: [{ orders_count: 3 }], error: null };
    const c = await dashboardService.getMonthOrdersCount('2026-03');
    expect(c.total).toBe(3);
    hoisted.tableState.attendance = {
      data: [
        { date: '2026-03-01', status: 'present' },
        { date: '2026-03-01', status: 'present' },
      ],
      error: null,
    };
    const t = await dashboardService.getAttendanceTrend('2026-03-01', '2026-03-02');
    expect(t.data.length).toBeGreaterThan(0);
  });

  it('getRecentActivity, getEmployeeAppAssignments, getSystemSettings, getEmployeeDistribution', async () => {
    hoisted.tableState.audit_log = { data: [], error: null };
    await dashboardService.getRecentActivity();
    hoisted.tableState.employee_apps = { data: [], error: null };
    await dashboardService.getEmployeeAppAssignments();
    hoisted.tableState.system_settings = { data: {}, error: null };
    await dashboardService.getSystemSettings();
    hoisted.tableState.employees = { data: [], error: null };
    await dashboardService.getEmployeeDistribution();
  });

  it('getActiveVehiclesCount, getUnresolvedAlertsCount, getAppTargets', async () => {
    hoisted.tableState.vehicles = { count: 1, error: null };
    await dashboardService.getActiveVehiclesCount();
    hoisted.tableState.alerts = { count: 2, error: null };
    await dashboardService.getUnresolvedAlertsCount();
    hoisted.tableState.app_targets = { data: [], error: null };
    await dashboardService.getAppTargets('2026-03');
  });

  it('fetchMainData, fetchHistoricalData, getKPIs', async () => {
    hoisted.tableState.employees = { count: 1, data: [], error: null };
    hoisted.tableState.attendance = { data: [], error: null };
    hoisted.tableState.daily_orders = { data: [], error: null };
    hoisted.tableState.audit_log = { data: [], error: null };
    hoisted.tableState.vehicles = { count: 0, error: null };
    hoisted.tableState.alerts = { count: 0, error: null };
    hoisted.tableState.apps = { data: [], error: null };
    hoisted.tableState.app_targets = { data: [], error: null };
    hoisted.tableState.advances = { data: [], error: null };
    hoisted.tableState.salary_records = { data: [], error: null };

    await dashboardService.fetchMainData('2026-03-25', '2026-03', '2026-02-01', '2026-02-28', '2026-03-20');

    hoisted.tableState.daily_orders = { data: [], error: null };
    await dashboardService.fetchHistoricalData([{ start: '2026-02-01', end: '2026-02-28' }]);

    hoisted.tableState.employees = { count: 2, error: null };
    hoisted.tableState.attendance = { data: [{ status: 'present' }], error: null };
    hoisted.tableState.advances = { data: [{ amount: 5 }], error: null };
    hoisted.tableState.salary_records = { data: [{ net_salary: 100 }], error: null };
    const { kpis } = await dashboardService.getKPIs('2026-03', '2026-03-01');
    expect(kpis.activeEmployees).toBe(2);
    expect(kpis.presentToday).toBe(1);
  });
});
