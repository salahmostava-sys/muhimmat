import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '@/services/authService';
import { useQueryClient } from '@tanstack/react-query';

type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const fetchRole = async (userId: string): Promise<AppRole | null> => {
  return authService.fetchUserRole(userId);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const forceSignOut = useCallback(async () => {
    const { user: currentUser } = await authService.getCurrentUser();
    const userId = currentUser?.id ?? user?.id ?? null;
    await authService.signOut();
    try {
      await authService.revokeSession(userId);
    } catch {
      // silent fail — local session already cleared
    }
    setUser(null);
    setSession(null);
    setRole(null);
  }, [user?.id]);

  const isAuthed = useMemo(() => !!(user && session), [session, user]);

  useEffect(() => {
    const subscription = authService.onAuthStateChange(async (_event, nextSession) => {
      if (nextSession?.user) {
        const active = await authService.fetchIsActive(nextSession.user.id);
        if (!active) {
          await forceSignOut();
          setLoading(false);
          return;
        }
        setSession(nextSession);
        setUser(nextSession.user);
        const r = await fetchRole(nextSession.user.id);
        setRole(r);
      } else {
        setSession(null);
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    authService.getSession().then(async ({ session: currentSession }) => {
      if (currentSession?.user) {
        const active = await authService.fetchIsActive(currentSession.user.id);
        if (!active) {
          await forceSignOut();
          setLoading(false);
          return;
        }
        setSession(currentSession);
        setUser(currentSession.user);
        const r = await fetchRole(currentSession.user.id);
        setRole(r);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [forceSignOut]);

  // عند العودة للتبويب: استعادة/تجديد الجلسة بشكل صامت + إعادة تحميل بيانات React Query
  useEffect(() => {
    let lastRefreshAt = 0;
    const minMs = 45_000;
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < minMs) return;
      lastRefreshAt = now;
      // If we're already logged in (or we were recently), keep the app on-screen and recover silently.
      if (isAuthed) setRefreshing(true);
      try {
        const { session: current } = await authService.getSession();
        if (current?.user) {
          // If we got a session back, React Query can refetch normally on focus.
          await queryClient.refetchQueries({ type: 'active' });
          return;
        }

        // No session (or in limbo). Try a silent refresh once.
        const { error } = await authService.refreshSession();
        if (error) return;

        // Confirm we have a session after refresh, then refetch.
        const { session: after } = await authService.getSession();
        if (after?.user) await queryClient.refetchQueries({ type: 'active' });
      } catch {
        // silent
      } finally {
        setRefreshing(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isAuthed, queryClient]);

  useEffect(() => {
    if (!user) return;

    const channel = authService.subscribeToProfileActiveChanges(
      user.id,
      async (payload) => {
        const updated = payload.new;
        if (updated.is_active === false) {
          await forceSignOut();
        }
      }
    );

    return () => { authService.removeRealtimeChannel(channel); };
  }, [forceSignOut, user]);

  // Re-check profile.is_active while logged in (narrows window where JWT still works after deactivation).
  useEffect(() => {
    if (!user?.id) return;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      const active = await authService.fetchIsActive(user.id);
      if (!active) await forceSignOut();
    };
    const id = setInterval(tick, 120_000);
    return () => clearInterval(id);
  }, [forceSignOut, user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await authService.signIn(email, password);

    if (error) return { error };

    if (data.user) {
      const active = await authService.fetchIsActive(data.user.id);
      if (!active) {
        await authService.signOut();
        return { error: { message: 'هذا الحساب معطّل. تواصل مع المسؤول.' } };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await authService.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading: loading || refreshing, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
