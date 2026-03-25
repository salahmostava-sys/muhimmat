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
import { alertsService } from './alertsService';

describe('alertsService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('fetchNotificationAlertsData resolves all queries', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    hoisted.tableState.vehicles = { data: [], error: null };
    const res = await alertsService.fetchNotificationAlertsData('2026-03-01');
    expect(res).toHaveLength(2);
  });

  it('fetchAlertsDataWithTimeout resolves before timeout', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    hoisted.tableState.vehicles = { data: [], error: null };
    hoisted.tableState.platform_accounts = { data: [], error: null };
    hoisted.tableState.alerts = { data: [], error: null };
    const res = await alertsService.fetchAlertsDataWithTimeout('2026-03-01', '2026-03-01', 5000);
    expect(res).toHaveLength(4);
  });

  it('resolveAlert and deferAlert', async () => {
    hoisted.tableState.alerts = { error: null };
    await alertsService.resolveAlert('a1', 'u1');
    await alertsService.deferAlert('a1', '2026-04-01');
  });
});
