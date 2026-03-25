import { useQuery } from '@tanstack/react-query';
import { salaryService } from '@/services/salaryService';
import { toastQueryError } from '@/lib/query';
import type { BranchKey } from '@/components/table/GlobalTableFilters';

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
  const { monthYear, page, pageSize, filters } = params;
  const branch = filters.branch === 'all' ? undefined : filters.branch;
  const search = filters.search?.trim() || undefined;
  const approved = filters.approved ?? 'all';

  return useQuery<PagedResult>({
    queryKey: ['salaries', 'records', 'paged', monthYear, page, pageSize, branch ?? null, approved, search ?? null] as const,
    queryFn: async () => {
      const res = await salaryService.getPagedByMonth({
        monthYear,
        page,
        pageSize,
        filters: { branch, approved, search },
      });
      if (res.error) throw res.error;
      return { data: res.data, count: res.count };
    },
    retry: 1,
    staleTime: 15_000,
    onError: (err) => toastQueryError(err, 'تعذر تحميل الرواتب'),
  });
}

