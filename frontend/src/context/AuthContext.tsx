import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '@/services/authService';
import { useQueryClient } from '@tanstack/react-query';

type AppRole = 'admin' | 'hr' | 'finance' | 'operations' | 'viewer';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  /** Initial auth resolution + session refresh in flight — use for UI spinners. */
  loading: boolean;
  /** Same as `loading` — use for React Query `enabled: … && !authLoading`. */
  authLoading: boolean;
  recoverSessionSilently: (opts?: { refetchActiveQueries?: boolean }) => Promise<boolean>;
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
  const recoverInFlightRef = useRef<Promise<boolean> | null>(null);

  const forceSignOut = useCallback(async () => {
    const { user: currentUser } = await authService.getCurrentUser();
    const userId = currentUser?.id ?? user?.id ?? null;
    await authService.signOut();
    try {
      await authService.revokeSession(userId);
    } catch (e) {
      console.error('[Auth] revokeSession failed (session may already be cleared)', e);
    }
    setUser(null);
    setSession(null);
    setRole(null);
  }, [user?.id]);

  const recoverSessionSilently = useCallback(async (opts?: { refetchActiveQueries?: boolean }) => {
    if (recoverInFlightRef.current !== null) return recoverInFlightRef.current;

    const task = (async () => {
      setRefreshing(true);
      try {
        const { session: current } = await authService.getSession();
        if (current?.user) {
          if (opts?.refetchActiveQueries) {
            await queryClient.refetchQueries({ type: 'active' });
          }
          return true;
        }

        // No stored session/token: avoid refreshSession() to prevent AuthSessionMissingError spam.
        if (!current) return false;
        await authService.refreshSession();

        const { session: after } = await authService.getSession();
        if (after?.user) {
          if (opts?.refetchActiveQueries) {
            await queryClient.refetchQueries({ type: 'active' });
          }
          return true;
        }
        return false;
      } catch (e) {
        console.error('[Auth] recoverSessionSilently failed', e);
        return false;
      } finally {
        setRefreshing(false);
      }
    })();

    recoverInFlightRef.current = task;
    return task.finally(() => {
      recoverInFlightRef.current = null;
    });
  }, [queryClient]);

  useEffect(() => {
    const subscription = authService.onAuthStateChange(async (event, nextSession) => {
      try {
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
          try {
            await queryClient.cancelQueries();
            queryClient.clear();
          } catch (e) {
            console.error('[Auth] queryClient cancel/clear failed', e);
          }
          setRefreshing(false);
          setLoading(false);
        }
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
      } catch (e) {
        console.error('[Auth] onAuthStateChange handler failed', e);
      } finally {
        setLoading(false);
      }
    });

    authService.getSession()
      .then(async ({ session: currentSession }) => {
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
      })
      .catch((e) => {
        console.error('[Auth] getSession bootstrap failed', e);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, [forceSignOut, queryClient]);

  // عند العودة للتبويب/الاتصال: استعادة/تجديد الجلسة بشكل صامت + إعادة تحميل البيانات
  useEffect(() => {
    let lastRefreshAt = 0;
    const minMs = 45_000;
    const onWake = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < minMs) return;
      lastRefreshAt = now;
      await recoverSessionSilently({ refetchActiveQueries: true });
    };
    const onFocus = () => {
      void onWake();
    };
    const onOnline = () => {
      void onWake();
    };
    document.addEventListener('visibilitychange', onWake);
    globalThis.addEventListener('focus', onFocus);
    globalThis.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      globalThis.removeEventListener('focus', onFocus);
      globalThis.removeEventListener('online', onOnline);
    };
  }, [recoverSessionSilently]);

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

  const busy = loading || refreshing;
  const contextValue = useMemo<AuthContextType>(() => ({
    user,
    session,
    role,
    loading: busy,
    authLoading: busy,
    recoverSessionSilently,
    signIn,
    signOut,
  }), [user, session, role, busy, recoverSessionSilently, signIn, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
