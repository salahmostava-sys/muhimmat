import { useQuery } from '@tanstack/react-query';
import { orderService } from '@services/orderService';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@shared/lib/reactQuerySafety';
import type { PagedResult } from '@shared/types/pagination';

export type OrdersPagedFilters = {
  driverId?: string;
  platformAppId?: string;
  branch?: BranchKey;
  search?: string;
};

export function useOrdersMonthPaged(params: {
  monthYear: string;
  page: number;
  pageSize: number;
  filters: OrdersPagedFilters;
}) {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const { monthYear, page, pageSize, filters } = params;
  const driverId = filters.driverId && filters.driverId !== 'all' ? filters.driverId : undefined;
  const appId = filters.platformAppId && filters.platformAppId !== 'all' ? filters.platformAppId : undefined;
  const branch = filters.branch && filters.branch !== 'all' ? filters.branch : undefined;
  const search = filters.search?.trim() ? filters.search.trim() : undefined;

  const q = useQuery<PagedResult<unknown>>({
    queryKey: ['orders', uid, 'month-paged', monthYear, page, pageSize, driverId ?? null, appId ?? null, branch ?? null, search ?? null] as const,
    queryFn: async () => {
      const res = await withQueryTimeout(
        orderService.getMonthPaged({
          monthYear,
          page,
          pageSize,
          filters: { employeeId: driverId, appId, branch, search },
        })
      );
      return res;
    },
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل الطلبات', q.refetch);
  return q;
}

