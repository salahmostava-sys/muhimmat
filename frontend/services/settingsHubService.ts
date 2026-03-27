import { supabase } from '@services/supabase/client';
import { validateUploadFile } from '@shared/lib/validation';
import { authService } from '@services/authService';
import { toServiceError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';

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
    if (error) throw toServiceError(error, 'settingsHubService.getAuditLogs');
    return createPagedResult({
      rows: data,
      total: count,
      page: Math.floor(from / Math.max(1, to - from + 1)) + 1,
      pageSize: Math.max(1, to - from + 1),
    });
  },
  getAuditProfilesByIds: async (userIds: string[]) => {
    const { data, error } = await supabase.from('profiles').select('id, name, email').in('id', userIds);
    if (error) throw toServiceError(error, 'settingsHubService.getAuditProfilesByIds');
    return data ?? [];
  },
  getAuditLogsForExport: async () => {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) throw toServiceError(error, 'settingsHubService.getAuditLogsForExport');
    return data ?? [];
  },

  getProfileByUserId: async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle();
    if (error) throw toServiceError(error, 'settingsHubService.getProfileByUserId');
    return data;
  },
  uploadAvatar: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) {
      throw toServiceError(
        new Error('error' in validation ? validation.error : 'Invalid file'),
        'settingsHubService.uploadAvatar.validation'
      );
    }
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw toServiceError(error, 'settingsHubService.uploadAvatar');
    if (!data) throw toServiceError(new Error('Upload returned no data'), 'settingsHubService.uploadAvatar');
    return data;
  },
  getAvatarPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateProfileByUserId: async (userId: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (error) throw toServiceError(error, 'settingsHubService.updateProfileByUserId');
  },
  updatePassword: async (password: string) => authService.updatePassword(password),

  getTradeRegister: async () => {
    const { data, error } = await supabase.from('trade_registers').select('*').order('created_at').limit(1).maybeSingle();
    if (error) throw toServiceError(error, 'settingsHubService.getTradeRegister');
    return data;
  },
  uploadCompanyLogo: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) {
      throw toServiceError(
        new Error('error' in validation ? validation.error : 'Invalid file'),
        'settingsHubService.uploadCompanyLogo.validation'
      );
    }
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) throw toServiceError(error, 'settingsHubService.uploadCompanyLogo');
    if (!data) throw toServiceError(new Error('Upload returned no data'), 'settingsHubService.uploadCompanyLogo');
    return data;
  },
  getCompanyLogoPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateSystemLogo: async (settingsId: string, logoUrl: string | null) => {
    const { error } = await supabase.from('system_settings').update({ logo_url: logoUrl }).eq('id', settingsId);
    if (error) throw toServiceError(error, 'settingsHubService.updateSystemLogo');
  },
  updateTradeRegister: async (recordId: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.from('trade_registers').update(payload).eq('id', recordId);
    if (error) throw toServiceError(error, 'settingsHubService.updateTradeRegister');
  },
  createTradeRegister: async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('trade_registers').insert(payload).select().single();
    if (error) throw toServiceError(error, 'settingsHubService.createTradeRegister');
    return data;
  },

  exportTableRows: async (table: string) => {
    if (!EXPORT_TABLE_ALLOWLIST.has(table)) {
      throw toServiceError(new Error('Table is not allowed for export'), 'settingsHubService.exportTableRows');
    }
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw toServiceError(error, 'settingsHubService.exportTableRows');
    return data ?? [];
  },
};
