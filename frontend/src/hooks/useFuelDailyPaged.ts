import { useQuery } from '@tanstack/react-query';
import { fuelService } from '@/services/fuelService';
import { toastQueryError } from '@/lib/query';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

export type FuelDailyPagedFilters = {
  driverId?: string;
  branch?: BranchKey;
  search?: string;
};

type PagedResult = {
  data: unknown[];
  count: number;
};

export function useFuelDailyPaged(params: {
  monthStart: string;
  monthEnd: string;
  page: number;
  pageSize: number;
  filters: FuelDailyPagedFilters;
}) {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { monthStart, monthEnd, page, pageSize, filters } = params;
  const employeeId = filters.driverId?.trim() || undefined;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const search = filters.search?.trim() || undefined;

  return useQuery<PagedResult>({
    queryKey: ['fuel', uid, 'daily', 'paged', monthStart, monthEnd, page, pageSize, employeeId ?? null, branch ?? null, search ?? null] as const,
    queryFn: async () => {
      const res = await fuelService.getDailyMileagePaged({
        monthStart,
        monthEnd,
        page,
        pageSize,
        filters: { employeeId, branch, search },
      });
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: 1,
    staleTime: 15_000,
    onError: (err) => toastQueryError(err, 'تعذر تحميل بيانات الوقود'),
    enabled,
  });
}

