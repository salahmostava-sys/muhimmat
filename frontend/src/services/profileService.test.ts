import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({
    tables: hoisted.tableState,
    storageUpload: { data: { path: 'u/avatar.png' }, error: null },
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
import { profileService } from './profileService';

describe('profileService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('getProfile and getProfileName', async () => {
    hoisted.tableState.profiles = { data: { name: 'N', avatar_url: null }, error: null };
    await profileService.getProfile('u1');
    hoisted.tableState.profiles = { data: { name: 'N' }, error: null };
    await profileService.getProfileName('u1');
  });

  it('uploadAvatar', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const res = await profileService.uploadAvatar('u1', file);
    expect(res.data).toEqual({ path: 'u/avatar.png' });
  });

  it('getAvatarPublicUrl', () => {
    expect(profileService.getAvatarPublicUrl('path/to')).toContain('https://');
  });

  it('updateProfile', async () => {
    hoisted.tableState.profiles = { error: null };
    await profileService.updateProfile('u1', { name: 'X', avatar_url: 'a' });
  });

  it('updatePassword', async () => {
    vi.spyOn(supabase.auth, 'updateUser').mockResolvedValueOnce({ data: { user: null }, error: null } as never);
    await profileService.updatePassword('new-secret');
  });

  it('throws on profile error', async () => {
    hoisted.tableState.profiles = { data: null, error: { message: 'missing' } };
    await expect(profileService.getProfile('u1')).rejects.toThrow('missing');
  });
});
