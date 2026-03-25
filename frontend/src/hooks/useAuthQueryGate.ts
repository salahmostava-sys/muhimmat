import { useAuth } from '@/context/AuthContext';

/**
 * Central gate for React Query: no fetch until session + user are resolved and auth is not loading.
 * Use with `enabled: enabled && …` and scope `queryKey` with `authQueryUserId(userId)`.
 */
export function useAuthQueryGate() {
  const { user, session, authLoading } = useAuth();
  const enabled = !!session && !!user && !authLoading;
  const userId = user?.id ?? null;
  return { enabled, userId, authLoading };
}

/** Stable second segment for query keys when the query is disabled (no logged-in user). */
export function authQueryUserId(userId: string | null | undefined): string {
  return userId ?? '__none__';
}
