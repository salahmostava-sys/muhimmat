import { useAuth } from '@/context/AuthContext';

/**
 * Triple-gate for React Query (equivalent to inline):
 * `enabled: !!session && !!user && !authLoading`
 *
 * Use `enabled` on every `useQuery`, and scope keys with `authQueryUserId(userId)` so the
 * second segment is the signed-in user's id (or `__none__` while disabled).
 */
export function useAuthQueryGate() {
  const { user, session, authLoading } = useAuth();
  const enabled = Boolean(session && user && !authLoading);
  const userId = user?.id ?? null;
  return { enabled, userId, authLoading };
}

/** Stable second segment for query keys when the query is disabled (no logged-in user). */
export function authQueryUserId(userId: string | null | undefined): string {
  return userId ?? '__none__';
}
