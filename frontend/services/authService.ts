import { supabase } from "../src/integrations/supabase/client";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { throwIfError } from "./serviceError";

export type AppRole = "admin" | "hr" | "finance" | "operations" | "viewer";

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
  signIn: async (email: string, password: string): Promise<{ session: Session | null; user: User | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error, "authService.signIn");
    return { session: data.session, user: data.user };
  },

  signOut: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    throwIfError(error, "authService.signOut");
  },

  getSession: async (): Promise<Session | null> => {
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error, "authService.getSession");
    return data.session;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.getUser();
    throwIfError(error, "authService.getCurrentUser");
    return data.user;
  },

  fetchUserRole: async (userId: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    throwIfError(error, "authService.fetchUserRole");
    return (data?.role as AppRole) ?? null;
  },

  fetchIsActive: async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle<ProfileActiveRow>();
    throwIfError(error, "authService.fetchIsActive");
    return data?.is_active !== false;
  },

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle();
    throwIfError(error, "authService.fetchProfile");
    return data as UserProfile | null;
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error, "authService.updatePassword");
  },

  sendPasswordReset: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${globalThis.location.origin}/reset-password`,
    });
    throwIfError(error, "authService.sendPasswordReset");
  },

  refreshSession: async (): Promise<{ session: Session | null; user: User | null }> => {
    const { data, error } = await supabase.auth.refreshSession();
    throwIfError(error, "authService.refreshSession");
    return { session: data.session, user: data.user };
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
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  removeRealtimeChannel: (channel: ReturnType<typeof supabase.channel>) => {
    supabase.removeChannel(channel);
  },

  // Critical fix: match edge contract that expects action + user_id.
  revokeSession: async (userId: string | null): Promise<void> => {
    if (!userId) {
      throw new Error("authService.revokeSession: userId is required");
    }
    const { error } = await supabase.functions.invoke("admin-update-user", {
      body: { user_id: userId, action: "revoke_session" },
    });
    throwIfError(error, "authService.revokeSession");
  },
};
