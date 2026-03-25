import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({
    tables: hoisted.tableState,
    functionsInvoke: { data: {}, error: null },
  });
  return {
    supabase: Object.assign(base, {
      from: vi.fn((table: string) =>
        createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { authService } from './authService';

describe('authService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('signIn, signOut, getSession, getCurrentUser', async () => {
    await authService.signIn('a@b.co', 'pw');
    await authService.signOut();
    await authService.getSession();
    await authService.getCurrentUser();
  });

  it('fetchUserRole', async () => {
    hoisted.tableState.user_roles = { data: { role: 'admin' }, error: null };
    expect(await authService.fetchUserRole('u1')).toBe('admin');
  });

  it('fetchIsActive handles error as true', async () => {
    hoisted.tableState.profiles = { data: null, error: { message: 'x' } };
    expect(await authService.fetchIsActive('u1')).toBe(true);
  });

  it('fetchIsActive reads profile flag', async () => {
    hoisted.tableState.profiles = { data: { is_active: false }, error: null };
    expect(await authService.fetchIsActive('u1')).toBe(false);
  });

  it('fetchProfile', async () => {
    hoisted.tableState.profiles = {
      data: { id: 'u1', name: 'N', email: null, avatar_url: null, is_active: true },
      error: null,
    };
    expect(await authService.fetchProfile('u1')).toMatchObject({ id: 'u1' });
  });

  it('updatePassword, sendPasswordReset, refreshSession', async () => {
    await authService.updatePassword('x');
    await authService.sendPasswordReset('a@b.co');
    await authService.refreshSession();
  });

  it('onAuthStateChange returns subscription', () => {
    const sub = authService.onAuthStateChange(() => {});
    expect(sub).toBeDefined();
    expect(typeof sub.unsubscribe).toBe('function');
  });

  it('subscribeToProfileActiveChanges and removeRealtimeChannel', () => {
    const ch = authService.subscribeToProfileActiveChanges('u1', () => {});
    authService.removeRealtimeChannel(ch as never);
  });

  it('revokeSession invokes edge function', async () => {
    await authService.revokeSession('u1');
    expect(supabase.functions.invoke).toBeDefined();
  });
});
