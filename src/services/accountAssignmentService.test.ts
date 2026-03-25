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
        createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { accountAssignmentService } from './accountAssignmentService';

describe('accountAssignmentService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('getActiveAssignments', async () => {
    hoisted.tableState.account_assignments = { data: [], error: null };
    await accountAssignmentService.getActiveAssignments();
  });

  it('getAssignmentsForMonthYear', async () => {
    hoisted.tableState.account_assignments = { data: [], error: null };
    await accountAssignmentService.getAssignmentsForMonthYear('2026-03');
  });

  it('getHistoryByAccountId', async () => {
    hoisted.tableState.account_assignments = { data: [], error: null };
    await accountAssignmentService.getHistoryByAccountId('acc1');
  });

  it('getOpenAssignmentIdsByAccount', async () => {
    hoisted.tableState.account_assignments = { data: [], error: null };
    await accountAssignmentService.getOpenAssignmentIdsByAccount('acc1');
  });

  it('closeAssignmentsByIds', async () => {
    hoisted.tableState.account_assignments = { error: null };
    await accountAssignmentService.closeAssignmentsByIds(['i1'], '2026-03-31');
  });

  it('createAssignment', async () => {
    hoisted.tableState.account_assignments = { error: null };
    await accountAssignmentService.createAssignment({
      account_id: 'a',
      employee_id: 'e',
      start_date: '2026-03-01',
      end_date: null,
      month_year: '2026-03',
      notes: null,
      created_by: null,
    });
  });
});
