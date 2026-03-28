import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { platformAccountService } from '@services/platformAccountService';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@shared/lib/reactQuerySafety';
import type { PagedResult } from '@shared/types/pagination';

export type PlatformAccountsPagedFilters = {
  driverId?: string;
  platformAppIds?: string[];
  branch?: BranchKey;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
};

export function usePlatformAccountsPaged(params: {
  page: number;
  pageSize: number;
  filters: PlatformAccountsPagedFilters;
}): UseQueryResult<PagedResult<unknown>> {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const { page, pageSize, filters } = params;

  const employeeId = filters.driverId?.trim() || undefined;
  const appIds =
    filters.platformAppIds && filters.platformAppIds.length > 0 ? filters.platformAppIds : undefined;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const status = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const search = filters.search?.trim() || undefined;

  const q = useQuery<PagedResult<unknown>>({
    queryKey: [
      'platform-accounts',
      uid,
      'paged',
      page,
      pageSize,
      employeeId ?? null,
      appIds?.join(',') ?? null,
      branch ?? null,
      status ?? null,
      search ?? null,
    ] as const,
    queryFn: async () => withQueryTimeout(
      platformAccountService.getAccountsPaged({
        page,
        pageSize,
        filters: { employeeId, appIds, branch, status, search },
      })
    ),
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل حسابات المنصات', q.refetch);
  return q;
}

