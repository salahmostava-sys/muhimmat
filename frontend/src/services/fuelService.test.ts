import { describe, it, beforeEach, vi } from 'vitest';
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
import { fuelService } from './fuelService';

describe('fuelService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('queries and mutations', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    await fuelService.getActiveEmployees();
    hoisted.tableState.apps = { data: [], error: null };
    await fuelService.getActiveApps();
    hoisted.tableState.employee_apps = { data: [], error: null };
    await fuelService.getActiveEmployeeAppLinks();
    hoisted.tableState.vehicle_mileage_daily = { data: [], error: null };
    await fuelService.getMonthlyDailyMileage('2026-03-01', '2026-03-31');
    hoisted.tableState.daily_orders = { data: [], error: null };
    await fuelService.getMonthlyOrders('2026-03-01', '2026-03-31');
    hoisted.tableState.vehicle_mileage = { data: [], error: null };
    await fuelService.getMonthlyFuelByMonthYear('2026-03');
    hoisted.tableState.vehicle_assignments = { data: [], error: null };
    await fuelService.getActiveVehicleAssignments();
    hoisted.tableState.vehicle_mileage_daily = { data: [], error: null };
    await fuelService.getDailyMileageByMonth('2026-03-01', '2026-03-31');
    hoisted.tableState.vehicle_mileage_daily = { error: null };
    await fuelService.upsertDailyMileage(
      { employee_id: 'e1', date: '2026-03-01', km_total: 1, fuel_cost: 0, notes: null },
      undefined
    );
    await fuelService.upsertDailyMileage(
      { employee_id: 'e1', date: '2026-03-01', km_total: 1, fuel_cost: 0, notes: null },
      'edit-id'
    );
    hoisted.tableState.vehicle_mileage_daily = { error: null };
    await fuelService.deleteDailyMileage('id1');
    hoisted.tableState.vehicle_mileage = { error: null };
    await fuelService.saveMonthlyMileageImport([], true);
    await fuelService.saveMonthlyMileageImport([], false);
  });
});
