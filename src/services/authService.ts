import { supabase } from '@/integrations/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { throwIfError } from '@/services/serviceError';

export type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

type AppRoleRow = {
  role: AppRole;
};

type ProfileActiveRow = {
  is_active?: boolean;
};

export const authService = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  getCurrentUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  },

  fetchUserRole: async (userId: string): Promise<AppRole | null> => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    return (data?.role as AppRole) ?? null;
  },

  fetchIsActive: async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .maybeSingle<ProfileActiveRow>();
    if (error) return true;
    return data?.is_active !== false;
  },

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, is_active')
      .eq('id', userId)
      .maybeSingle();
    return data as UserProfile | null;
  },

  updatePassword: async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    return { data, error };
  },

  sendPasswordReset: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${globalThis.location.origin}/reset-password`,
    });
    return { data, error };
  },

  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return { data, error };
  },

  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return data.subscription;
  },

  subscribeToProfileActiveChanges: (
    userId: string,
    callback: (payload: { new: ProfileActiveRow }) => void
  ) => {
    return supabase
      .channel(`profile-active-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  removeRealtimeChannel: (channel: ReturnType<typeof supabase.channel>) => {
    supabase.removeChannel(channel);
  },

  revokeSession: async (userId: string | null) => {
    const { error } = await supabase.functions.invoke('admin-update-user', {
      body: { userId, action: 'revoke_session' },
    });
    throwIfError(error, 'authService.revokeSession');
    return { error };
  },
};
