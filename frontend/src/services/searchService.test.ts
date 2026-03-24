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
import { searchService } from './searchService';

describe('searchService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('searchEmployeesAndVehicles merges results', async () => {
    hoisted.tableState.employees = {
      data: [{ id: 'e1', name: 'Ali', name_en: null, phone: null, status: 'active' }],
      error: null,
    };
    hoisted.tableState.vehicles = {
      data: [{ id: 'v1', plate_number: 'ABC', brand: null, model: null, status: 'active' }],
      error: null,
    };
    const res = await searchService.searchEmployeesAndVehicles('ali');
    expect(res.employees).toHaveLength(1);
    expect(res.vehicles).toHaveLength(1);
  });
});
