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
import { userPermissionService } from './userPermissionService';

describe('userPermissionService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('reads and writes permissions', async () => {
    hoisted.tableState.profiles = { data: [], error: null };
    await userPermissionService.getProfiles();
    hoisted.tableState.user_roles = { data: [], error: null };
    await userPermissionService.getUserRoles();
    hoisted.tableState.user_permissions = { data: [], error: null };
    await userPermissionService.getUserPermissions('u1');
    hoisted.tableState.user_permissions = { error: null };
    await userPermissionService.upsertPermission('u1', 'orders', {
      can_view: true,
      can_edit: false,
      can_delete: false,
    });
    hoisted.tableState.user_permissions = { error: null };
    await userPermissionService.deletePermission('u1', 'orders');
  });

  it('upsertRole updates when row exists', async () => {
    hoisted.tableState.user_roles = { data: { id: 'r1' }, error: null };
    await userPermissionService.upsertRole('u1', 'admin');
  });

  it('upsertRole inserts when no row', async () => {
    hoisted.tableState.user_roles = { data: null, error: null };
    hoisted.tableState.user_roles = { error: null };
    await userPermissionService.upsertRole('u1', 'viewer');
  });

  it('upsertRole returns error from select', async () => {
    hoisted.tableState.user_roles = { data: null, error: { message: 'e' } };
    const res = await userPermissionService.upsertRole('u1', 'admin');
    expect(res).toEqual({ error: { message: 'e' } });
  });
});
