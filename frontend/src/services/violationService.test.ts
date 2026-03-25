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
import { violationService } from './violationService';

describe('violationService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('query and mutation chains', async () => {
    hoisted.tableState.external_deductions = { data: [], error: null };
    await violationService.getViolations();
    hoisted.tableState.vehicles = { data: [], error: null };
    await violationService.findVehiclesByPlateQuery('12');
    await violationService.findVehicleIdsByPlate('12');
    hoisted.tableState.vehicle_assignments = { data: [], error: null };
    await violationService.getAssignmentsByVehicleIds(['v1']);
    hoisted.tableState.external_deductions = { data: [], error: null };
    await violationService.getExistingFineDeductions(['e1'], '2026-03-01', '2026-03');
    hoisted.tableState.external_deductions = { data: { id: 'd1' }, error: null };
    await violationService.createFineDeduction({});
    hoisted.tableState.external_deductions = { error: null };
    await violationService.updateViolation('d1', { amount: 1 });
    hoisted.tableState.external_deductions = { error: null };
    await violationService.deleteViolation('d1');
    hoisted.tableState.advances = { data: [], error: null };
    await violationService.findMatchingAdvanceForFine('e1', '2026-03', 1, 100);
    hoisted.tableState.advances = { data: { id: 'a1' }, error: null };
    await violationService.createAdvanceFromFine({});
    hoisted.tableState.advance_installments = { error: null };
    await violationService.createSingleInstallment({});
  });
});
