import { useRef, useState } from 'react';
import { TableActions } from '@shared/components/table/TableActions';
import type { BranchKey, GlobalTableFilterState } from '@shared/components/table/GlobalTableFilters';
import { printHtmlTable } from '@shared/lib/printTable';
import { useToast } from '@shared/hooks/use-toast';
import { salaryService } from '@services/salaryService';
import { auditService } from '@services/auditService';
import type { FastApprovedFilter } from '@modules/salaries/model/salaryUtils';
import { useSalariesFastList, type SalaryFastRow } from '@modules/salaries/hooks/useSalaries';
import { SalarySummary } from '@modules/salaries/components/SalarySummary';
import { SalaryFilters } from '@modules/salaries/components/SalaryFilters';
import { SalaryTable } from '@modules/salaries/components/SalaryTable';

const loadXlsx = () => import('@e965/xlsx');

export function SalaryFastList(props: Readonly<{
  monthYear: string;
  branch: BranchKey;
  search: string;
  approved: FastApprovedFilter;
  onApprovedChange: (v: FastApprovedFilter) => void;
  onFiltersChange: (next: GlobalTableFilterState) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onBack: () => void;
  onSalaryTemplate: () => void;
  onSalaryImport: (file: File) => void | Promise<void>;
  salaryActionLoading: boolean;
}>) {
  const { toast } = useToast();
  const {
    monthYear,
    branch,
    search,
    approved,
    onApprovedChange,
    onFiltersChange,
    page,
    pageSize,
    onPageChange,
    onBack,
    onSalaryTemplate,
    onSalaryImport,
    salaryActionLoading,
  } = props;

  const [exporting, setExporting] = useState(false);
  const fastTableRef = useRef<HTMLTableElement>(null);
  const { rows, total, isLoading } = useSalariesFastList({
    monthYear,
    page,
    pageSize,
    branch,
    search,
    approved,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleFastPrint = () => {
    const table = fastTableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: `سجلات الرواتب — ${monthYear}`,
      subtitle: `إجمالي النتائج: ${total.toLocaleString()}`,
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const XLSX = await loadXlsx();
      const branchKey: Exclude<BranchKey, 'all'> | undefined = branch === 'all' ? undefined : branch;
      const q = search?.trim() || undefined;

      const out = (await salaryService.exportMonth({
        monthYear,
        filters: { branch: branchKey, search: q, approved },
      })) as SalaryFastRow[];
      const sheet = out.map((r) => ({
        'الموظف': r.employees?.name ?? '',
        'الهوية': r.employees?.national_id ?? '',
        'الفرع': r.employees?.city ?? '',
        'صافي الراتب': r.net_salary ?? 0,
        'الأساسي': r.base_salary ?? 0,
        'سلفة': r.advance_deduction ?? 0,
        'خصم خارجي': r.external_deduction ?? 0,
        'خصم يدوي': r.manual_deduction ?? 0,
        'خصم حضور': r.attendance_deduction ?? 0,
        'معتمد': r.is_approved ? 'نعم' : 'لا',
        'تاريخ الإنشاء': r.created_at ?? '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      XLSX.utils.book_append_sheet(wb, ws, 'SalaryRecords');
      XLSX.writeFile(wb, `salary_records_${monthYear}.xlsx`);

      await auditService.logAdminAction({
        action: 'salary_records.export',
        table_name: 'salary_records',
        record_id: null,
        meta: { total: out.length, monthYear, branch: branchKey ?? null, approved, search: q ?? null },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر التصدير';
      toast({ title: 'خطأ', description: msg, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <SalarySummary monthYear={monthYear} total={total} onBack={onBack} />

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 shadow-sm">
        <TableActions
          loading={salaryActionLoading || exporting}
          onDownloadTemplate={onSalaryTemplate}
          onImportFile={onSalaryImport}
          onExport={exportExcel}
          onPrint={handleFastPrint}
        />
      </div>

      <SalaryFilters
        branch={branch}
        search={search}
        approved={approved}
        onApprovedChange={onApprovedChange}
        onFiltersChange={onFiltersChange}
      />

      <SalaryTable
        rows={rows}
        total={total}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        tableRef={fastTableRef}
        onPageChange={onPageChange}
      />
    </div>
  );
}
