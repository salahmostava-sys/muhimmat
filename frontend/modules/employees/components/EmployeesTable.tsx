import React from 'react';
import { Button } from '@shared/components/ui/button';
import { Skeleton } from '@shared/components/ui/skeleton';

type FastRow = {
  id: string;
  name: string;
  employee_code: string | null;
  national_id: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  residency_expiry: string | null;
};

const FAST_SKELETON_IDS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'];

type EmployeesTableProps = Readonly<{
  rows: FastRow[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  tableRef: React.RefObject<HTMLTableElement | null>;
  toCityLabel: (city?: string | null, fallback?: string) => string;
  onPageChange: (p: number) => void;
}>;

export function EmployeesTable({
  rows,
  total,
  page,
  totalPages,
  isLoading,
  tableRef,
  toCityLabel,
  onPageChange,
}: EmployeesTableProps) {
  let fastBodyRows: React.ReactNode;
  if (isLoading) {
    fastBodyRows = FAST_SKELETON_IDS.map((id) => (
      <tr key={`employees-table-skeleton-${id}`}>
        <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
        <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
      </tr>
    ));
  } else if (rows.length === 0) {
    fastBodyRows = (
      <tr>
        <td colSpan={7} className="py-10 text-center text-muted-foreground">
          لا توجد نتائج
        </td>
      </tr>
    );
  } else {
    fastBodyRows = rows.map((r) => (
      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3 font-semibold">{r.name}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{r.employee_code ?? '—'}</td>
        <td className="px-4 py-3 text-xs tabular-nums">{r.national_id ?? '—'}</td>
        <td className="px-4 py-3 text-xs tabular-nums">{r.phone ?? '—'}</td>
        <td className="px-4 py-3">{toCityLabel(r.city)}</td>
        <td className="px-4 py-3">
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
            {r.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs tabular-nums">{r.residency_expiry ?? '—'}</td>
      </tr>
    ));
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-center font-semibold px-4 py-3">الاسم</th>
              <th className="text-center font-semibold px-4 py-3">الكود</th>
              <th className="text-center font-semibold px-4 py-3">رقم الهوية</th>
              <th className="text-center font-semibold px-4 py-3">الهاتف</th>
              <th className="text-center font-semibold px-4 py-3">الفرع</th>
              <th className="text-center font-semibold px-4 py-3">الحالة</th>
              <th className="text-center font-semibold px-4 py-3">انتهاء الإقامة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fastBodyRows}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
        <div className="text-muted-foreground">{total.toLocaleString()} نتيجة</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            السابق
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            التالي
          </Button>
        </div>
      </div>
    </div>
  );
}
