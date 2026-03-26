import { useQuery } from '@tanstack/react-query';
import { salaryService } from '@/services/salaryService';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@/lib/reactQuerySafety';

export type SalaryRecordsPagedFilters = {
  branch?: BranchKey;
  search?: string;
  approved?: 'all' | 'approved' | 'pending';
};

type PagedResult = {
  data: unknown[];
  count: number;
};

export function useSalaryRecordsPaged(params: {
  monthYear: string;
  page: number;
  pageSize: number;
  filters: SalaryRecordsPagedFilters;
}) {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const { monthYear, page, pageSize, filters } = params;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const search = filters.search?.trim() || undefined;
  const approved = filters.approved ?? 'all';

  const q = useQuery<PagedResult>({
    queryKey: ['salaries', uid, 'records', 'paged', monthYear, page, pageSize, branch ?? null, approved, search ?? null] as const,
    queryFn: async () => {
      const res = await withQueryTimeout(
        salaryService.getPagedByMonth({
          monthYear,
          page,
          pageSize,
          filters: { branch, approved, search },
        })
      );
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل الرواتب');
  return q;
}

