import { useRef } from 'react';
import { Button } from '@shared/components/ui/button';
import { DataTableActions } from '@shared/components/table/DataTableActions';
import { useToast } from '@shared/hooks/use-toast';
import { printHtmlTable } from '@shared/lib/printTable';
import type { BranchKey, GlobalTableFilterState } from '@shared/components/table/GlobalTableFilters';
import { useEmployeesPaged } from '@shared/hooks/useEmployeesPaged';
import { EmployeeFilters, type EmployeeStatusFilter } from '@modules/employees/components/EmployeeFilters';
import { EmployeeStats } from '@modules/employees/components/EmployeeStats';
import { EmployeesTable } from '@modules/employees/components/EmployeesTable';

export function EmployeesFastList(props: Readonly<{
  loadingMain: boolean;
  onBackToDetailed: () => void;
  branch: BranchKey;
  search: string;
  status: EmployeeStatusFilter;
  onStatusChange: (v: EmployeeStatusFilter) => void;
  onFiltersChange: (next: GlobalTableFilterState) => void;
  page: number;
  onPageChange: (p: number) => void;
  pageSize: number;
  onExport: () => void | Promise<void>;
  onDownloadTemplate: () => void | Promise<void>;
  onImportFile: (file: File) => void | Promise<void>;
  actionLoading: boolean;
  canEdit: boolean;
  toCityLabel: (city?: string | null, fallback?: string) => string;
}>) {
  const {
    loadingMain,
    onBackToDetailed,
    branch,
    search,
    status,
    onStatusChange,
    onFiltersChange,
    page,
    onPageChange,
    pageSize,
    onExport,
    onDownloadTemplate,
    onImportFile,
    actionLoading,
    canEdit,
    toCityLabel,
  } = props;
  const { toast } = useToast();
  const fastTableRef = useRef<HTMLTableElement>(null);

  const { data, isLoading } = useEmployeesPaged({
    page,
    pageSize,
    filters: { branch, search, status },
  });

  type Row = {
    id: string;
    name: string;
    employee_code: string | null;
    national_id: string | null;
    phone: string | null;
    city: string | null;
    status: string;
    residency_expiry: string | null;
  };
  const paged = data as { rows?: Row[]; total?: number } | undefined;
  const rows = paged?.rows || [];
  const total = paged?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFastPrint = () => {
    const table = fastTableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: 'الموظفين — قائمة سريعة',
      subtitle: `إجمالي النتائج: ${total.toLocaleString()} — ${new Date().toLocaleDateString('ar-SA')}`,
    });
  };

  const runSafe = async (fn: () => void | Promise<void>, fallbackMessage: string) => {
    try {
      await fn();
    } catch (e: unknown) {
      toast({
        title: 'حدث خطأ',
        description: e instanceof Error ? e.message : fallbackMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <EmployeeStats total={total} loading={loadingMain} />
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onBackToDetailed}>
              رجوع للتفصيلي
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm">
        <DataTableActions
          loading={actionLoading}
          onExport={() => runSafe(onExport, 'تعذر تنفيذ التصدير')}
          onDownloadTemplate={() => runSafe(onDownloadTemplate, 'تعذر تحميل القالب')}
          onPrint={() => runSafe(() => { handleFastPrint(); }, 'تعذر طباعة الجدول')}
          onImportFile={(file) => runSafe(() => onImportFile(file), 'تعذر استيراد الملف')}
          hideImport={!canEdit}
        />
      </div>

      <EmployeeFilters
        branch={branch}
        search={search}
        status={status}
        onStatusChange={onStatusChange}
        onFiltersChange={onFiltersChange}
      />

      <EmployeesTable
        rows={rows}
        total={total}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        tableRef={fastTableRef}
        toCityLabel={toCityLabel}
        onPageChange={onPageChange}
      />
    </div>
  );
}
