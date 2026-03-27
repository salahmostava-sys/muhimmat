import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthContext';
import { syncErrorContextFromNavigation } from '@shared/lib/errorContextMeta';

/**
 * Keeps last-known route + user id for ErrorBoundary / crash logging (no hooks in class boundaries).
 */
export function ErrorContextSync() {
  const { pathname, search } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    syncErrorContextFromNavigation(pathname, search, user?.id ?? null);
  }, [pathname, search, user?.id]);

  return null;
}
