import { supabase } from '@/integrations/supabase/client';

export type PagePermissionRow = {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export const userPermissionService = {
  getProfiles: async () =>
    supabase.from('profiles').select('id, name, is_active').order('name'),

  getUserRoles: async () =>
    supabase.from('user_roles').select('id, user_id, role'),

  getUserPermissions: async (userId: string) =>
    supabase
      .from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete')
      .eq('user_id', userId),

  /** Upsert override; pass null to remove row when same as role default (caller handles delete). */
  upsertPermission: async (
    userId: string,
    permissionKey: string,
    perms: { can_view: boolean; can_edit: boolean; can_delete: boolean }
  ) =>
    supabase.from('user_permissions').upsert(
      {
        user_id: userId,
        permission_key: permissionKey,
        can_view: perms.can_view,
        can_edit: perms.can_edit,
        can_delete: perms.can_delete,
      },
      { onConflict: 'user_id,permission_key' }
    ),

  deletePermission: async (userId: string, permissionKey: string) =>
    supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_key', permissionKey),

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
