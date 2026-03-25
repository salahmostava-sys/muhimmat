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
import { appService } from './appService';

describe('appService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null })
    );
  });

  it('getAll', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await appService.getAll();
  });

  it('create, update, toggleActive, delete', async () => {
    const payload = {
      name: 'A',
      name_en: null,
      brand_color: '#000',
      text_color: '#fff',
      is_active: true,
      custom_columns: [],
    };
    hoisted.tableState.apps = { error: null };
    await appService.create(payload);
    await appService.update('id1', payload);
    await appService.toggleActive('id1', false);
    await appService.delete('id1');
  });

  it('countActiveEmployeeApps', async () => {
    hoisted.tableState.employee_apps = { count: 3, error: null };
    await appService.countActiveEmployeeApps('a1');
  });

  it('getActiveEmployeeAppsWithEmployees', async () => {
    hoisted.tableState.employee_apps = { data: [], error: null };
    await appService.getActiveEmployeeAppsWithEmployees('a1');
  });

  it('getEmployeeMonthlyOrders', async () => {
    hoisted.tableState.daily_orders = { data: [], error: null };
    await appService.getEmployeeMonthlyOrders('e1', 'a1', '2026-03-01', '2026-03-31');
  });

  it('assignScheme, getActiveWithScheme, getActiveWithSalarySchemes', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await appService.assignScheme('a1', 's1');
    await appService.getActiveWithScheme();
    await appService.getActiveWithSalarySchemes();
  });
});
