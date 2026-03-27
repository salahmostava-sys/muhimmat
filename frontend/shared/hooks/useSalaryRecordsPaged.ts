import { useQuery } from '@tanstack/react-query';
import { salaryService } from '@services/salaryService';
import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';
import { safeRetry, withQueryTimeout } from '@shared/lib/reactQuerySafety';
import type { PagedResult } from '@shared/types/pagination';

export type SalaryRecordsPagedFilters = {
  branch?: BranchKey;
  search?: string;
  approved?: 'all' | 'approved' | 'pending';
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

  const q = useQuery<PagedResult<unknown>>({
    queryKey: ['salaries', uid, 'records', 'paged', monthYear, page, pageSize, branch ?? null, approved, search ?? null] as const,
    queryFn: async () => withQueryTimeout(
      salaryService.getPagedByMonth({
        monthYear,
        page,
        pageSize,
        filters: { branch, approved, search },
      })
    ),
    retry: safeRetry,
    staleTime: 15_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, 'تعذر تحميل الرواتب', q.refetch);
  return q;
}

