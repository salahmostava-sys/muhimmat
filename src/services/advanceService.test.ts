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
import { advanceService } from './advanceService';

describe('advanceService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  const ok = { error: null };

  it('getAll, getById, create, insertMany, update, updateStatus', async () => {
    hoisted.tableState.advances = { data: [], error: null };
    await advanceService.getAll();
    hoisted.tableState.advances = { data: { id: '1' }, error: null };
    await advanceService.getById('1');
    hoisted.tableState.advances = { data: { id: '1' }, error: null };
    await advanceService.create({
      employee_id: 'e',
      amount: 1,
      monthly_amount: 1,
      total_installments: 1,
      disbursement_date: '2026-03-01',
      first_deduction_month: '2026-03',
    });
    hoisted.tableState.advances = ok;
    await advanceService.insertMany([]);
    hoisted.tableState.advances = ok;
    await advanceService.update('1', { amount: 2 });
    hoisted.tableState.advances = ok;
    await advanceService.updateStatus('1', 'paused');
  });

  it('delete and deleteMany', async () => {
    hoisted.tableState.advance_installments = ok;
    hoisted.tableState.advances = ok;
    await advanceService.delete('1');
    hoisted.tableState.advance_installments = ok;
    hoisted.tableState.advances = ok;
    await advanceService.deleteMany(['1']);
  });

  it('writeOffMany and restoreWrittenOffMany', async () => {
    hoisted.tableState.advances = ok;
    await advanceService.writeOffMany(['1'], 'reason');
    hoisted.tableState.advances = ok;
    await advanceService.restoreWrittenOffMany(['1']);
  });

  it('installments CRUD and queries', async () => {
    hoisted.tableState.advance_installments = { data: [], error: null };
    await advanceService.getInstallments('a1');
    hoisted.tableState.advance_installments = ok;
    await advanceService.createInstallments([]);
    hoisted.tableState.advance_installments = ok;
    await advanceService.updateInstallment('i1', { status: 'pending' });
    hoisted.tableState.advance_installments = ok;
    await advanceService.updateInstallmentNote('i1', 'n');
    hoisted.tableState.advance_installments = ok;
    await advanceService.deleteInstallment('i1');
    hoisted.tableState.advance_installments = ok;
    await advanceService.deletePendingInstallments('a1');
    hoisted.tableState.advance_installments = ok;
    await advanceService.markInstallmentsDeducted(['i1'], new Date().toISOString());
    hoisted.tableState.advance_installments = { data: [], error: null };
    await advanceService.getInstallmentsByIds(['i1']);
    hoisted.tableState.advance_installments = { data: [], error: null };
    await advanceService.getAdvanceInstallmentStatuses('a1');
  });

  it('markAdvanceCompleted and month queries', async () => {
    hoisted.tableState.advances = ok;
    await advanceService.markAdvanceCompleted('a1');
    expect(await advanceService.getMonthInstallmentsForAdvances('2026-03', [])).toEqual({ data: [], error: null });
    hoisted.tableState.advance_installments = { data: [], error: null };
    await advanceService.getMonthInstallmentsForAdvances('2026-03', ['a1']);
    expect(await advanceService.getPendingInstallmentsForAdvances([])).toEqual({ data: [], error: null });
    hoisted.tableState.advance_installments = { data: [], error: null };
    await advanceService.getPendingInstallmentsForAdvances(['a1']);
  });

  it('getActiveByEmployee, getActiveAndPausedForSalaryContext, getEmployees', async () => {
    hoisted.tableState.advances = { data: [], error: null };
    await advanceService.getActiveByEmployee('e1');
    hoisted.tableState.advances = { data: [], error: null };
    await advanceService.getActiveAndPausedForSalaryContext();
    hoisted.tableState.employees = { data: [], error: null };
    await advanceService.getEmployees();
  });
});
