import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@services/serviceError';

export type PagePermissionRow = {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export const userPermissionService = {
  getProfiles: async () => {
    const { data, error } = await supabase.from('profiles').select('id, name, is_active').order('name');
    throwIfError(error, 'userPermissionService.getProfiles');
    return { data, error: null };
  },

  getUserRoles: async () => {
    const { data, error } = await supabase.from('user_roles').select('id, user_id, role');
    throwIfError(error, 'userPermissionService.getUserRoles');
    return { data, error: null };
  },

  getUserPermissions: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete')
      .eq('user_id', userId);
    throwIfError(error, 'userPermissionService.getUserPermissions');
    return { data, error: null };
  },

  /** Upsert override; pass null to remove row when same as role default (caller handles delete). */
  upsertPermission: async (
    userId: string,
    permissionKey: string,
    perms: { can_view: boolean; can_edit: boolean; can_delete: boolean }
  ) => {
    const { data, error } = await supabase.from('user_permissions').upsert(
      {
        user_id: userId,
        permission_key: permissionKey,
        can_view: perms.can_view,
        can_edit: perms.can_edit,
        can_delete: perms.can_delete,
      },
      { onConflict: 'user_id,permission_key' }
    );
    throwIfError(error, 'userPermissionService.upsertPermission');
    return { data, error: null };
  },

  deletePermission: async (userId: string, permissionKey: string) => {
    const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_key', permissionKey);
    throwIfError(error, 'userPermissionService.deletePermission');
    return { error: null };
  },

  upsertRole: async (userId: string, role: string) => {
    const { data: existing, error: existingError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    throwIfError(existingError, 'userPermissionService.upsertRole.select');
    if (existing?.id) {
      const { data, error } = await supabase.from('user_roles').update({ role }).eq('id', existing.id);
      throwIfError(error, 'userPermissionService.upsertRole.update');
      return { data, error: null };
    }
    const { data, error } = await supabase.from('user_roles').insert({ user_id: userId, role });
    throwIfError(error, 'userPermissionService.upsertRole.insert');
    return { data, error: null };
  },
};
