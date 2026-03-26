import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { authService } from '@services/authService';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthFailure } from '@shared/lib/auth/authFailureBus';

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
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const recoverInFlightRef = useRef<Promise<boolean> | null>(null);
  const isFirstLoad = useRef(true);
  const redirectLockRef = useRef(false);
  const redirectCooldownUntilRef = useRef(0);
  const isPublicAuthRoute = useCallback((pathname: string) => (
    pathname === '/login' || pathname === '/forgot-password' || pathname === '/reset-password'
  ), []);
  const redirectToLoginIfNeeded = useCallback(() => {
    if (redirectLockRef.current) return;
    if (isPublicAuthRoute(location.pathname)) return;
    const now = Date.now();
    if (now < redirectCooldownUntilRef.current) return;
    redirectLockRef.current = true;
    redirectCooldownUntilRef.current = now + 2000;
    navigate('/login', { replace: true, state: { from: location.pathname } });
    setTimeout(() => { redirectLockRef.current = false; }, 300);
  }, [isPublicAuthRoute, location.pathname, navigate]);
  const handleUnauthenticatedState = useCallback(async (reason: string) => {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
    } catch (e) {
      console.error('[Auth] queryClient cancel/clear failed', e);
    }
    setRefreshing(false);
    setLoading(false);
    setSession(null);
    setUser(null);
    setRole(null);
    console.warn('[Auth] transitioning to unauthenticated state', { reason });
    redirectToLoginIfNeeded();
  }, [queryClient, redirectToLoginIfNeeded]);

  const forceSignOut = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
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
    redirectToLoginIfNeeded();
  }, [redirectToLoginIfNeeded, user?.id]);

  const recoverSessionSilently = useCallback(async (opts?: { refetchActiveQueries?: boolean }) => {
    if (recoverInFlightRef.current !== null) return recoverInFlightRef.current;

    const task = (async () => {
      setRefreshing(true);
      try {
        const current = await authService.getSession();
        if (current?.user) {
          if (opts?.refetchActiveQueries) {
            await queryClient.refetchQueries({ type: 'active' });
          }
          return true;
        }

        // No stored session/token: avoid refreshSession() to prevent AuthSessionMissingError spam.
        if (!current) return false;
        await authService.refreshSession();

        const after = await authService.getSession();
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
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          setLoading(false);
        }
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED') {
          await handleUnauthenticatedState(event.toLowerCase());
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
      }
    });

    authService.getSession()
      .then(async (currentSession) => {
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
  }, [forceSignOut, handleUnauthenticatedState]);

  useEffect(() => {
    return onAuthFailure(({ source, reason }) => {
      void handleUnauthenticatedState(`${source}:${reason}`);
    });
  }, [handleUnauthenticatedState]);

  // Single redirect owner: keep unauthenticated users off protected routes.
  useEffect(() => {
    if (loading || refreshing) return;
    if (session) return;
    redirectToLoginIfNeeded();
  }, [loading, refreshing, session, redirectToLoginIfNeeded]);

  // عند العودة للتبويب/الاتصال: استعادة/تجديد الجلسة بشكل صامت + إعادة تحميل البيانات
  useEffect(() => {
    let lastRefreshAt = 0;
    const minMs = 45_000;
    const onWake = async () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < minMs) return;
      lastRefreshAt = now;
      await recoverSessionSilently({ refetchActiveQueries: false });
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
    try {
      const data = await authService.signIn(email, password);

      if (data.user) {
        const active = await authService.fetchIsActive(data.user.id);
        if (!active) {
          await authService.signOut();
          return { error: { message: 'هذا الحساب معطّل. تواصل مع المسؤول.' } };
        }
      }

      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر تسجيل الدخول';
      return { error: { message: msg } };
    }
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
