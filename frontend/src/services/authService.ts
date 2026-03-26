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

type ProfileActiveRow = {
  is_active?: boolean;
};

export const authService = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error, 'authService.signIn');
    return { data, error: null };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    throwIfError(error, 'authService.signOut');
    return { error: null };
  },

  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error, 'authService.getSession');
    return { session: data.session, error: null };
  },

  getCurrentUser: async () => {
    const { data, error } = await supabase.auth.getUser();
    throwIfError(error, 'authService.getCurrentUser');
    return { user: data.user, error: null };
  },

  fetchUserRole: async (userId: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    throwIfError(error, 'authService.fetchUserRole');
    return (data?.role as AppRole) ?? null;
  },

  fetchIsActive: async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .maybeSingle<ProfileActiveRow>();
    throwIfError(error, 'authService.fetchIsActive');
    return data?.is_active !== false;
  },

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, avatar_url, is_active')
      .eq('id', userId)
      .maybeSingle();
    throwIfError(error, 'authService.fetchProfile');
    return data as UserProfile | null;
  },

  updatePassword: async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error, 'authService.updatePassword');
    return { data, error: null };
  },

  sendPasswordReset: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${globalThis.location.origin}/reset-password`,
    });
    throwIfError(error, 'authService.sendPasswordReset');
    return { data, error: null };
  },

  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    throwIfError(error, 'authService.refreshSession');
    return { data, error: null };
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
    return { error: null };
  },
};
