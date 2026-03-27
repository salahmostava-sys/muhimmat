import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Search, Save, Package, FolderOpen, Loader2, Target, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Input } from '@shared/components/ui/input';
import { Progress } from '@shared/components/ui/progress';
import { orderService } from '@services/orderService';
import { useToast } from '@shared/hooks/use-toast';
import { useAppColors, getAppColor } from '@shared/hooks/useAppColors';
import { usePermissions } from '@shared/hooks/usePermissions';
import { OrdersGridTable } from '@shared/components/orders/OrdersGridTable';
import { OrdersCellPopover, type OrdersPopoverState } from '@shared/components/orders/OrdersCellPopover';
import { OrdersMonthNavigator } from '@shared/components/orders/OrdersMonthNavigator';
import { OrdersSummaryTable } from '@shared/components/orders/OrdersSummaryTable';
import { cn } from '@shared/lib/utils';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import { GlobalTableFilters, createDefaultGlobalFilters, type GlobalTableFilterState } from '@shared/components/table/GlobalTableFilters';
import { useOrdersMonthPaged } from '@shared/hooks/useOrdersPaged';
import { toast as sonnerToast } from '@shared/components/ui/sonner';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { buildOrdersIoHeaders } from '@shared/constants/excelSchemas';


// ─── Types ──────────────────────────────────────────────────────────
type Employee = { id: string; name: string; salary_type: string; status: string; sponsorship_status: string | null };
type App = { id: string; name: string; name_en: string | null; logo_url?: string | null };
type DailyData = Record<string, number>;
type AppTargetRow = { app_id: string; target_orders: number };
type EmployeeAppAssignmentRow = { employee_id: string; app_id: string };
type OrderRawRow = { employee_id: string; app_id: string; date: string; orders_count: number };

type OrdersEmployeeSortField = 'name' | 'total' | `app:${string}`;

const ordersQueryKeys = (uid: string) => ({
  spreadsheetBase: ['orders', uid, 'spreadsheet', 'base-data'] as const,
  spreadsheetMonthRaw: (year: number, month: number) => ['orders', uid, 'spreadsheet', 'month-raw', year, month] as const,
  spreadsheetMonthLock: (year: number, month: number) => ['orders', uid, 'spreadsheet', 'month-lock', year, month] as const,
  summaryBase: ['orders', uid, 'summary', 'base-data'] as const,
  summaryTargets: (year: number, month: number) => ['orders', uid, 'summary', 'targets', year, month] as const,
  summaryMonthLock: (year: number, month: number) => ['orders', uid, 'summary', 'month-lock', year, month] as const,
  summaryMonthRaw: (year: number, month: number) => ['orders', uid, 'summary', 'month-raw', year, month] as const,
});

const loadXlsx = () => import('@e965/xlsx');

const buildAppEmployeeIdsMap = (rows: EmployeeAppAssignmentRow[]): Record<string, Set<string>> => {
  const map: Record<string, Set<string>> = {};
  rows.forEach((row) => {
    if (!map[row.app_id]) map[row.app_id] = new Set();
    map[row.app_id].add(row.employee_id);
  });
  return map;
};

const buildDailyDataMap = (rows: OrderRawRow[]): DailyData => {
  const mapped: DailyData = {};
  rows.forEach((row) => {
    const day = new Date(`${row.date}T00:00:00`).getDate();
    mapped[`${row.employee_id}::${row.app_id}::${day}`] = row.orders_count;
  });
  return mapped;
};

const calculatePlatformTotals = (
  apps: App[],
  filteredEmployees: Employee[],
  dayArr: number[],
  data: DailyData
): Record<string, number> => {
  const totals: Record<string, number> = {};
  apps.forEach((app) => {
    totals[app.id] = filteredEmployees.reduce((sum, emp) => {
      const employeeAppTotal = dayArr.reduce((daySum, d) => daySum + (data[`${emp.id}::${app.id}::${d}`] ?? 0), 0);
      return sum + employeeAppTotal;
    }, 0);
  });
  return totals;
};

function getOrdersEmployeeSortPair(
  a: Employee,
  b: Employee,
  sortField: OrdersEmployeeSortField,
  empTotal: (id: string) => number,
  dayArr: number[],
  data: DailyData
): [number | string, number | string] {
  if (sortField === 'name') {
    return [a.name, b.name];
  }
  if (sortField === 'total') {
    return [empTotal(a.id), empTotal(b.id)];
  }
  const appId = sortField.replace('app:', '');
  const aSum = dayArr.reduce((s, d) => s + (data[`${a.id}::${appId}::${d}`] ?? 0), 0);
  const bSum = dayArr.reduce((s, d) => s + (data[`${b.id}::${appId}::${d}`] ?? 0), 0);
  return [aSum, bSum];
}

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
const dateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
};
const monthYear = (y: number, m: number) =>
  `${y}-${String(m).padStart(2, '0')}`;
const isPastMonth = (y: number, m: number) => {
  const now = new Date();
  const currentMonthIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  const selectedMonthIndex = y * 12 + m;
  return selectedMonthIndex < currentMonthIndex;
};

const toCellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const toCityArabic = (city?: string | null, fallback = '') => {
  if (city === 'makkah') return 'مكة';
  if (city === 'jeddah') return 'جدة';
  return fallback;
};

const ORDERS_SKELETON_ROW_KEYS = [
  'orders-skeleton-row-1',
  'orders-skeleton-row-2',
  'orders-skeleton-row-3',
  'orders-skeleton-row-4',
  'orders-skeleton-row-5',
  'orders-skeleton-row-6',
  'orders-skeleton-row-7',
  'orders-skeleton-row-8',
  'orders-skeleton-row-9',
  'orders-skeleton-row-10',
] as const;

const ORDERS_SKELETON_CELL_KEYS = [
  'orders-skeleton-cell-1',
  'orders-skeleton-cell-2',
  'orders-skeleton-cell-3',
  'orders-skeleton-cell-4',
  'orders-skeleton-cell-5',
] as const;

// ─── SpreadsheetGrid ─────────────────────────────────────────────────
const SpreadsheetGrid = React.memo(() => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const qk = ordersQueryKeys(uid);
  const { apps: appColorsList } = useAppColors();
  const { toast } = useToast();
  const { permissions } = usePermissions('orders');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [data, setData] = useState<DailyData>({});
  const [saving, setSaving] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [cellPopover, setCellPopover] = useState<OrdersPopoverState | null>(null);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockingMonth, setLockingMonth] = useState(false);
  const canEditMonth = permissions.can_edit && !isMonthLocked;
  const monthKey = monthYear(year, month);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const {
    data: spreadsheetBaseData,
    error: spreadsheetBaseError,
    isLoading: spreadsheetBaseLoading,
  } = useQuery({
    queryKey: qk.spreadsheetBase,
    enabled,
    queryFn: async () => {
      const [employees, apps, employeeApps] = await Promise.all([
        orderService.getActiveEmployees(),
        orderService.getActiveApps(),
        orderService.getEmployeeAppAssignments(),
      ]);
      return {
        employees: (employees || []) as Employee[],
        apps: (apps || []) as App[],
        employeeApps: (employeeApps || []) as EmployeeAppAssignmentRow[],
      };
    },
    select: (base) => ({
      employees: base.employees,
      apps: base.apps,
      appEmployeeIdsMap: buildAppEmployeeIdsMap(base.employeeApps),
    }),
    retry: defaultQueryRetry,
    // Orders domain policy: semi-fresh
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    data: spreadsheetMonthData = {},
    error: spreadsheetMonthError,
    isLoading: spreadsheetMonthLoading,
  } = useQuery({
    queryKey: qk.spreadsheetMonthRaw(year, month),
    enabled,
    queryFn: async () => {
      const rows = await orderService.getMonthRaw(year, month);
      return (rows || []) as OrderRawRow[];
    },
    select: (rows) => buildDailyDataMap(rows),
    retry: defaultQueryRetry,
    // Orders domain policy: semi-fresh (faster-changing rows)
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: spreadsheetMonthLock = false, error: spreadsheetLockError } = useQuery({
    queryKey: qk.spreadsheetMonthLock(year, month),
    enabled,
    queryFn: async () => {
      const my = monthYear(year, month);
      return orderService.getMonthLockStatus(my);
    },
    select: (res) => res.locked,
    retry: defaultQueryRetry,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const loading = spreadsheetBaseLoading || spreadsheetMonthLoading;

  const apps = useMemo<App[]>(
    () => spreadsheetBaseData?.apps ?? [],
    [spreadsheetBaseData]
  );
  const appEmployeeIds = useMemo(
    () => spreadsheetBaseData?.appEmployeeIdsMap ?? {},
    [spreadsheetBaseData]
  );
  const employees = useMemo<Employee[]>(
    () => filterVisibleEmployeesInMonth(spreadsheetBaseData?.employees ?? [], activeEmployeeIdsInMonth),
    [spreadsheetBaseData, activeEmployeeIdsInMonth]
  );

  useEffect(() => {
    setData(spreadsheetMonthData);
  }, [spreadsheetMonthData]);

  useEffect(() => {
    setIsMonthLocked(spreadsheetMonthLock);
  }, [spreadsheetMonthLock]);

  useEffect(() => {
    const error = spreadsheetBaseError || spreadsheetMonthError || spreadsheetLockError;
    if (!error) return;
    const message = error instanceof Error ? error.message : 'فشل تحميل بيانات الطلبات';
    toast({
      title: 'فشل تحميل بيانات الطلبات',
      description: message,
      variant: 'destructive',
    });
  }, [spreadsheetBaseError, spreadsheetMonthError, spreadsheetLockError, toast]);

  const baseEmployees = useMemo(() => {
    if (platformFilter === 'all') return employees;
    return employees.filter(e => appEmployeeIds[platformFilter]?.has(e.id));
  }, [employees, platformFilter, appEmployeeIds]);

  const filteredEmployees = useMemo(
    () => baseEmployees.filter(emp => emp.name.includes(search)),
    [baseEmployees, search]
  );
  const visibleApps = platformFilter === 'all' ? apps : apps.filter(a => a.id === platformFilter);
  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);
  const today = now.getFullYear() === year && (now.getMonth() + 1) === month ? now.getDate() : -1;

  const getVal = useCallback((empId: string, appId: string, day: number) => data[`${empId}::${appId}::${day}`] ?? 0, [data]);
  const getActiveApps = useCallback((empId: string) => visibleApps.filter(app => dayArr.some(d => getVal(empId, app.id, d) > 0)), [visibleApps, dayArr, getVal]);
  const empDayTotal = useCallback((empId: string, day: number) => visibleApps.reduce((s, a) => s + getVal(empId, a.id, day), 0), [visibleApps, getVal]);
  const empMonthTotal = useCallback((empId: string) => dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0), [dayArr, empDayTotal]);
  const empAppMonthTotal = useCallback((empId: string, appId: string) => dayArr.reduce((s, d) => s + getVal(empId, appId, d), 0), [dayArr, getVal]);

  const monthGrandTotal = useMemo(
    () => filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0),
    [filteredEmployees, empMonthTotal]
  );
  const monthDailyAvg = days > 0 ? Math.round(monthGrandTotal / days) : 0;
  const platformOrderTotals = useMemo(() => {
    return calculatePlatformTotals(apps, filteredEmployees, dayArr, data);
  }, [apps, filteredEmployees, dayArr, data]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const toggleExpand = (empId: string) => {
    setExpandedEmp(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  };

  const handleCellClick = useCallback((e: React.MouseEvent, empId: string, day: number) => {
    if (!canEditMonth) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPopover({ empId, day, x: rect.left, y: rect.bottom });
  }, [canEditMonth]);

  const handlePopoverApply = useCallback((empId: string, day: number, vals: Record<string, number>) => {
    setData(prev => {
      const next = { ...prev };
      Object.entries(vals).forEach(([appId, count]) => {
        const key = `${empId}::${appId}::${day}`;
        if (count > 0) next[key] = count; else delete next[key];
      });
      return next;
    });
  }, []);

  // ── Export ──
  const exportExcel = async () => {
    const XLSX = await loadXlsx();
    const headers = buildOrdersIoHeaders(dayArr);
    const rows = filteredEmployees.map((emp) => {
      const values: Array<string | number> = [emp.name];
      dayArr.forEach((d) => values.push(empDayTotal(emp.id, d) || ''));
      values.push(empMonthTotal(emp.id));
      return values;
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
    XLSX.writeFile(wb, `طلبات_${month}_${year}.xlsx`);
    toast({ title: 'تم التصدير' });
  };

  // ── Import ──
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await loadXlsx();
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
      if (matrix.length < 2) {
        toast({ title: 'الملف فارغ', variant: 'destructive' });
        return;
      }
      const expectedHeaders = buildOrdersIoHeaders(dayArr);
      const actualHeaders = (matrix[0] || []).map((h) => String(h ?? '').trim());
      const headersMatch =
        actualHeaders.length === expectedHeaders.length &&
        actualHeaders.every((h, i) => h === expectedHeaders[i]);
      if (!headersMatch) {
        toast({
          title: 'هيكل الأعمدة غير مطابق للقالب',
          description: 'تأكد من تحميل القالب واستخدامه بدون تعديل ترتيب أو أسماء الأعمدة',
          variant: 'destructive',
        });
        return;
      }
      const rows = matrix.slice(1);
      let imported = 0;
      const newData = { ...data };
      for (const row of rows) {
        const line = Array.isArray(row) ? row : [];
        const empName = toCellText(line[0]);
        const emp = employees.find(employee => employee.name === empName);
        if (!emp) continue;
        for (let idx = 0; idx < dayArr.length; idx++) {
          const d = dayArr[idx];
          const val = Number(line[idx + 1]);
          if (val <= 0) continue;
          for (const app of apps) {
            newData[`${emp.id}::${app.id}::${d}`] = val;
            imported++;
          }
        }
      }
      setData(newData);
      toast({ title: `تم استيراد ${imported} إدخال` });
    } catch (err) {
      console.error('[Orders] import spreadsheet failed', err);
      toast({ title: 'فشل الاستيراد', variant: 'destructive' });
    }
    e.target.value = '';
  };

  // ── Template ──
  const handleTemplate = async () => {
    const XLSX = await loadXlsx();
    const ws = XLSX.utils.aoa_to_sheet([buildOrdersIoHeaders(dayArr)]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب الطلبات');
    XLSX.writeFile(wb, 'template_orders.xlsx');
  };

  // ── Print ──
  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = globalThis.open('', '_blank');
    if (!printWindow) return;
    const doc = printWindow.document;
    const html = doc.documentElement;
    const head = doc.head;
    const body = doc.body;
    if (!html || !head || !body) return;
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'ar');
    head.innerHTML = `
      <meta charset="UTF-8" />
      <title>طلبات ${month}/${year}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:14px}p.sub{text-align:center;color:#666;font-size:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px 6px;text-align:right;font-size:9px;white-space:nowrap}td{padding:4px 6px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    `;
    const title = doc.createElement('h2');
    title.textContent = `طلبات شهر ${month}/${year}`;
    const subtitle = doc.createElement('p');
    subtitle.className = 'sub';
    subtitle.textContent = `المجموع: ${filteredEmployees.length} مندوب — ${new Date().toLocaleDateString('ar-SA')}`;
    body.innerHTML = '';
    body.appendChild(title);
    body.appendChild(subtitle);
    body.appendChild(table.cloneNode(true));
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  // ── Save ──
  const handleSave = async () => {
    if (isMonthLocked) return;
    setSaving(true);
    const rows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];
    Object.entries(data).forEach(([key, count]) => {
      const [empId, appId, dayStr] = key.split('::');
      const day = Number.parseInt(dayStr, 10);
      if (!Number.isNaN(day) && day >= 1 && day <= days)
        rows.push({ employee_id: empId, app_id: appId, date: dateStr(year, month, day), orders_count: count });
    });
    const { saved, failed } = await orderService.bulkUpsert(rows);
    setSaving(false);
    if (failed.length > 0) {
      toast({ title: `فشل في حفظ ${failed.length} إدخال`, description: `تم حفظ ${saved} بنجاح`, variant: 'destructive' });
    } else {
      toast({ title: `✅ تم حفظ ${saved} إدخال بنجاح`, description: `بيانات ${monthLabel(year, month)}` });
    }
  };

  const handleLockMonth = async () => {
    const my = monthYear(year, month);
    if (!isPastMonth(year, month) || isMonthLocked) return;
    setLockingMonth(true);
    try {
      await orderService.lockMonth(my);
    } catch (e: unknown) {
      setLockingMonth(false);
      const message = e instanceof Error ? e.message : 'فشل قفل الشهر';
      toast({ title: 'فشل قفل الشهر', description: message, variant: 'destructive' });
      return;
    }
    setLockingMonth(false);
    setIsMonthLocked(true);
    setCellPopover(null);
    toast({ title: '✅ تم قفل الشهر بنجاح' });
  };

  const seqColMin = 36;
  const repColMin = 132;

  return (
    <div className="flex flex-col gap-2">
      {/* صف واحد: الشهر + البحث + ملخص الشهر + الشهري + إجراءات */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 flex-shrink-0">
        <OrdersMonthNavigator
          compact
          label={monthLabel(year, month)}
          onPrev={prevMonth}
          onNext={nextMonth}
        />

        <div className="relative flex-1 min-w-[160px] max-w-md">
          <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="بحث بالاسم..." className="pr-8 h-8 text-xs" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] shrink-0">
          <span className="whitespace-nowrap">
            <span className="text-muted-foreground">ملخص الشهر:</span>{' '}
            <span className="font-bold tabular-nums text-foreground">{monthGrandTotal.toLocaleString()}</span>
            <span className="text-muted-foreground mr-0.5"> طلب</span>
          </span>
          <span className="hidden sm:inline h-3 w-px bg-border" aria-hidden />
          <span className="whitespace-nowrap">
            <span className="text-muted-foreground">شهري:</span>{' '}
            <span className="font-semibold tabular-nums text-foreground">{monthDailyAvg.toLocaleString()}</span>
            <span className="text-muted-foreground mr-0.5"> /يوم</span>
          </span>
          <span className="h-3 w-px bg-border" aria-hidden />
          <span className="whitespace-nowrap">
            <span className="text-muted-foreground">مناديب:</span>{' '}
            <span className="font-semibold tabular-nums text-foreground">{filteredEmployees.length}</span>
          </span>
          {platformFilter !== 'all' && apps.find(a => a.id === platformFilter) && (
            <>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span className="text-primary font-medium truncate max-w-[7rem]">
                {apps.find(a => a.id === platformFilter)?.name}
              </span>
            </>
          )}
        </div>

        {apps.length > 0 && (
          <>
            <span className="hidden lg:inline text-border mx-0.5 select-none">|</span>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-w-full lg:max-w-[min(100%,42rem)]">
              <span className="text-[10px] text-muted-foreground shrink-0">المنصات:</span>
              <button
                type="button"
                onClick={() => setPlatformFilter('all')}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors leading-tight shrink-0',
                  platformFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                )}
              >
                الكل ({monthGrandTotal.toLocaleString()})
              </button>
              {apps.map(app => {
                const count = platformOrderTotals[app.id] ?? 0;
                const active = platformFilter === app.id;
                const c = getAppColor(appColorsList, app.name);
                return (
                  <button
                    type="button"
                    key={app.id}
                    onClick={() => setPlatformFilter(active ? 'all' : app.id)}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[150px] leading-tight',
                      active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    )}
                    style={active ? { backgroundColor: c.bg, color: c.text, borderColor: c.bg } : undefined}
                    title={app.name}
                  >
                    {app.logo_url && (
                      <img src={app.logo_url} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="" />
                    )}
                    <span className="truncate">{app.name}</span>
                    <span className="shrink-0">({count.toLocaleString()})</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5 mr-auto shrink-0">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs px-2"><FolderOpen size={13} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}>⬆️ استيراد Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && !isMonthLocked && (
            <Button size="sm" className="gap-1 h-8 text-xs px-2.5" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={13} className="animate-spin" /> جاري الحفظ...</> : <><Save size={13} /> حفظ</>}
            </Button>
          )}
          {permissions.can_edit && isPastMonth(year, month) && !isMonthLocked && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8 text-xs px-2 text-warning border-warning/40 hover:bg-warning/10"
              onClick={handleLockMonth}
              disabled={lockingMonth}
            >
              {lockingMonth ? <><Loader2 size={13} className="animate-spin" /> جاري القفل...</> : <>قفل الشهر</>}
            </Button>
          )}
        </div>
      </div>

      <p className="text-[10px] leading-snug text-muted-foreground flex-shrink-0">
        {isMonthLocked
          ? '🔒 هذا الشهر مقفول: كل الخلايا للقراءة فقط'
          : '💡 انقر على خلية اليوم لإدخال الطلبات — السهم بجانب المندوب لعرض تفاصيل المنصات — اختر المنصة من الشريط أعلاه'}
      </p>

      <OrdersGridTable
        loading={loading}
        tableRef={tableRef}
        seqColMin={seqColMin}
        repColMin={repColMin}
        days={days}
        year={year}
        month={month}
        today={today}
        filteredEmployees={filteredEmployees}
        visibleApps={visibleApps}
        appColorsList={appColorsList}
        expandedEmp={expandedEmp}
        cellPopover={cellPopover}
        canEditMonth={canEditMonth}
        dayArr={dayArr}
        getVal={getVal}
        getActiveApps={getActiveApps}
        empDayTotal={empDayTotal}
        empMonthTotal={empMonthTotal}
        empAppMonthTotal={empAppMonthTotal}
        shortName={shortName}
        toggleExpand={toggleExpand}
        handleCellClick={handleCellClick}
      />

      {cellPopover && (
        <OrdersCellPopover
          state={cellPopover} apps={apps} data={data} appColorsList={appColorsList}
          canEdit={canEditMonth} onApply={handlePopoverApply} onClose={() => setCellPopover(null)}
        />
      )}
    </div>
  );
});

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = React.memo(() => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const qk = ordersQueryKeys(uid);
  const { apps: appColorsList } = useAppColors();
  const { toast } = useToast();
  const { permissions } = usePermissions('orders');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [data, setData] = useState<DailyData>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [sortField, setSortField] = useState<OrdersEmployeeSortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const monthKey = monthYear(year, month);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const {
    data: summaryBaseData,
    error: summaryBaseError,
    isLoading: summaryBaseLoading,
  } = useQuery({
    queryKey: qk.summaryBase,
    enabled,
    queryFn: async () => {
      const [employees, apps] = await Promise.all([
        orderService.getActiveEmployees(),
        orderService.getActiveApps(),
      ]);
      return {
        employees: (employees || []) as Employee[],
        apps: (apps || []) as App[],
      };
    },
    select: (base) => ({
      employees: base.employees,
      apps: base.apps,
    }),
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

  const { data: summaryMonthMeta, error: summaryMonthMetaError } = useQuery({
    queryKey: ['orders', uid, 'summary', 'month-meta', year, month] as const,
    enabled,
    queryFn: async () => {
      const my = monthYear(year, month);
      const [targetsRows, lockRes] = await Promise.all([
        orderService.getAppTargets(my),
        orderService.getMonthLockStatus(my),
      ]);
      return {
        targets: (targetsRows || []) as AppTargetRow[],
        locked: lockRes.locked,
      };
    },
    retry: defaultQueryRetry,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    data: summaryMonthData = {},
    error: summaryMonthError,
    isLoading: summaryMonthLoading,
  } = useQuery({
    queryKey: qk.summaryMonthRaw(year, month),
    enabled,
    queryFn: async () => {
      const rows = await orderService.getMonthRaw(year, month);
      return (rows || []) as OrderRawRow[];
    },
    select: (rows) => buildDailyDataMap(rows),
    retry: defaultQueryRetry,
    staleTime: 15_000,
  });

  const loading = summaryBaseLoading || summaryMonthLoading;

  const employees = useMemo<Employee[]>(
    () => filterVisibleEmployeesInMonth(summaryBaseData?.employees ?? [], activeEmployeeIdsInMonth),
    [summaryBaseData, activeEmployeeIdsInMonth]
  );
  const apps = useMemo<App[]>(
    () => summaryBaseData?.apps ?? [],
    [summaryBaseData]
  );

  // Load targets when month changes
  useEffect(() => {
    const t: Record<string, string> = {};
    (summaryMonthMeta?.targets || []).forEach((r) => { t[r.app_id] = String(r.target_orders); });
    setTargets(t);
  }, [summaryMonthMeta?.targets]);

  useEffect(() => {
    setIsMonthLocked(summaryMonthMeta?.locked ?? false);
  }, [summaryMonthMeta?.locked]);

  useEffect(() => {
    setData(summaryMonthData);
  }, [summaryMonthData]);

  useEffect(() => {
    const error = summaryBaseError || summaryMonthMetaError || summaryMonthError;
    if (!error) return;
    const message = error instanceof Error ? error.message : 'فشل تحميل ملخص الشهر';
    toast({
      title: 'فشل تحميل ملخص الشهر',
      description: message,
      variant: 'destructive',
    });
  }, [summaryBaseError, summaryMonthMetaError, summaryMonthError, toast]);

  const saveTarget = async (appId: string, value: string) => {
    if (isMonthLocked) return;
    const targetOrders = Number.parseInt(value, 10) || 0;
    const my = monthYear(year, month);
    setSavingTarget(appId);
    try {
      await orderService.upsertAppTarget(appId, my, targetOrders);
      toast({ title: '✅ تم حفظ التارجت' });
    } catch {
      toast({ title: 'خطأ في حفظ التارجت', variant: 'destructive' });
    } finally {
      setSavingTarget(null);
    }
  };

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  const empTotal = useCallback((empId: string) =>
    dayArr.reduce((s, d) => s + apps.reduce((ss, a) => ss + (data[`${empId}::${a.id}::${d}`] ?? 0), 0), 0), [dayArr, apps, data]);

  const appGrandTotal = (appId: string) =>
    employees.reduce((s, e) => s + dayArr.reduce((ss, d) => ss + (data[`${e.id}::${appId}::${d}`] ?? 0), 0), 0);

  const grandTotal = employees.reduce((s, e) => s + empTotal(e.id), 0);
  const sortedEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => {
      const [aVal, bVal] = getOrdersEmployeeSortPair(a, b, sortField, empTotal, dayArr, data);
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [employees, sortField, sortDir, data, dayArr, empTotal]);

  const handleSort = (field: OrdersEmployeeSortField) => {
    if (sortField === field) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">ملخص الشهر</span>
        </div>
        <OrdersMonthNavigator
          label={monthLabel(year, month)}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      </div>

      {/* Per-app target cards */}
      {!loading && apps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">إجمالي المنصات والتارجت الشهري</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
            {/* Grand total card */}
            <div className="bg-card border border-primary/30 rounded-lg p-2.5 flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <TrendingUp size={12} className="text-primary" />
                <span className="text-[11px] font-semibold text-primary">الإجمالي</span>
              </div>
              <p className="text-lg font-bold text-foreground leading-tight">{grandTotal.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{employees.length} مندوب</p>
            </div>

            {apps.map(app => {
              const c = getAppColor(appColorsList, app.name);
              const total = appGrandTotal(app.id);
              const targetVal = Number.parseInt(targets[app.id] || '0', 10) || 0;
              const pct = targetVal > 0 ? Math.min(Math.round((total / targetVal) * 100), 100) : 0;
              const overTarget = targetVal > 0 && total >= targetVal;
              const isSaving = savingTarget === app.id;

              return (
                <div key={app.id} className="bg-card border border-border/50 rounded-lg p-2.5 flex flex-col gap-1.5 hover:border-border transition-colors">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
                      {app.name}
                    </span>
                    {overTarget && <span className="text-[9px] bg-success/10 text-success px-1 py-0.5 rounded-full font-semibold">✓</span>}
                  </div>

                  <div>
                    <p className="text-base font-bold leading-tight" style={{ color: c.val }}>{total.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">طلب هذا الشهر</p>
                  </div>

                  {/* Target input with save on blur */}
                  <div className="flex items-center gap-1.5">
                    <Target size={11} className="text-muted-foreground flex-shrink-0" />
                    <input
                      type="number" min={0} placeholder="التارجت"
                      value={targets[app.id] ?? ''}
                      onChange={e => setTargets(prev => ({ ...prev, [app.id]: e.target.value }))}
                      onBlur={e => saveTarget(app.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTarget(app.id, targets[app.id] || '0'); }}
                      disabled={!permissions.can_edit || isMonthLocked}
                      className="w-full h-6 text-[11px] rounded border border-border bg-muted/30 px-1.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
                    />
                    {isSaving && <Loader2 size={10} className="animate-spin text-muted-foreground flex-shrink-0" />}
                  </div>

                  {targetVal > 0 && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[10px] font-semibold" style={{ color: overTarget ? 'hsl(var(--success))' : c.val }}>
                        {pct}% من {targetVal.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <OrdersSummaryTable
            loading={loading}
            apps={apps}
            appColorsList={appColorsList}
            sortedEmployees={sortedEmployees}
            employeesCount={employees.length}
            data={data}
            dayArr={dayArr}
            days={days}
            empTotal={empTotal}
            appGrandTotal={appGrandTotal}
            grandTotal={grandTotal}
            shortName={shortName}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      </div>
    </div>
  );
});

// ─── Orders List (server-side paginated) ─────────────────────────────────────
const OrdersList = () => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const monthKey = monthYear(year, month);
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const [filters, setFilters] = useState<GlobalTableFilterState>(() => createDefaultGlobalFilters());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data: baseData } = useQuery({
    queryKey: ['orders', uid, 'list', 'base'] as const,
    queryFn: async () => {
      const [empRows, apps] = await Promise.all([
        orderService.getActiveEmployees(),
        orderService.getActiveApps(),
      ]);
      return {
        employees: filterVisibleEmployeesInMonth(
          (empRows || []) as unknown as { id: string; sponsorship_status?: string | null }[],
          activeEmployeeIdsInMonth
        ) as unknown as Employee[],
        apps: (apps || []) as App[],
      };
    },
    enabled: enabled && !!activeIdsData,
    staleTime: 60_000,
    retry: defaultQueryRetry,
  });

  useEffect(() => {
    setPage(1);
  }, [filters, monthKey]);

  const paged = useOrdersMonthPaged({
    monthYear: monthKey,
    page,
    pageSize,
    filters: {
      branch: filters.branch,
      driverId: filters.driverId,
      platformAppId: filters.platformAppId,
      search: filters.search,
    },
  });

  const total = paged.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = (paged.data?.rows ?? []) as Array<{
    employee_id: string;
    app_id: string;
    date: string;
    orders_count: number;
    employees?: { id: string; name: string; city?: string | null } | null;
    apps?: { id: string; name: string } | null;
  }>;

  const handleExportMonth = async () => {
    try {
      const XLSX = await loadXlsx();
      const raw = await orderService.getMonthRaw(year, month);
      const empMap = Object.fromEntries((baseData?.employees ?? []).map((e) => [e.id, e]));
      const appMap = Object.fromEntries((baseData?.apps ?? []).map((a) => [a.id, a]));
      const out = (raw || []).map((r) => ({
        التاريخ: r.date,
        المندوب: empMap[r.employee_id]?.name ?? r.employee_id,
        الفرع: toCityArabic(empMap[r.employee_id]?.city, ''),
        المنصة: appMap[r.app_id]?.name ?? r.app_id,
        الطلبات: r.orders_count,
      }));
      const ws = XLSX.utils.json_to_sheet(out);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      XLSX.writeFile(wb, `orders_${monthKey}.xlsx`);
      sonnerToast.success('تم التصدير', { description: `orders_${monthKey}.xlsx` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'تعذر تصدير البيانات';
      toast({ title: 'خطأ في التصدير', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <OrdersMonthNavigator year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-9 text-xs px-2">
                <FolderOpen size={13} /> ملفات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportMonth}>
                📊 تصدير Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <GlobalTableFilters
        value={filters}
        onChange={setFilters}
        onReset={() => setFilters(createDefaultGlobalFilters())}
        options={{
          enableDateRange: false, // month-scoped view
          drivers: (baseData?.employees ?? []).map((e) => ({ id: e.id, name: e.name })),
          platforms: (baseData?.apps ?? []).map((a) => ({ id: a.id, name: a.name })),
        }}
      />

      <div className="bg-card rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">التاريخ</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">المندوب</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">الفرع</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">المنصة</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">الطلبات</th>
              </tr>
            </thead>
            <tbody>
              {(paged.isLoading || !paged.data) && (
                <>
                  {ORDERS_SKELETON_ROW_KEYS.map((rowKey) => (
                    <tr key={rowKey} className="border-b border-border/30">
                      {ORDERS_SKELETON_CELL_KEYS.map((cellKey) => (
                        <td key={`${rowKey}-${cellKey}`} className="px-3 py-3">
                          <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {!paged.isLoading && rows.map((r) => (
                <tr key={`${r.employee_id}-${r.app_id}-${r.date}`} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{r.employees?.name ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{toCityArabic(r.employees?.city, '—')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.apps?.name ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.orders_count}</td>
                </tr>
              ))}

              {!paged.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    لا توجد بيانات لهذا الشهر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-3 border-t border-border/30 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">حجم الصفحة</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            صفحة {page} / {totalPages} — الإجمالي {total}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(1)}>الأولى</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronRight size={16} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>الأخيرة</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────
const Orders = () => {
  return (
    <div className="flex flex-col gap-3 w-full" dir="rtl">
      <div className="flex-shrink-0">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>الطلبات اليومية</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} /> الطلبات اليومية
        </h1>
      </div>

      <Tabs defaultValue="grid" dir="rtl" className="w-full">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="grid">📊 Grid الشهري</TabsTrigger>
          <TabsTrigger value="summary">ملخص الشهر</TabsTrigger>
          <TabsTrigger value="list">قائمة (سريعة)</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="mt-4 outline-none"><SpreadsheetGrid /></TabsContent>
        <TabsContent value="summary" className="mt-4 overflow-x-auto outline-none"><MonthSummary /></TabsContent>
        <TabsContent value="list" className="mt-4 outline-none"><OrdersList /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
