import { supabase } from '@/integrations/supabase/client';

export const userPermissionService = {
  getProfiles: async () =>
    supabase.from('profiles').select('id, full_name, is_active').order('full_name'),

  getUserRoles: async () =>
    supabase.from('user_roles').select('id, user_id, role'),

  upsertRole: async (userId: string, role: string) => {
    const { data: existing, error: existingError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) {
      return { error: existingError };
    }
    if (existing?.id) {
      return supabase.from('user_roles').update({ role }).eq('id', existing.id);
    }
    return supabase.from('user_roles').insert({ user_id: userId, role });
  },
};
