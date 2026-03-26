import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { platformAccountService } from '@/services/platformAccountService';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@/lib/reactQuerySafety';

export type PlatformAccountsPagedFilters = {
  driverId?: string;
  platformAppId?: string;
  branch?: BranchKey;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
};

type PagedResult = {
  data: unknown[];
  count: number;
};

export function usePlatformAccountsPaged(params: {
  page: number;
  pageSize: number;
  filters: PlatformAccountsPagedFilters;
}): UseQueryResult<PagedResult> {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const { page, pageSize, filters } = params;

  const employeeId = filters.driverId?.trim() || undefined;
  const appId = filters.platformAppId?.trim() || undefined;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const status = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const search = filters.search?.trim() || undefined;

  const q = useQuery<PagedResult>({
    queryKey: [
      'platform-accounts',
      uid,
      'paged',
      page,
      pageSize,
      employeeId ?? null,
      appId ?? null,
      branch ?? null,
      status ?? null,
      search ?? null,
    ] as const,
    queryFn: async () => {
      const res = await withQueryTimeout(
        platformAccountService.getAccountsPaged({
          page,
          pageSize,
          filters: { employeeId, appId, branch, status, search },
        })
      );
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل حسابات المنصات');
  return q;
}

