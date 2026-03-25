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
        createQueryBuilder(hoisted.tableState[table] ?? { error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import driverService from './driverService';

describe('driverService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { error: null })
    );
  });

  it('update', async () => {
    hoisted.tableState.employees = { error: null };
    const res = await driverService.update('id1', { name: 'x' });
    expect(res.error).toBeNull();
  });

  it('delete', async () => {
    hoisted.tableState.employees = { error: null };
    const res = await driverService.delete('id1');
    expect(res.error).toBeNull();
  });
});
