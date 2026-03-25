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
        createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null, count: 0 })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { settingsHubService } from './settingsHubService';

describe('settingsHubService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: [], error: null, count: 0 })
    );
  });

  it('getAuditLogs with filters', async () => {
    hoisted.tableState.audit_log = { data: [], error: null, count: 0 };
    const q = settingsHubService.getAuditLogs(0, 9, 'all', 'all', '');
    await q;
    const q2 = settingsHubService.getAuditLogs(0, 9, 'INSERT', 'employees', 'x');
    await q2;
  });

  it('getAuditProfilesByIds and getAuditLogsForExport', async () => {
    hoisted.tableState.profiles = { data: [], error: null };
    await settingsHubService.getAuditProfilesByIds(['u1']);
    hoisted.tableState.audit_log = { data: [], error: null };
    await settingsHubService.getAuditLogsForExport();
  });

  it('getProfileByUserId', async () => {
    hoisted.tableState.profiles = { data: { name: 'N' }, error: null };
    await settingsHubService.getProfileByUserId('u1');
  });

  it('uploadAvatar validates and uploads', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await settingsHubService.uploadAvatar('u/a.png', file);
  });

  it('uploadAvatar rejects invalid type', async () => {
    const file = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    await expect(settingsHubService.uploadAvatar('u/a.exe', file)).rejects.toThrow();
  });

  it('getAvatarPublicUrl, updateProfileByUserId, updatePassword', async () => {
    expect(settingsHubService.getAvatarPublicUrl('p').data.publicUrl).toContain('https://');
    hoisted.tableState.profiles = { error: null };
    await settingsHubService.updateProfileByUserId('u1', { name: 'X' });
    await settingsHubService.updatePassword('secret');
  });

  it('trade register and company logo', async () => {
    hoisted.tableState.trade_registers = { data: null, error: null };
    await settingsHubService.getTradeRegister();
    const img = new File(['x'], 'l.png', { type: 'image/png' });
    await settingsHubService.uploadCompanyLogo('logo.png', img);
    expect(settingsHubService.getCompanyLogoPublicUrl('logo.png').data.publicUrl).toBeDefined();
    hoisted.tableState.system_settings = { error: null };
    await settingsHubService.updateSystemLogo('s1', 'url');
    hoisted.tableState.trade_registers = { error: null };
    await settingsHubService.updateTradeRegister('r1', { name: 'Co' });
    hoisted.tableState.trade_registers = { data: { id: 'r' }, error: null };
    await settingsHubService.createTradeRegister({ name: 'Co' });
  });

  it('exportTableRows', async () => {
    hoisted.tableState.apps = { data: [], error: null };
    await settingsHubService.exportTableRows('apps');
  });
});
