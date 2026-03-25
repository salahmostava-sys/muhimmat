import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { platformAccountService } from '@/services/platformAccountService';
import { toastQueryError } from '@/lib/query';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

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
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { page, pageSize, filters } = params;

  const employeeId = filters.driverId?.trim() || undefined;
  const appId = filters.platformAppId?.trim() || undefined;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const status = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const search = filters.search?.trim() || undefined;

  return useQuery<PagedResult>({
    queryKey: [
      'platform-accounts',
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
      const res = await platformAccountService.getAccountsPaged({
        page,
        pageSize,
        filters: { employeeId, appId, branch, status, search },
      });
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: 1,
    staleTime: 15_000,
    onError: (err) => toastQueryError(err, 'تعذر تحميل حسابات المنصات'),
    enabled,
  });
}

