import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@services/employeeService';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@/lib/reactQuerySafety';

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
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const { page, pageSize, filters } = params;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const status = filters.status && filters.status !== 'all' ? filters.status : undefined;
  const search = filters.search?.trim() || undefined;

  const q = useQuery<PagedResult>({
    queryKey: ['employees', uid, 'paged', page, pageSize, branch ?? null, status ?? null, search ?? null] as const,
    queryFn: async () => {
      const res = await withQueryTimeout(
        employeeService.getPaged({ page, pageSize, filters: { branch, status, search } })
      );
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل الموظفين');
  return q;
}

