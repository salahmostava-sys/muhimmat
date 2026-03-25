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
        createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { employeeTierService } from './employeeTierService';

describe('employeeTierService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('getTiers', async () => {
    hoisted.tableState.employee_tiers = { data: [], error: null };
    await employeeTierService.getTiers();
  });

  it('getEmployees', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    await employeeTierService.getEmployees();
  });

  it('getActiveApps', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await employeeTierService.getActiveApps();
  });

  it('updateTier, createTier, deleteTier', async () => {
    hoisted.tableState.employee_tiers = { data: null, error: null };
    await employeeTierService.updateTier('t1', { name: 'x' });
    await employeeTierService.createTier({ name: 'y' });
    await employeeTierService.deleteTier('t1');
  });

  it('getActiveAssignmentWithVehicleByEmployee', async () => {
    hoisted.tableState.vehicle_assignments = { data: [], error: null };
    await employeeTierService.getActiveAssignmentWithVehicleByEmployee('e1');
  });
});
