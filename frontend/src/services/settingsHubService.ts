import { supabase } from '@/integrations/supabase/client';
import { validateUploadFile } from '@/lib/validation';
import { authService } from '@/services/authService';

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

    return query;
  },
  getAuditProfilesByIds: async (userIds: string[]) =>
    supabase.from('profiles').select('id, name, email').in('id', userIds),
  getAuditLogsForExport: async () =>
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000),

  getProfileByUserId: async (userId: string) =>
    supabase.from('profiles').select('name, avatar_url').eq('id', userId).maybeSingle(),
  uploadAvatar: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) throw new Error(validation.error);
    return supabase.storage.from('avatars').upload(path, file, { upsert: true });
  },
  getAvatarPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateProfileByUserId: async (userId: string, payload: Record<string, unknown>) =>
    supabase.from('profiles').update(payload).eq('id', userId),
  updatePassword: async (password: string) => authService.updatePassword(password),

  getTradeRegister: async () => supabase.from('trade_registers').select('*').order('created_at').limit(1).maybeSingle(),
  uploadCompanyLogo: async (path: string, file: File) => {
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) throw new Error(validation.error);
    return supabase.storage.from('avatars').upload(path, file, { upsert: true });
  },
  getCompanyLogoPublicUrl: (path: string) => supabase.storage.from('avatars').getPublicUrl(path),
  updateSystemLogo: async (settingsId: string, logoUrl: string | null) =>
    supabase.from('system_settings').update({ logo_url: logoUrl }).eq('id', settingsId),
  updateTradeRegister: async (recordId: string, payload: Record<string, unknown>) =>
    supabase.from('trade_registers').update(payload).eq('id', recordId),
  createTradeRegister: async (payload: Record<string, unknown>) =>
    supabase.from('trade_registers').insert(payload).select().single(),

  exportTableRows: async (table: string) =>
    supabase.from(table).select('*'),
};
