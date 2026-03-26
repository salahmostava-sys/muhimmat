import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';
import { authService } from '@/services/authService';

export type AdminActionLogPayload = {
  action: string;
  table_name?: string | null;
  record_id?: string | null;
  meta?: Record<string, unknown>;
};

export const auditService = {
  logAdminAction: async (payload: AdminActionLogPayload) => {
    const { user } = await authService.getCurrentUser();
    const userId = user?.id ?? null;
    const { error } = await supabase.from('admin_action_log').insert({
      user_id: userId,
      action: payload.action,
      table_name: payload.table_name ?? null,
      record_id: payload.record_id ?? null,
      meta: payload.meta ?? {},
    });
    throwIfError(error, 'auditService.logAdminAction');
    return { error: null };
  },
};

