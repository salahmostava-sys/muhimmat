import { useState, useCallback, useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus, Eye, Edit, Trash2,
  Loader2, Columns, Filter, X, CalendarDays,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel
} from '@shared/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Label } from '@shared/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { differenceInDays, parseISO, format } from 'date-fns';
import EmployeeProfile from '@shared/components/employees/EmployeeProfile';
import { DataTableActions } from '@shared/components/table/DataTableActions';
import {
  EMPLOYEE_TEMPLATE_AR_HEADERS,
  parseEmployeeArabicWorkbook,
  type EmployeeArabicRow,
  upsertEmployeeArabicRows,
} from '@shared/lib/employeeArabicTemplateImport';
import { EMPLOYEE_IMPORT_COLUMNS } from '@shared/constants/excelSchemas';
import { printHtmlTable } from '@shared/lib/printTable';
import { driverService } from '@services/driverService';
import { useToast } from '@shared/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { usePermissions } from '@shared/hooks/usePermissions';
import { isEmployeeVisibleInMonth } from '@shared/lib/employeeVisibility';
import { createDefaultGlobalFilters } from '@shared/components/table/GlobalTableFilters';
import { employeeService } from '@services/employeeService';
import { auditService } from '@services/auditService';
import { useEmployeesData } from '@modules/employees/hooks/useEmployees';
import { validateImportRow } from '@modules/employees/model/employeeValidation';
import { applyEmployeeFilters, getEmployeeFieldValue, parseBranchFilter, sortEmployees } from '@modules/employees/model/employeeUtils';
import { EmployeesFastList as EmployeesFastListView } from '@modules/employees/components/EmployeesFastList';
import { EmployeeFormModal } from '@modules/employees/components/EmployeeFormModal';
import {
  CityBadge,
  LicenseBadge,
  SponsorBadge,
  StatusBadge,
  InlineSelect,
  EmployeeAvatar,
  SortIcon,
  ColFilterPopover,
  SkeletonRow,
  TextFilterInput,
} from '@modules/pages/employees/EmployeesViewParts';

// ─── Types ────────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  name_en?: string | null;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  employee_code?: string | null;
  bank_account_number?: string | null;
  iban?: string | null;
  city?: string | null;
  join_date?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  health_insurance_expiry?: string | null;
  probation_end_date?: string | null;
  license_status?: string | null;
  license_expiry?: string | null;
  sponsorship_status?: string | null;
  id_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  nationality?: string | null;
  preferred_language?: string | null;
};

type SortField = keyof Employee | 'days_residency' | 'residency_status';
type SortDir = 'asc' | 'desc' | null;
type EmployeeProfileProps = ComponentProps<typeof EmployeeProfile>;
type EmployeeStatusFilter = 'all' | 'active' | 'inactive' | 'ended';
type UploadReport = {
  totalProcessed: number;
  successfulRows: number;
  failedRows: number;
  errors: Array<{ rowIndex: number; issue: string }>;
};

type UploadLiveStats = {
  processedNames: number;
  totalNames: number;
  currentName: string;
};

const processBulkImportRows = async (
  buffer: ArrayBuffer,
  onProgress: (value: number) => void,
  onLiveStats: (stats: UploadLiveStats) => void,
): Promise<{ report: UploadReport; headerWarnings: number }> => {
  onProgress(10);
  const { rows, headerErrors } = parseEmployeeArabicWorkbook(buffer);
  if (rows.length === 0) {
    return {
      report: {
        totalProcessed: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: [{ rowIndex: 1, issue: 'الملف لا يحتوي على بيانات صالحة للمعالجة' }],
      },
      headerWarnings: headerErrors.length,
    };
  }

  const validationErrors: Array<{ rowIndex: number; issue: string }> = [];
  const validRows: Array<{ rowIndex: number; row: EmployeeArabicRow }> = [];

  if (headerErrors.length > 0) {
    headerErrors.forEach((err) => validationErrors.push({ rowIndex: 1, issue: err }));
  }

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2;
    const rowIssues = validateImportRow(row, rowIndex);
    if (rowIssues.length > 0) validationErrors.push(...rowIssues);
    else validRows.push({ rowIndex, row });
  });

  onProgress(25);

  let successfulRows = 0;
  const processingErrors: Array<{ rowIndex: number; issue: string }> = [];
  const totalToProcess = Math.max(validRows.length, 1);
  onLiveStats({ processedNames: 0, totalNames: validRows.length, currentName: '' });

  for (let i = 0; i < validRows.length; i++) {
    const item = validRows[i];
    const currentName = String(item.row.name ?? '').trim() || `سطر ${item.rowIndex}`;
    onLiveStats({ processedNames: i, totalNames: validRows.length, currentName });
    const { processed, failures } = await upsertEmployeeArabicRows([item.row]);
    if (processed > 0) successfulRows++;
    if (failures.length > 0) {
      processingErrors.push({
        rowIndex: item.rowIndex,
        issue: failures[0]?.error || 'تعذر حفظ السطر',
      });
    }
    const progress = 25 + Math.round(((i + 1) / totalToProcess) * 70);
    onProgress(Math.min(progress, 95));
    onLiveStats({ processedNames: i + 1, totalNames: validRows.length, currentName });
  }

  const report: UploadReport = {
    totalProcessed: rows.length,
    successfulRows,
    failedRows: rows.length - successfulRows,
    errors: [...validationErrors, ...processingErrors],
  };

  return { report, headerWarnings: headerErrors.length };
};

// ─── Column definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'seq',                      label: 'م',                       sortable: false },
  { key: 'employee_code',            label: 'الكود',                   sortable: true  },
  { key: 'name',                     label: 'اسم الموظف',              sortable: true  },
  { key: 'name_en',                  label: 'الاسم (إنجليزي)',         sortable: true  },
  { key: 'national_id',              label: 'رقم الهوية',              sortable: true  },
  { key: 'job_title',                label: 'المسمى الوظيفي',          sortable: true  },
  { key: 'city',                     label: 'المدينة',                 sortable: true  },
  { key: 'phone',                    label: 'رقم الهاتف',              sortable: true  },
  { key: 'nationality',              label: 'الجنسية',                 sortable: true  },
  { key: 'status',                   label: 'الحالة',                  sortable: true  },
  { key: 'sponsorship_status',       label: 'حالة الكفالة',            sortable: true  },
  { key: 'join_date',                label: 'تاريخ الانضمام',          sortable: true  },
  { key: 'birth_date',               label: 'تاريخ الميلاد',           sortable: true  },
  { key: 'probation_end_date',       label: 'انتهاء فترة التجربة',     sortable: true  },
  { key: 'residency_expiry',         label: 'انتهاء الإقامة',          sortable: true  },
  { key: 'days_residency',           label: 'المتبقي (يوم)',           sortable: true  },
  { key: 'residency_status',         label: 'حالة الإقامة',            sortable: false },
  { key: 'health_insurance_expiry',  label: 'انتهاء التأمين الصحي',   sortable: true  },
  { key: 'license_status',           label: 'حالة الرخصة',             sortable: true  },
  { key: 'license_expiry',           label: 'انتهاء الرخصة',           sortable: true  },
  { key: 'bank_account_number',      label: 'رقم الحساب البنكي',      sortable: false },
  { key: 'iban',                     label: 'IBAN',                    sortable: false },
  { key: 'email',                    label: 'البريد الإلكتروني',       sortable: false },
  { key: 'actions',                  label: 'الإجراءات',               sortable: false },
] as const;

type ColKey = typeof ALL_COLUMNS[number]['key'];

// Columns hidden by default (available in column picker, but not shown initially)
const DEFAULT_HIDDEN_COLS = new Set<ColKey>(['name_en', 'iban', 'license_expiry']);
const GRID_SKELETON_IDS = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
const FAST_SKELETON_IDS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcResidency = (expiry?: string | null) => {
  if (!expiry) return { days: null as number | null, status: 'unknown' as const };
  const days = differenceInDays(parseISO(expiry), new Date());
  const status = days >= 0 ? 'valid' : 'expired';
  return { days, status };
};
const CITY_LABELS: Record<string, string> = { makkah: 'مكة', jeddah: 'جدة' };
const STATUS_LABELS: Record<string, string> = { active: 'نشط', inactive: 'غير نشط', ended: 'منتهي' };
const SPONSORSHIP_LABELS: Record<string, string> = {
  sponsored: 'على الكفالة',
  not_sponsored: 'ليس على الكفالة',
  absconded: 'هروب',
  terminated: 'انتهاء الخدمة',
};
const LICENSE_LABELS: Record<string, string> = {
  has_license: 'لديه رخصة',
  no_license: 'ليس لديه رخصة',
  applied: 'تم التقديم',
};
const toCityLabel = (city?: string | null, fallback = '—') => CITY_LABELS[city || ''] || fallback;

const dayColorByThreshold = (days: number | null): string => {
  if (days === null) return '';
  if (days < 0) return 'text-destructive font-bold';
  if (days <= 30) return 'text-warning font-medium';
  if (days <= 60) return 'text-amber-500';
  return 'text-success';
};
const residencyStatusLabel = (status: 'valid' | 'expired' | 'unknown'): string => {
  if (status === 'valid') return 'صالحة';
  if (status === 'expired') return 'منتهية';
  return '';
};

const probationColor = (days: number): string => {
  if (days < 0) return 'text-muted-foreground';
  if (days <= 7) return 'text-destructive';
  if (days <= 30) return 'text-warning';
  return 'text-success';
};

// (Badges / InlineSelect / Avatar / SortIcon / FilterPopover / SkeletonRow extracted to EmployeesViewParts)

// ─── Main Component ───────────────────────────────────────────────────────────
const Employees = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { permissions } = usePermissions('employees');
  const [data, setData]       = useState<Employee[]>([]);
  const [viewMode, setViewMode] = useState<'detailed' | 'fast'>('detailed');
  const {
    employees: employeesData,
    isLoading: loading,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployeesData();
  const [sortField, setSortField] = useState<string | null>('name');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');

  // visible columns
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.map(c => c.key).filter(k => !DEFAULT_HIDDEN_COLS.has(k)))
  );

  // per-column filters
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // fast list state (server-side)
  const [fastPage, setFastPage] = useState(1);
  const [fastPageSize] = useState(50);
  const [fastFilters, setFastFilters] = useState(() => createDefaultGlobalFilters());
  const [fastStatus, setFastStatus] = useState<EmployeeStatusFilter>('active');

  // modals
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editEmployee, setEditEmployee]     = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncSystemAfterEmployeeImport = useCallback(async () => {
    const shouldRefresh = (value: string) =>
      value.includes('employee')
      || value.includes('dashboard')
      || value.includes('order')
      || value.includes('attendance')
      || value.includes('advance')
      || value.includes('salary')
      || value.includes('fuel')
      || value.includes('vehicle')
      || value.includes('platform')
      || value.includes('alert')
      || value.includes('tier')
      || value.includes('app');

    const predicate = (query: { queryKey: readonly unknown[] }) => {
      const keyText = query.queryKey.map((part) => String(part).toLowerCase()).join(' ');
      return shouldRefresh(keyText);
    };

    await queryClient.invalidateQueries({ predicate });
    await queryClient.refetchQueries({ predicate, type: 'active' });
  }, [queryClient]);
  const [uploadReport, setUploadReport] = useState<UploadReport | null>(null);
  const [uploadLiveStats, setUploadLiveStats] = useState<UploadLiveStats>({
    processedNames: 0,
    totalNames: 0,
    currentName: '',
  });

  // Status-date dialog (absconded / terminated)
  const [statusDateDialog, setStatusDateDialog] = useState<{
    emp: Employee;
    newStatus: string;
    label: string;
  } | null>(null);
  const [statusDate, setStatusDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusDateSaving, setStatusDateSaving] = useState(false);

  useEffect(() => {
    const rows = (employeesData as Employee[]) ?? [];
    setData(rows);
  }, [employeesData]);

  useEffect(() => {
    if (!employeesError) return;
    const message =
      employeesError instanceof Error
        ? employeesError.message
        : 'حدث خطأ غير متوقع أثناء تحميل الموظفين';
    toast({ title: 'خطأ في تحميل البيانات', description: message, variant: 'destructive' });
  }, [employeesError, toast]);

  // إعادة جلب البيانات فقط بعد إخفاء الصفحة فترة (أونلاين) — بدون إعادة تحميل عند كل focus لتفادي الوميض والتعارض
  useEffect(() => {
    let hiddenAt: number | null = null;
    const minAwayMs = 90_000;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible' || hiddenAt === null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= minAwayMs) void refetchEmployees();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refetchEmployees]);

  // Reset page when filters/sort change
  useEffect(() => { setPage(1); }, [colFilters, sortField, sortDir]);

  useEffect(() => {
    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
    };
  }, []);

  // ── Sort handler ──
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Inline save ──
  const saveField = useCallback(async (id: string, field: string, value: string, extraFields?: Record<string, unknown>) => {
    const prev = data.find(e => e.id === id);
    const updatePatch = { [field]: value, ...(extraFields ?? undefined) };
    setData(d => d.map(e => e.id === id ? { ...e, ...updatePatch } : e));
    try {
      await driverService.update(id, updatePatch);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر حفظ التعديل';
      setData(d => d.map(e => e.id === id ? { ...e, [field]: prev ? getEmployeeFieldValue(prev, field) : undefined } : e));
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    }
  }, [data, toast]);

  // ── Save status that requires a date ──
  const handleSaveStatusWithDate = async () => {
    if (!statusDateDialog) return;
    setStatusDateSaving(true);
    const extraFields =
      statusDateDialog.newStatus === 'absconded' || statusDateDialog.newStatus === 'terminated'
        ? { probation_end_date: statusDate }
        : undefined;
    await saveField(
      statusDateDialog.emp.id,
      'sponsorship_status',
      statusDateDialog.newStatus,
      extraFields,
    );
    toast({
      title: `✅ تم تحديث الحالة إلى "${statusDateDialog.label}"`,
      description: `التاريخ: ${statusDate}`,
    });
    setStatusDateSaving(false);
    setStatusDateDialog(null);
  };

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!deleteEmployee) return;
    setDeleting(true);
    try {
      await driverService.delete(deleteEmployee.id);
      setData(d => d.filter(e => e.id !== deleteEmployee.id));
      toast({ title: 'تم الحذف', description: deleteEmployee.name });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'تعذر حذف المندوب';
      toast({ title: 'خطأ في الحذف', description: message, variant: 'destructive' });
    }
    setDeleting(false);
    setDeleteEmployee(null);
  }, [deleteEmployee, toast]);

  // ── setColFilter helper ──
  const setColFilter = (key: string, value: string) => {
    setColFilters(prev => {
      const next = { ...prev };
      if (!value || value === 'all') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // ── unique values for select filters ──
  const uniqueVals = useMemo(() => ({
    city:               [...new Set(data.map(e => e.city).filter(Boolean))] as string[],
    nationality:        [...new Set(data.map(e => e.nationality).filter(Boolean))] as string[],
    sponsorship_status: ['sponsored', 'not_sponsored', 'absconded', 'terminated'],
    license_status:     ['has_license', 'no_license', 'applied'],
    job_title:          [...new Set(data.map(e => e.job_title).filter(Boolean))] as string[],
    status:             ['active', 'inactive', 'ended'],
  }), [data]);

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    const filteredRows = applyEmployeeFilters(data, colFilters);
    return sortEmployees(filteredRows, sortField, sortDir);
  }, [data, colFilters, sortField, sortDir]);
  const employeeStats = useMemo(() => {
    const active = filtered.filter((emp) => emp.status === 'active').length;
    const inactive = filtered.filter((emp) => emp.status === 'inactive').length;
    const ended = filtered.filter((emp) => emp.status === 'ended').length;
    return { active, inactive, ended };
  }, [filtered]);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  // ── Export ──
  const handleExport = () => {
    const rows = filtered.map((e) => ({
      employee_code: e.employee_code || '',
      name: e.name || '',
      name_en: e.name_en || '',
      national_id: e.national_id || '',
      phone: e.phone || '',
      email: e.email || '',
      city: e.city || '',
      nationality: e.nationality || '',
      job_title: e.job_title || '',
      join_date: e.join_date || '',
      birth_date: e.birth_date || '',
      probation_end_date: e.probation_end_date || '',
      residency_expiry: e.residency_expiry || '',
      health_insurance_expiry: e.health_insurance_expiry || '',
      license_expiry: e.license_expiry || '',
      license_status: e.license_status || '',
      sponsorship_status: e.sponsorship_status || '',
      bank_account_number: e.bank_account_number || '',
      iban: e.iban || '',
      salary_type: e.salary_type || 'shift',
      status: e.status || 'active',
    }));
    const headerRow = EMPLOYEE_IMPORT_COLUMNS.map((column) => column.label);
    const aoaRows = rows.map((row) => EMPLOYEE_IMPORT_COLUMNS.map((column) => row[column.key]));
    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...aoaRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات الموظفين');
    XLSX.writeFile(wb, `بيانات_المناديب_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleFastExport = async () => {
    const branch = parseBranchFilter(fastFilters.branch);
    const search = fastFilters.search?.trim() || undefined;
    const isAllStatus = fastStatus === 'all';
    const status = isAllStatus ? undefined : fastStatus;

    let out: Array<{
      name: string;
      employee_code: string | null;
      national_id: string | null;
      phone: string | null;
      city: string | null;
      status: string;
      sponsorship_status: string | null;
      license_status: string | null;
      residency_expiry: string | null;
      join_date: string | null;
      job_title: string | null;
    }>;
    try {
      out = (await employeeService.exportEmployees({ filters: { branch, search, status } })) as typeof out;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر التصدير';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
      return;
    }

    const rows = out.map((e, i) => ({
      '#': i + 1,
      'الكود': e.employee_code ?? '',
      'الاسم': e.name ?? '',
      'رقم الهوية': e.national_id ?? '',
      'رقم الهاتف': e.phone ?? '',
      'المدينة': e.city ?? '',
      'الحالة': e.status ?? '',
      'حالة الكفالة': e.sponsorship_status ?? '',
      'حالة الرخصة': e.license_status ?? '',
      'انتهاء الإقامة': e.residency_expiry ?? '',
      'تاريخ الانضمام': e.join_date ?? '',
      'المسمى الوظيفي': e.job_title ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, `employees_fast_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    await auditService.logAdminAction({
      action: 'employees.export',
      table_name: 'employees',
      record_id: null,
      meta: { total: out.length, branch: branch ?? null, status: status ?? null, search: search ?? null },
    });
    toast({ title: `Success: ${out.length} rows processed` });
  };

  const handleTemplate = () => {
    const headers = [Array.from(EMPLOYEE_TEMPLATE_AR_HEADERS)];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القالب');
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  // ── Print table ──
  const tableRef = useRef<HTMLTableElement>(null);
  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    printHtmlTable(table, {
      title: 'بيانات الموظفين',
      subtitle: `المجموع: ${filtered.length} موظف — ${new Date().toLocaleDateString('ar-SA')}`,
    });
  };

  const runExportDetailed = async () => {
    setActionLoading(true);
    try {
      handleExport();
      toast({ title: `Success: ${filtered.length} rows processed` });
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error: Invalid file format',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const runTemplateDownload = async () => {
    setActionLoading(true);
    try {
      handleTemplate();
      toast({ title: 'Success: template downloaded' });
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Export failed',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const runPrintDetailed = async () => {
    setActionLoading(true);
    try {
      handlePrint();
    } finally {
      setActionLoading(false);
    }
  };

  const runImportFile = async (file: File) => {
    if (!permissions.can_edit) {
      toast({
        title: 'غير مسموح',
        description: 'لا تملك صلاحية استيراد بيانات الموظفين',
        variant: 'destructive',
      });
      return;
    }
    setActionLoading(true);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadReport(null);
    setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    try {
      const buf = await file.arrayBuffer();
      const { report, headerWarnings } = await processBulkImportRows(buf, setUploadProgress, setUploadLiveStats);
      setUploadReport(report);
      if (report.totalProcessed === 0) {
        const firstIssue = report.errors[0]?.issue;
        toast({
          title: 'تعذر المعالجة',
          description: firstIssue || 'الملف لا يحتوي على بيانات صالحة',
          variant: 'destructive',
        });
        setIsUploading(false);
        setUploadProgress(0);
        setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
        return;
      }
      await refetchEmployees();
      if (report.successfulRows > 0) {
        await syncSystemAfterEmployeeImport();
      }
      await auditService.logAdminAction({
        action: 'employees.import_arabic_template',
        table_name: 'employees',
        record_id: null,
        meta: { processed: report.successfulRows, failed: report.failedRows, headerWarnings },
      });
      const hasFailures = report.failedRows > 0;
      if (report.successfulRows === 0) {
        const topIssues = report.errors.slice(0, 3).map((error) => `سطر ${error.rowIndex}: ${error.issue}`);
        toast({
          title: 'فشل الاستيراد',
          description: topIssues.join(' • ') || 'تعذر استيراد أي سطر من الملف',
          variant: 'destructive',
        });
      } else {
        toast({
          title: hasFailures ? 'اكتملت المعالجة مع أخطاء' : 'اكتملت المعالجة بنجاح',
          description: hasFailures
            ? `تمت معالجة ${report.totalProcessed} سطر، نجح ${report.successfulRows} وفشل ${report.failedRows}`
            : `تمت معالجة ${report.totalProcessed} سطر بنجاح`,
          variant: hasFailures ? 'destructive' : undefined,
        });
      }
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
      }, 900);
    } catch (e: unknown) {
      toast({
        title: 'تعذر معالجة الملف',
        description: e instanceof Error ? e.message : 'حدث خطأ أثناء معالجة الملف',
        variant: 'destructive',
      });
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(0);
      setUploadLiveStats({ processedNames: 0, totalNames: 0, currentName: '' });
    } finally {
      setActionLoading(false);
    }
  };

  const runFastExportWrapped = async () => {
    setActionLoading(true);
    try {
      await handleFastExport();
    } finally {
      setActionLoading(false);
    }
  };

  // ── active cols (ordered) ──
  const activeCols = ALL_COLUMNS.filter(c => visibleCols.has(c.key));
  const hasActiveFilters = Object.keys(colFilters).length > 0;
  const isTableLoading = loading;
  const hasNoPaginatedRows = paginated.length === 0;
  let floatingUploadBody: React.ReactNode = null;
  if (isUploading) {
    floatingUploadBody = (
      <>
        <div className="text-xs text-muted-foreground">
          تمت معالجة الأسماء: <span className="font-semibold text-foreground">{uploadLiveStats.processedNames}</span> / {uploadLiveStats.totalNames}
        </div>
        {uploadLiveStats.currentName && (
          <div className="text-xs text-muted-foreground truncate">
            الآن: <span className="text-foreground font-medium">{uploadLiveStats.currentName}</span>
          </div>
        )}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
        </div>
        <div className="text-xs font-semibold text-foreground text-end">{uploadProgress}%</div>
      </>
    );
  } else if (uploadReport) {
    floatingUploadBody = (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded bg-muted/40 px-2 py-1 text-center">المعالجة: {uploadReport.totalProcessed}</div>
          <div className="rounded bg-emerald-50 text-emerald-700 px-2 py-1 text-center">نجاح: {uploadReport.successfulRows}</div>
          <div className="rounded bg-rose-50 text-rose-700 px-2 py-1 text-center">فشل: {uploadReport.failedRows}</div>
        </div>
        {uploadReport.errors.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded border border-rose-200 bg-rose-50/40 p-2 space-y-1">
            {uploadReport.errors.map((error, idx) => (
              <div key={`${error.rowIndex}-floating-${idx}`} className="text-rose-700">
                السطر {error.rowIndex}: {error.issue}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── profile view ──
  if (selectedEmployee) {
    const emp = (employeesData as Employee[]).find(e => e.id === selectedEmployee) ?? data.find(e => e.id === selectedEmployee);
    if (emp) {
      const isVisibleInMonth = isEmployeeVisibleInMonth(emp, activeEmployeeIdsInMonth);
      if (isVisibleInMonth) {
        return (
          <EmployeeProfile
            employee={emp as EmployeeProfileProps['employee']}
            onBack={() => setSelectedEmployee(null)}
          />
        );
      }
      setSelectedEmployee(null);
    }
  }

  if (viewMode === 'fast') {
    return (
      <EmployeesFastListView
        loadingMain={loading}
        onBackToDetailed={() => setViewMode('detailed')}
        branch={fastFilters.branch}
        search={fastFilters.search}
        status={fastStatus}
        onStatusChange={setFastStatus}
        onFiltersChange={(next) => {
          setFastFilters(next);
          setFastPage(1);
        }}
        page={fastPage}
        onPageChange={setFastPage}
        pageSize={fastPageSize}
        onExport={runFastExportWrapped}
        onDownloadTemplate={runTemplateDownload}
        onImportFile={runImportFile}
        actionLoading={actionLoading}
        canEdit={permissions.can_edit}
        toCityLabel={toCityLabel}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الموارد البشرية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">الموظفين</span>
          </nav>
          <h1 className="page-title">الموظفين</h1>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-1 w-full lg:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <DataTableActions
              loading={actionLoading}
              onExport={runExportDetailed}
              onDownloadTemplate={runTemplateDownload}
              onPrint={runPrintDetailed}
              onImportFile={runImportFile}
              hideImport={!permissions.can_edit}
              className="!w-auto !justify-start"
            />

            {/* Hide/show columns */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <Columns size={14} /> الأعمدة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>إظهار / إخفاء الأعمدة</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_COLUMNS.filter(c => c.key !== 'seq' && c.key !== 'actions').map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols.has(col.key)}
                    onCheckedChange={checked => {
                      setVisibleCols(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(col.key); else next.delete(col.key);
                        return next;
                      });
                    }}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => setViewMode('fast')}>
              <Columns size={14} /> قائمة (سريعة)
            </Button>
          </div>

          {permissions.can_edit && (
            <Button onClick={() => { setEditEmployee(null); setShowAddModal(true); }} className="gap-2 h-9">
              <Plus size={15} /> إضافة موظف
            </Button>
          )}
        </div>
      </div>

      {(isUploading || uploadReport) && (
        <div className="fixed bottom-4 left-4 z-50 w-[min(92vw,420px)] rounded-xl border border-border/70 bg-card shadow-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">حالة رفع القالب</p>
            {uploadReport && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setUploadReport(null)}
              >
                إغلاق
              </Button>
            )}
          </div>
          {floatingUploadBody}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-sm">إجمالي النتائج: <span className="font-bold">{filtered.length}</span></div>
        <div className="rounded-lg border bg-card p-3 text-sm">نشط: <span className="font-bold">{employeeStats.active}</span></div>
        <div className="rounded-lg border bg-card p-3 text-sm">غير نشط: <span className="font-bold">{employeeStats.inactive}</span></div>
        <div className="rounded-lg border bg-card p-3 text-sm">منتهي: <span className="font-bold">{employeeStats.ended}</span></div>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter size={12} /> الفلاتر النشطة:</span>
          {Object.entries(colFilters).map(([key, val]) => {
            const colLabel = ALL_COLUMNS.find(c => c.key === key)?.label || key;
            return (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {colLabel}: {val}
                <button onClick={() => setColFilter(key, '')} className="hover:text-destructive"><X size={10} /></button>
              </span>
            );
          })}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setColFilters({})}>
            مسح الكل
          </Button>
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filtered.length} نتيجة من أصل {data.length}</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full" ref={tableRef}>
            <thead>
              <tr className="ta-thead">
                {activeCols.map(col => {
                  const isFilterable = !['seq', 'actions', 'residency_status', 'days_residency', 'residency_expiry',
                    'join_date', 'birth_date', 'bank_account_number', 'probation_end_date', 'iban', 'license_expiry',
                    'name_en', 'health_insurance_expiry'].includes(col.key);
                  const isActive = !!colFilters[col.key];

                  const filterContent = (() => {
                    if (!isFilterable) return null;
                    if (col.key === 'city') return (
                      <Select value={colFilters.city || 'all'} onValueChange={v => setColFilter('city', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="makkah">مكة</SelectItem>
                          <SelectItem value="jeddah">جدة</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'sponsorship_status') return (
                      <Select value={colFilters.sponsorship_status || 'all'} onValueChange={v => setColFilter('sponsorship_status', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="sponsored">على الكفالة</SelectItem>
                          <SelectItem value="not_sponsored">ليس على الكفالة</SelectItem>
                          <SelectItem value="absconded">هروب</SelectItem>
                          <SelectItem value="terminated">انتهاء الخدمة</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'license_status') return (
                      <Select value={colFilters.license_status || 'all'} onValueChange={v => setColFilter('license_status', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="has_license">لديه رخصة</SelectItem>
                          <SelectItem value="no_license">ليس لديه رخصة</SelectItem>
                          <SelectItem value="applied">تم التقديم</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'nationality') return (
                      <Select value={colFilters.nationality || 'all'} onValueChange={v => setColFilter('nationality', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {uniqueVals.nationality.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'job_title') return (
                      <Select value={colFilters.job_title || 'all'} onValueChange={v => setColFilter('job_title', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {uniqueVals.job_title.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'status') return (
                      <Select value={colFilters.status || 'all'} onValueChange={v => setColFilter('status', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="inactive">غير نشط</SelectItem>
                          <SelectItem value="ended">منتهي</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    return (
                      <TextFilterInput
                        value={colFilters[col.key] || ''}
                        onChange={(v) => setColFilter(col.key, v)}
                      />
                    );
                  })();

                  return (
                    <th
                      key={col.key}
                      className={`ta-th select-none whitespace-nowrap ${col.key === 'seq' ? 'w-10 px-2 text-center' : ''} ${col.sortable ? 'cursor-pointer hover:text-foreground' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                        {isFilterable && filterContent && (
                          <ColFilterPopover
                            colKey={col.key}
                            label={col.label}
                            active={isActive}
                            onClear={() => setColFilter(col.key, '')}
                          >
                            {filterContent}
                          </ColFilterPopover>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {isTableLoading && (
                GRID_SKELETON_IDS.map((id) => <SkeletonRow key={`employees-grid-skeleton-${id}`} cols={activeCols.length} />)
              )}
              {!isTableLoading && hasNoPaginatedRows && (
                <tr>
                  <td colSpan={activeCols.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <span className="text-4xl">👥</span>
                      <p className="font-medium">لا توجد نتائج</p>
                      <p className="text-xs">جرّب تغيير الفلاتر أو إضافة موظف جديد</p>
                    </div>
                  </td>
                </tr>
              )}
              {!isTableLoading && !hasNoPaginatedRows && paginated.map((emp, idx) => {
                const res     = calcResidency(emp.residency_expiry);
                const daysColor = dayColorByThreshold(res.days);
                const globalIdx = (page - 1) * pageSize + idx + 1;
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    {activeCols.map(col => { // NOSONAR
                      switch (col.key) {
                        case 'seq':
                          return <td key="seq" className="px-2 py-2 text-[11px] text-muted-foreground text-center tabular-nums">{globalIdx}</td>;

                        case 'name':
                          return (
                            <td key="name" className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                <EmployeeAvatar path={emp.personal_photo_url} name={emp.name} />
                                <button onClick={() => setSelectedEmployee(emp.id)} className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-start">
                                  {emp.name}
                                </button>
                              </div>
                            </td>
                          );

                        case 'name_en':
                          return <td key="name_en" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap" dir="ltr">{emp.name_en || '—'}</td>;

                        case 'employee_code':
                          return <td key="employee_code" className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap">{emp.employee_code || '—'}</td>;

                        case 'national_id':
                          return <td key="national_id" className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{emp.national_id || '—'}</td>;

                        case 'job_title':
                          return <td key="job_title" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.job_title || '—'}</td>;

                        case 'city':
                          return (
                            <td key="city" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.city || ''}
                                options={[{ value: 'makkah', label: 'مكة' }, { value: 'jeddah', label: 'جدة' }]}
                                onSave={v => saveField(emp.id, 'city', v)}
                                renderDisplay={() => <CityBadge city={emp.city} />}
                              />
                            </td>
                          );

                        case 'phone':
                          return <td key="phone" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap" dir="ltr">{emp.phone || '—'}</td>;

                        case 'nationality':
                          return <td key="nationality" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.nationality || '—'}</td>;

                        case 'status':
                          return (
                            <td key="status" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.status || 'active'}
                                options={[
                                  { value: 'active',   label: 'نشط'      },
                                  { value: 'inactive', label: 'غير نشط'  },
                                  { value: 'ended',    label: 'منتهي'     },
                                ]}
                                onSave={v => saveField(emp.id, 'status', v)}
                                renderDisplay={() => <StatusBadge status={emp.status} />}
                              />
                            </td>
                          );

                        case 'sponsorship_status':
                          return (
                            <td key="sponsorship_status" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.sponsorship_status || 'not_sponsored'}
                                options={[
                                  { value: 'sponsored',     label: 'على الكفالة'      },
                                  { value: 'not_sponsored', label: 'ليس على الكفالة'  },
                                  { value: 'absconded',     label: 'هروب'             },
                                  { value: 'terminated',    label: 'انتهاء الخدمة'    },
                                ]}
                                onSave={v => {
                                  if (v === 'absconded' || v === 'terminated') {
                                    setStatusDate(format(new Date(), 'yyyy-MM-dd'));
                                    setStatusDateDialog({
                                      emp,
                                      newStatus: v,
                                      label: v === 'absconded' ? 'هروب' : 'انتهاء الخدمة',
                                    });
                                    return Promise.resolve();
                                  }
                                  return saveField(emp.id, 'sponsorship_status', v);
                                }}
                                renderDisplay={() => <SponsorBadge status={emp.sponsorship_status} />}
                              />
                            </td>
                          );

                        case 'join_date':
                          return <td key="join_date" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.join_date ? format(parseISO(emp.join_date), 'yyyy/MM/dd') : '—'}</td>;

                        case 'birth_date':
                          return <td key="birth_date" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.birth_date ? format(parseISO(emp.birth_date), 'yyyy/MM/dd') : '—'}</td>;

                        case 'probation_end_date': {
                          const probDays = emp.probation_end_date ? differenceInDays(parseISO(emp.probation_end_date), new Date()) : null;
                          return (
                            <td key="probation_end_date" className="px-3 py-2.5 whitespace-nowrap">
                              {emp.probation_end_date ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">{format(parseISO(emp.probation_end_date), 'yyyy/MM/dd')}</span>
                                  {probDays !== null && (
                                    <span className={`text-xs font-medium ${probationColor(probDays)}`}>
                                      {probDays < 0 ? 'انتهت' : `${probDays}ي متبقي`}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        }

                        case 'residency_expiry':
                          return <td key="residency_expiry" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.residency_expiry ? format(parseISO(emp.residency_expiry), 'yyyy/MM/dd') : '—'}</td>;

                        case 'days_residency':
                          return <td key="days_residency" className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap text-center ${daysColor}`}>{res.days ?? '—'}</td>;

                        case 'residency_status':
                          return (
                            <td key="residency_status" className="px-3 py-2.5 whitespace-nowrap">
                              {res.status === 'valid' && <span className="badge-success">صالحة</span>}
                              {res.status === 'expired' && <span className="badge-urgent">منتهية</span>}
                              {res.status !== 'valid' && res.status !== 'expired' && <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );

                        case 'health_insurance_expiry': {
                          const hiExpiry = emp.health_insurance_expiry;
                          const hiDays   = hiExpiry ? differenceInDays(parseISO(hiExpiry), new Date()) : null;
                          const hiColor = dayColorByThreshold(hiDays);
                          return (
                            <td key="health_insurance_expiry" className="px-3 py-2.5 whitespace-nowrap">
                              {hiExpiry ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={`text-xs ${hiColor}`}>{format(parseISO(hiExpiry), 'yyyy/MM/dd')}</span>
                                  {hiDays !== null && (
                                    <span className={`text-[10px] ${hiColor}`}>
                                      {hiDays < 0 ? `منتهي منذ ${Math.abs(hiDays)} يوم` : `متبقي ${hiDays} يوم`}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        }

                        case 'license_status':
                          return (
                            <td key="license_status" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.license_status || 'no_license'}
                                options={[
                                  { value: 'has_license', label: 'لديه رخصة'     },
                                  { value: 'no_license',  label: 'ليس لديه رخصة' },
                                  { value: 'applied',     label: 'تم التقديم'    },
                                ]}
                                onSave={v => saveField(emp.id, 'license_status', v)}
                                renderDisplay={() => <LicenseBadge status={emp.license_status} />}
                              />
                            </td>
                          );

                        case 'license_expiry': {
                          const leExpiry = emp.license_expiry;
                          const leDays   = leExpiry ? differenceInDays(parseISO(leExpiry), new Date()) : null;
                          const leColor = dayColorByThreshold(leDays);
                          return (
                            <td key="license_expiry" className="px-3 py-2.5 whitespace-nowrap">
                              {leExpiry ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={`text-xs ${leColor}`}>{format(parseISO(leExpiry), 'yyyy/MM/dd')}</span>
                                  {leDays !== null && (
                                    <span className={`text-[10px] ${leColor}`}>
                                      {leDays < 0 ? `منتهية منذ ${Math.abs(leDays)} يوم` : `متبقي ${leDays} يوم`}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        }

                        case 'bank_account_number':
                          return <td key="bank_account_number" className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{emp.bank_account_number || '—'}</td>;

                        case 'iban':
                          return <td key="iban" className="px-3 py-2.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap" dir="ltr">{emp.iban || '—'}</td>;

                        case 'email':
                          return (
                            <td key="email" className="px-3 py-2.5 text-sm whitespace-nowrap" dir="ltr">
                              {emp.email
                                ? <a href={`mailto:${emp.email}`} className="text-primary hover:underline">{emp.email}</a>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                          );

                        case 'actions':
                          return (
                            <td key="actions" className="px-3 py-2.5 whitespace-nowrap">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
                                    ⋮
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedEmployee(emp.id)}>
                                    <Eye size={14} className="me-2" /> عرض الملف
                                  </DropdownMenuItem>
                                  {permissions.can_edit && (
                                    <DropdownMenuItem onClick={() => { setEditEmployee(emp); setShowAddModal(true); }}>
                                      <Edit size={14} className="me-2" /> تعديل البيانات
                                    </DropdownMenuItem>
                                  )}
                                  {permissions.can_delete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteEmployee(emp)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 size={14} className="me-2" /> حذف الموظف
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          );

                        default:
                          return <td key={col.key} className="px-3 py-2.5">—</td>;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination bar ── */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-border/30 flex-wrap">
            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">عرض:</span>
              <Select
                value={String(pageSize)}
                onValueChange={v => { setPageSize(Number(v)); setPage(1); }}
              >
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">لكل صفحة</span>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {Math.min((page - 1) * pageSize + 1, filtered.length)}–{Math.min(page * pageSize, filtered.length)} من {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(1)} disabled={page === 1}>
                  «
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                  <ChevronRight size={12} />
                </Button>
                <span className="text-xs text-muted-foreground px-2 min-w-[70px] text-center">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                  <ChevronLeft size={12} />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                  »
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <EmployeeFormModal
        open={showAddModal}
        editEmployee={editEmployee}
        onClose={() => { setShowAddModal(false); setEditEmployee(null); }}
        onSuccess={() => { void refetchEmployees(); setShowAddModal(false); setEditEmployee(null); }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteEmployee} onOpenChange={open => !open && setDeleteEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الموظف <span className="font-semibold text-foreground">{deleteEmployee?.name}</span>؟
              {' '}لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="animate-spin me-1" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status-Date Dialog (absconded / terminated) */}
      <Dialog open={!!statusDateDialog} onOpenChange={open => !open && setStatusDateDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays size={16} className="text-destructive" />
              تحديد تاريخ — {statusDateDialog?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              أدخل تاريخ <strong>{statusDateDialog?.label}</strong> للمندوب{' '}
              <strong className="text-foreground">{statusDateDialog?.emp.name}</strong>
            </p>
            <div>
              <Label className="mb-1.5 block">
                {statusDateDialog?.newStatus === 'absconded' ? 'تاريخ الهروب' : 'تاريخ انتهاء الخدمة'}
              </Label>
              <Input
                type="date"
                value={statusDate}
                onChange={e => setStatusDate(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStatusDateDialog(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={handleSaveStatusWithDate}
              disabled={!statusDate || statusDateSaving}
            >
              {statusDateSaving && <Loader2 size={14} className="animate-spin ml-1" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
