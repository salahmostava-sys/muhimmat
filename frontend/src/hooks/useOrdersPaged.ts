import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';
import { toastQueryError } from '@/lib/query';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { useAuth } from '@/context/AuthContext';

export type OrdersPagedFilters = {
  driverId?: string | 'all';
  platformAppId?: string | 'all';
  branch?: BranchKey;
  search?: string;
};

export function useOrdersMonthPaged(params: {
  monthYear: string;
  page: number;
  pageSize: number;
  filters: OrdersPagedFilters;
}) {
  const { session } = useAuth();
  const { monthYear, page, pageSize, filters } = params;
  const driverId = filters.driverId && filters.driverId !== 'all' ? filters.driverId : undefined;
  const appId = filters.platformAppId && filters.platformAppId !== 'all' ? filters.platformAppId : undefined;
  const branch = filters.branch && filters.branch !== 'all' ? (filters.branch as 'makkah' | 'jeddah') : undefined;
  const search = filters.search?.trim() ? filters.search.trim() : undefined;

  return useQuery({
    queryKey: ['orders', 'month-paged', monthYear, page, pageSize, driverId ?? null, appId ?? null, branch ?? null, search ?? null] as const,
    queryFn: async () => {
      const res = await orderService.getMonthPaged({
        monthYear,
        page,
        pageSize,
        filters: { employeeId: driverId, appId, branch, search },
      });
      return res;
    },
    retry: 1,
    staleTime: 15_000,
    onError: (err) => toastQueryError(err, 'تعذر تحميل الطلبات'),
    enabled: !!session,
  });
}

