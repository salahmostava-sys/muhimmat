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
import { vehicleService } from './vehicleService';

describe('vehicleService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('CRUD and queries', async () => {
    hoisted.tableState.vehicles = { data: [], error: null };
    await vehicleService.getAll();
    hoisted.tableState.vehicles = { data: [{ id: 'v1' }], error: null };
    hoisted.tableState.vehicle_assignments = {
      data: [{ vehicle_id: 'v1', employees: { name: 'A' } }],
      error: null,
    };
    const withRider = await vehicleService.getAllWithCurrentRider();
    expect(withRider.data?.[0]).toMatchObject({ id: 'v1', current_rider: 'A' });

    hoisted.tableState.vehicles = { data: { id: 'v1' }, error: null };
    await vehicleService.getById('v1');
    hoisted.tableState.vehicles = { data: {}, error: null };
    await vehicleService.create({ plate_number: 'X' });
    hoisted.tableState.vehicles = { data: {}, error: null };
    await vehicleService.update('v1', { brand: 'B' });
    hoisted.tableState.vehicles = { data: {}, error: null };
    await vehicleService.upsert({ plate_number: 'X' });
    hoisted.tableState.vehicles = { error: null };
    await vehicleService.delete('v1');
    hoisted.tableState.vehicles = { count: 2, error: null };
    await vehicleService.getActiveCount();
    hoisted.tableState.maintenance_logs = { data: [], error: null };
    await vehicleService.getMaintenanceLogs();
    hoisted.tableState.maintenance_logs = { data: {}, error: null };
    await vehicleService.createMaintenanceLog({
      vehicle_id: 'v1',
      date: '2026-03-01',
      type: 'oil',
    });
    hoisted.tableState.maintenance_logs = { data: {}, error: null };
    await vehicleService.updateMaintenanceLog('m1', { cost: 10 });
    hoisted.tableState.maintenance_logs = { error: null };
    await vehicleService.deleteMaintenanceLog('m1');
    hoisted.tableState.vehicle_assignments = { data: [], error: null };
    await vehicleService.getAssignments();
    await vehicleService.getAssignmentsWithRelations(50);
    await vehicleService.getActiveAssignments();
    hoisted.tableState.employees = { data: [], error: null };
    await vehicleService.getActiveEmployees();
    hoisted.tableState.vehicle_assignments = { data: {}, error: null };
    await vehicleService.createAssignment({
      vehicle_id: 'v1',
      employee_id: 'e1',
      start_date: '2026-03-01',
    });
    hoisted.tableState.vehicle_assignments = { data: {}, error: null };
    await vehicleService.updateAssignment('a1', { notes: 'n' });
    hoisted.tableState.vehicle_assignments = { error: null };
    await vehicleService.closeActiveAssignment('v1', '2026-03-31');
    hoisted.tableState.vehicles = { data: [], error: null };
    await vehicleService.getForSelect();
  });
});
