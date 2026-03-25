import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@/services/employeeService';
import { toastQueryError } from '@/lib/query';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

export type EmployeesPagedFilters = {
  branch?: BranchKey;
  search?: string;
  status?: 'all' | 'active' | 'inactive' | 'ended';
};

type PagedResult = {
  data: unknown[];
  count: number;
};

export function useEmployeesPaged(params: {
  page: number;
  pageSize: number;
  filters: EmployeesPagedFilters;
}) {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { page, pageSize, filters } = params;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const status = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const search = filters.search?.trim() || undefined;

  return useQuery<PagedResult>({
    queryKey: ['employees', uid, 'paged', page, pageSize, branch ?? null, status ?? null, search ?? null] as const,
    queryFn: async () => {
      const res = await employeeService.getPaged({ page, pageSize, filters: { branch, status, search } });
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: 1,
    staleTime: 15_000,
    onError: (err) => toastQueryError(err, 'تعذر تحميل الموظفين'),
    enabled,
  });
}

