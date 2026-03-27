import React from 'react';
import { Button } from '@shared/components/ui/button';
import { toCityArabicLabel } from '@modules/salaries/model/salaryUtils';
import type { SalaryFastRow } from '@modules/salaries/hooks/useSalaries';

const SALARY_TABLE_SKELETON_KEYS = [
  'salary-table-skeleton-1',
  'salary-table-skeleton-2',
  'salary-table-skeleton-3',
  'salary-table-skeleton-4',
  'salary-table-skeleton-5',
  'salary-table-skeleton-6',
  'salary-table-skeleton-7',
  'salary-table-skeleton-8',
  'salary-table-skeleton-9',
  'salary-table-skeleton-10',
  'salary-table-skeleton-11',
  'salary-table-skeleton-12',
] as const;

export function SalaryTable(props: Readonly<{
  rows: SalaryFastRow[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  tableRef: React.RefObject<HTMLTableElement | null>;
  onPageChange: (p: number) => void;
}>) {
  const { rows, total, page, totalPages, isLoading, tableRef, onPageChange } = props;
  let tableRowsNode: React.ReactNode;
  if (isLoading) {
    tableRowsNode = SALARY_TABLE_SKELETON_KEYS.map((skeletonKey) => (
      <tr key={skeletonKey}>
        <td className="px-4 py-3 text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
        <td className="px-4 py-3 text-center text-muted-foreground">...</td>
      </tr>
    ));
  } else if (rows.length === 0) {
    tableRowsNode = <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">لا توجد نتائج</td></tr>;
  } else {
    tableRowsNode = rows.map((r) => (
      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 font-semibold">{r.employees?.name ?? '—'}</td>
        <td className="px-4 py-3 text-center">{toCityArabicLabel(r.employees?.city)}</td>
        <td className="px-4 py-3 text-center font-bold">{Number(r.net_salary || 0).toLocaleString()}</td>
        <td className="px-4 py-3 text-center">{r.is_approved ? 'نعم' : 'لا'}</td>
        <td className="px-4 py-3 text-center font-mono text-xs">{(r.created_at || '').slice(0, 10)}</td>
      </tr>
    ));
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-center font-semibold px-4 py-3">الموظف</th>
              <th className="text-center font-semibold px-4 py-3">الفرع</th>
              <th className="text-center font-semibold px-4 py-3">صافي</th>
              <th className="text-center font-semibold px-4 py-3">معتمد</th>
              <th className="text-center font-semibold px-4 py-3">تاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tableRowsNode}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
        <div className="text-muted-foreground">{total.toLocaleString()} سجل</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
            السابق
          </Button>
          <span className="tabular-nums text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-8" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
