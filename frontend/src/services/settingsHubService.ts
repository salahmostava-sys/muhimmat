import { supabase } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/validation';
import { authService } from '@/services/authService';
import { throwIfError } from '@/services/serviceError';

const EXPORT_TABLE_ALLOWLIST = new Set([
  'audit_log',
  'admin_action_log',
  'profiles',
  'employees',
  'vehicles',
  'apps',
  'daily_orders',
  'attendance',
  'advances',
  'salary_records',
  'trade_registers',
  'system_settings',
]);

export const settingsHubService = {
  getAuditLogs: async (from: number, to: number, filterAction: string, filterTable: string, search: string) => {
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filterAction !== 'all') query = query.eq('action', filterAction);
    if (filterTable !== 'all') query = query.eq('table_name', filterTable);
    if (search.trim()) {
      query = query.or(`table_name.ilike.%${search}%,action.ilike.%${search}%,record_id.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    throwIfError(error, 'settingsHubService.getAuditLogs');
    return { data, error: null, count };
  },
  getAuditProfilesByIds: async (userIds: string[]) => {
    const { data, error } = await supabase.from('profiles').select('id, name, email').in('id', userIds);
    throwIfError(error, 'settingsHubService.getAuditProfilesByIds');
    return { data, error: null };
  },
  getAuditLogsForExport: async () => {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
    throwIfError(error, 'settingsHubService.getAuditLogsForExport');
    return { data, error: null };
  },

  getProfileByUserId: async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle();
    throwIfError(error, 'settingsHubService.getProfileByUserId');
    return { data, error: null };
  },
  uploadAvatar: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) throw new Error(validation.error);
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    throwIfError(error, 'settingsHubService.uploadAvatar');
    return { data, error: null };
  },
  getAvatarPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateProfileByUserId: async (userId: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('profiles').update(payload).eq('id', userId);
    throwIfError(error, 'settingsHubService.updateProfileByUserId');
    return { data, error: null };
  },
  updatePassword: async (password: string) => authService.updatePassword(password),

  getTradeRegister: async () => {
    const { data, error } = await supabase.from('trade_registers').select('*').order('created_at').limit(1).maybeSingle();
    throwIfError(error, 'settingsHubService.getTradeRegister');
    return { data, error: null };
  },
  uploadCompanyLogo: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) throw new Error(validation.error);
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    throwIfError(error, 'settingsHubService.uploadCompanyLogo');
    return { data, error: null };
  },
  getCompanyLogoPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateSystemLogo: async (settingsId: string, logoUrl: string | null) => {
    const { data, error } = await supabase.from('system_settings').update({ logo_url: logoUrl }).eq('id', settingsId);
    throwIfError(error, 'settingsHubService.updateSystemLogo');
    return { data, error: null };
  },
  updateTradeRegister: async (recordId: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('trade_registers').update(payload).eq('id', recordId);
    throwIfError(error, 'settingsHubService.updateTradeRegister');
    return { data, error: null };
  },
  createTradeRegister: async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('trade_registers').insert(payload).select().single();
    throwIfError(error, 'settingsHubService.createTradeRegister');
    return { data, error: null };
  },

  exportTableRows: async (table: string) => {
    if (!EXPORT_TABLE_ALLOWLIST.has(table)) {
      throw new Error('Table is not allowed for export');
    }
    const { data, error } = await supabase.from(table).select('*');
    throwIfError(error, 'settingsHubService.exportTableRows');
    return { data, error: null };
  },
};
