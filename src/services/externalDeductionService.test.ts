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
import { externalDeductionService } from './externalDeductionService';

describe('externalDeductionService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('getApprovedByMonth', async () => {
    hoisted.tableState.external_deductions = { data: [{ employee_id: 'e1', amount: 10 }], error: null };
    const res = await externalDeductionService.getApprovedByMonth('2026-03');
    expect(res.data).toHaveLength(1);
  });
});
