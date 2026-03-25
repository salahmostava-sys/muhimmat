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
import { platformAccountService } from './platformAccountService';

describe('platformAccountService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { error: null })
    );
  });

  it('CRUD flows', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await platformAccountService.getApps();
    hoisted.tableState.employees = { data: [], error: null };
    await platformAccountService.getEmployees();
    hoisted.tableState.platform_accounts = { data: [], error: null };
    await platformAccountService.getAccounts();
    const payload = {
      app_id: 'a1',
      account_username: 'u',
      employee_id: null,
      account_id_on_platform: null,
      iqama_number: null,
      iqama_expiry_date: null,
      status: 'active' as const,
      notes: null,
    };
    hoisted.tableState.platform_accounts = { error: null };
    await platformAccountService.createAccount(payload);
    hoisted.tableState.platform_accounts = { error: null };
    await platformAccountService.updateAccount('id1', payload);
    hoisted.tableState.platform_accounts = { error: null };
    await platformAccountService.syncAccountEmployee('id1', 'e1');
  });
});
