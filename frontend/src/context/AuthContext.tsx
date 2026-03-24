import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

const fetchIsActive = async (userId: string): Promise<boolean> => {
  const { data } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', userId)
    .maybeSingle();
  return data?.is_active ?? false;
};

const fetchRole = async (userId: string): Promise<AppRole | null> => {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return (data?.role as AppRole) || null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const forceSignOut = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const userId = currentUser?.id ?? user?.id ?? null;
    await supabase.auth.signOut();
    try {
      await supabase.functions.invoke('admin-update-user', {
        body: { userId, action: 'revoke_session' },
      });
    } catch {
      // silent fail — local session already cleared
    }
    setUser(null);
    setSession(null);
    setRole(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const active = await fetchIsActive(session.user.id);
          if (!active) {
            await forceSignOut();
            setLoading(false);
            return;
          }
          setSession(session);
          setUser(session.user);
          const r = await fetchRole(session.user.id);
          setRole(r);
        } else {
          setSession(null);
          setUser(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const active = await fetchIsActive(session.user.id);
        if (!active) {
          await forceSignOut();
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session.user);
        const r = await fetchRole(session.user.id);
        setRole(r);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-active-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async (payload) => {
          const updated = payload.new as { is_active?: boolean };
          if (updated.is_active === false) {
            await forceSignOut();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error };

    if (data.user) {
      const active = await fetchIsActive(data.user.id);
      if (!active) {
        await supabase.auth.signOut();
        return { error: { message: 'هذا الحساب معطّل. تواصل مع المسؤول.' } };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
