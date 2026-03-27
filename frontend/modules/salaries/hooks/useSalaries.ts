import type { BranchKey } from '@shared/components/table/GlobalTableFilters';
import { useSalaryRecordsPaged } from '@shared/hooks/useSalaryRecordsPaged';
import type { FastApprovedFilter } from '@modules/salaries/model/salaryUtils';

export type SalaryFastRow = {
  id: string;
  employee_id: string;
  month_year: string;
  net_salary: number | null;
  base_salary: number | null;
  advance_deduction: number | null;
  external_deduction: number | null;
  manual_deduction: number | null;
  attendance_deduction: number | null;
  is_approved: boolean | null;
  created_at: string;
  employees?: { id: string; name: string; national_id: string | null; city: string | null } | null;
};

export function useSalariesFastList(params: {
  monthYear: string;
  page: number;
  pageSize: number;
  branch: BranchKey;
  search: string;
  approved: FastApprovedFilter;
}) {
  const { data, isLoading } = useSalaryRecordsPaged({
    monthYear: params.monthYear,
    page: params.page,
    pageSize: params.pageSize,
    filters: {
      branch: params.branch,
      search: params.search,
      approved: params.approved,
    },
  });

  const paged = data as { rows?: SalaryFastRow[]; total?: number } | undefined;
  return {
    rows: paged?.rows ?? [],
    total: paged?.total ?? 0,
    isLoading,
  };
}
