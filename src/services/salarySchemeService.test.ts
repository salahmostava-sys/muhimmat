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
import { salarySchemeService } from './salarySchemeService';

describe('salarySchemeService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { error: null })
    );
  });

  it('scheme and tier operations', async () => {
    hoisted.tableState.salary_schemes = { data: [], error: null };
    await salarySchemeService.getSchemes();
    hoisted.tableState.salary_scheme_tiers = { data: [], error: null };
    await salarySchemeService.getTiers();
    hoisted.tableState.scheme_month_snapshots = { data: [], error: null };
    await salarySchemeService.getSnapshots();
    hoisted.tableState.salary_schemes = { error: null };
    await salarySchemeService.updateScheme('s1', {
      name: 'N',
      scheme_type: 'order_based',
      monthly_amount: null,
      target_orders: null,
      target_bonus: null,
    });
    hoisted.tableState.salary_schemes = { data: { id: 's1' }, error: null };
    await salarySchemeService.createScheme({
      name: 'N',
      scheme_type: 'fixed_monthly',
      monthly_amount: 1000,
      target_orders: null,
      target_bonus: null,
    });
    hoisted.tableState.salary_scheme_tiers = { error: null };
    await salarySchemeService.deleteSchemeTiers('s1');
    hoisted.tableState.salary_scheme_tiers = { error: null };
    await salarySchemeService.insertSchemeTiers([]);
    hoisted.tableState.salary_schemes = { error: null };
    await salarySchemeService.updateSchemeStatus('s1', 'archived');
    hoisted.tableState.scheme_month_snapshots = { error: null };
    await salarySchemeService.upsertSnapshot('s1', '2026-03', {});
    hoisted.tableState.scheme_month_snapshots = { error: null };
    await salarySchemeService.deleteSnapshot('s1', '2026-03');
  });
});
