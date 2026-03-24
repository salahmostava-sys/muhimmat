import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Save, Package, Upload, FolderOpen, ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp, X, Check, Target, TrendingUp } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { useAppColors, getAppColor } from '@/hooks/useAppColors';
import { usePermissions } from '@/hooks/usePermissions';


// ─── Types ──────────────────────────────────────────────────────────
type Employee = { id: string; name: string; salary_type: string; status: string; sponsorship_status: string | null };
type App = { id: string; name: string; name_en: string | null };
type DailyData = Record<string, number>;
type AppTargetRow = { app_id: string; target_orders: number };

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

// ─── Cell Popover ─────────────────────────────────────────────────
type PopoverState = { empId: string; day: number; x: number; y: number };

interface CellPopoverProps {
  state: PopoverState;
  apps: App[];
  data: DailyData;
  appColorsList: ReturnType<typeof useAppColors>['apps'];
  canEdit: boolean;
  onApply: (empId: string, day: number, vals: Record<string, number>) => void;
  onClose: () => void;
}

const CellPopover = ({ state, apps, data, appColorsList, canEdit, onApply, onClose }: CellPopoverProps) => {
  const initVals = () => {
    const v: Record<string, string> = {};
    apps.forEach(app => {
      const k = `${state.empId}::${app.id}::${state.day}`;
      const cur = data[k];
      if (cur) v[app.id] = String(cur);
    });
    return v;
  };
  const [vals, setVals] = useState<Record<string, string>>(initVals);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: state.y + 6, left: state.x });

  useLayoutEffect(() => {
    if (!popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    let left = state.x;
    let top = state.y + 6;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = state.y - rect.height - 6;
    setPos({ top, left });
  }, [state.x, state.y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleApply = () => {
    const result: Record<string, number> = {};
    Object.entries(vals).forEach(([appId, v]) => {
      result[appId] = parseInt(v) || 0;
    });
    onApply(state.empId, state.day, result);
    onClose();
  };

  return (
    <div
      ref={popRef}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl p-3 min-w-[200px]"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-semibold text-foreground">يوم {state.day}</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
          <X size={13} />
        </button>
      </div>
      <div className="space-y-1.5">
        {apps.map(app => {
          const c = getAppColor(appColorsList, app.name);
          return (
            <div key={app.id} className="flex items-center gap-2">
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 min-w-[70px] text-center"
                style={{ backgroundColor: c.bg, color: c.text }}>
                {app.name}
              </span>
              <input
                type="number" min={0} placeholder="0"
                value={vals[app.id] ?? ''}
                onChange={e => setVals(prev => ({ ...prev, [app.id]: e.target.value }))}
                disabled={!canEdit}
                className="w-16 h-7 text-center text-xs rounded border border-border bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                onKeyDown={e => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
              />
            </div>
          );
        })}
      </div>
      {canEdit && (
        <Button size="sm" className="w-full mt-3 h-7 text-xs gap-1" onClick={handleApply}>
          <Check size={12} /> تطبيق
        </Button>
      )}
    </div>
  );
};

// ─── SpreadsheetGrid ─────────────────────────────────────────────────
const SpreadsheetGrid = () => {
  const { apps: appColorsList } = useAppColors();
  const { toast } = useToast();
  const { permissions } = usePermissions('orders');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [cellPopover, setCellPopover] = useState<PopoverState | null>(null);
  const [sortField, setSortField] = useState<'name' | 'total' | `app:${string}`>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [platformFilter, setPlatformFilter] = useState<'all' | string>('all');
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [lockingMonth, setLockingMonth] = useState(false);
  const canEditMonth = permissions.can_edit && !isMonthLocked;

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      orderService.getActiveEmployees(),
      orderService.getActiveApps(),
    ]).then(([empRes, appRes]) => {
      if (!isMounted) return;
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as App[]);
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    orderService.getMonthRaw(year, month).then(({ data: rows }) => {
      if (!isMounted) return;
      const d: DailyData = {};
      rows?.forEach(r => {
        if (platformFilter !== 'all' && r.app_id !== platformFilter) return;
        const day = new Date(r.date + 'T00:00:00').getDate();
        d[`${r.employee_id}::${r.app_id}::${day}`] = r.orders_count;
      });
      setData(d);
      setLoading(false);
    });
    return () => { isMounted = false; };
  }, [year, month, platformFilter]);

  useEffect(() => {
    let isMounted = true;
    const my = monthYear(year, month);
    orderService.getMonthLockStatus(my).then(({ locked }) => {
        if (!isMounted) return;
        setIsMonthLocked(locked);
      });
    return () => {
      isMounted = false;
    };
  }, [year, month]);

  const filteredEmployees = employees.filter(emp => emp.name.includes(search));
  const visibleApps = platformFilter === 'all' ? apps : apps.filter(a => a.id === platformFilter);
  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);
  const today = now.getFullYear() === year && (now.getMonth() + 1) === month ? now.getDate() : -1;

  const getVal = useCallback((empId: string, appId: string, day: number) => data[`${empId}::${appId}::${day}`] ?? 0, [data]);
  const getActiveApps = useCallback((empId: string) => visibleApps.filter(app => dayArr.some(d => getVal(empId, app.id, d) > 0)), [visibleApps, dayArr, getVal]);
  const empDayTotal = useCallback((empId: string, day: number) => visibleApps.reduce((s, a) => s + getVal(empId, a.id, day), 0), [visibleApps, getVal]);
  const empMonthTotal = useCallback((empId: string) => dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0), [dayArr, empDayTotal]);
  const empAppMonthTotal = useCallback((empId: string, appId: string) => dayArr.reduce((s, d) => s + getVal(empId, appId, d), 0), [dayArr, getVal]);

  const sortedEmployees = useMemo(() => {
    const sorted = [...filteredEmployees].sort((a, b) => {
      let aVal: number | string = '';
      let bVal: number | string = '';
      if (sortField === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortField === 'total') {
        aVal = empMonthTotal(a.id);
        bVal = empMonthTotal(b.id);
      } else {
        const appId = sortField.replace('app:', '');
        aVal = empAppMonthTotal(a.id, appId);
        bVal = empAppMonthTotal(b.id, appId);
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredEmployees, sortField, sortDir, empMonthTotal, empAppMonthTotal]);

  const monthGrandTotal = useMemo(
    () => sortedEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0),
    [sortedEmployees, empMonthTotal]
  );
  const monthDailyAvg = days > 0 ? Math.round(monthGrandTotal / days) : 0;

  const handleSort = (field: 'name' | 'total' | `app:${string}`) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'total' | `app:${string}` }) => {
    if (sortField !== field) return <span className="text-muted-foreground/40 text-[10px] mr-0.5">⇅</span>;
    return <span className="text-[10px] mr-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
  const exportExcel = () => {
    const rowsXlsx = filteredEmployees.map(emp => {
      const row: Record<string, unknown> = { 'الاسم': emp.name };
      dayArr.forEach(d => { row[String(d)] = empDayTotal(emp.id, d) || ''; });
      row['المجموع'] = empMonthTotal(emp.id);
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rowsXlsx);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الطلبات');
    XLSX.writeFile(wb, `طلبات_${month}_${year}.xlsx`);
    toast({ title: 'تم التصدير' });
  };

  // ── Import ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        let imported = 0;
        const newData = { ...data };
        rows.forEach(row => {
          const empName = String(row['الاسم'] || '');
          const emp = employees.find(e => e.name === empName);
          if (!emp) return;
          dayArr.forEach(d => {
            const val = Number(row[String(d)]);
            if (val > 0) {
              apps.forEach(app => {
                newData[`${emp.id}::${app.id}::${d}`] = val;
                imported++;
              });
            }
          });
        });
        setData(newData);
        toast({ title: `تم استيراد ${imported} إدخال` });
      } catch {
        toast({ title: 'فشل الاستيراد', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // ── Template ──
  const handleTemplate = () => {
    const headers = [['الاسم', ...dayArr.map(String), 'المجموع']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب الطلبات');
    XLSX.writeFile(wb, 'template_orders.xlsx');
  };

  // ── Print ──
  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>طلبات ${month}/${year}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:14px}p.sub{text-align:center;color:#666;font-size:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:5px 6px;text-align:right;font-size:9px;white-space:nowrap}td{padding:4px 6px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>طلبات شهر ${month}/${year}</h2><p class="sub">المجموع: ${filteredEmployees.length} مندوب — ${new Date().toLocaleDateString('ar-SA')}</p>`);
    if (!printWindow.document.body) return;
    // Append the live DOM table node to avoid string-interpolating table HTML.
    printWindow.document.body.appendChild(table.cloneNode(true));
    printWindow.document.write(`<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  // ── Save ──
  const handleSave = async () => {
    if (isMonthLocked) return;
    setSaving(true);
    const rows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];
    Object.entries(data).forEach(([key, count]) => {
      const [empId, appId, dayStr] = key.split('::');
      const day = parseInt(dayStr);
      if (!isNaN(day) && day >= 1 && day <= days)
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
    const { error } = await orderService.lockMonth(my);
    setLockingMonth(false);
    if (error) {
      toast({ title: 'فشل قفل الشهر', description: error.message, variant: 'destructive' });
      return;
    }
    setIsMonthLocked(true);
    setCellPopover(null);
    toast({ title: '✅ تم قفل الشهر بنجاح' });
  };

  const repColMin = 132;

  return (
    <div className="flex flex-col gap-2">
      {/* صف واحد: الشهر + البحث + ملخص الشهر + الشهري + إجراءات */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 flex-shrink-0">
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
          <button type="button" onClick={prevMonth} className="p-1.5 rounded-md hover:bg-background transition-colors" aria-label="الشهر السابق"><ChevronRight size={15} /></button>
          <span className="px-2 text-xs font-semibold min-w-[7.5rem] text-center tabular-nums">{monthLabel(year, month)}</span>
          <button type="button" onClick={nextMonth} className="p-1.5 rounded-md hover:bg-background transition-colors" aria-label="الشهر التالي"><ChevronLeft size={15} /></button>
        </div>

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
            <span className="font-semibold tabular-nums text-foreground">{sortedEmployees.length}</span>
          </span>
          {platformFilter !== 'all' && apps.find(a => a.id === platformFilter) && (
            <>
              <span className="h-3 w-px bg-border" aria-hidden />
              <span className="text-primary font-medium truncate max-w-[7rem]">
                {apps.find(a => a.id === platformFilter)!.name}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 mr-auto shrink-0">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8 text-xs px-2"><FolderOpen size={13} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}><Upload size={14} className="ml-1" /> استيراد Excel</DropdownMenuItem>
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
          : '💡 انقر على خلية اليوم لإدخال الطلبات — السهم بجانب المندوب لعرض تفاصيل المنصات — تصفية المنصات أسفل الصفحة'}
      </p>

      <div className="flex items-center gap-1 flex-wrap text-[10px] flex-shrink-0">
        <span className="text-muted-foreground ml-1">ترتيب:</span>
        <button type="button" onClick={() => handleSort('name')} className="px-2 py-0.5 rounded border border-border/60 hover:bg-muted/30">
          اسم المندوب <SortIcon field="name" />
        </button>
        <button type="button" onClick={() => handleSort('total')} className="px-2 py-0.5 rounded border border-border/60 hover:bg-muted/30">
          إجمالي الطلبات <SortIcon field="total" />
        </button>
        {visibleApps.map(app => (
          <button
            key={app.id}
            type="button"
            onClick={() => handleSort(`app:${app.id}`)}
            className="px-2 py-0.5 rounded border border-border/60 hover:bg-muted/30"
          >
            {app.name} <SortIcon field={`app:${app.id}`} />
          </button>
        ))}
      </div>

      {/* جدول: تمرير أفقي فقط؛ التمرير العمودي للصفحة بالكامل */}
      <div className="bg-card rounded-xl shadow-card overflow-x-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <table ref={tableRef} className="border-collapse text-[11px] leading-tight" style={{ minWidth: `${repColMin + days * 36 + 64}px`, width: '100%' }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted border-b-2 border-border">
                <th
                  onClick={() => handleSort('name')}
                  className="sticky right-0 z-30 bg-muted text-right px-1.5 py-1.5 font-semibold text-foreground border-l-2 border-border cursor-pointer"
                  style={{ minWidth: repColMin }}>
                  المندوب / المنصة <SortIcon field="name" />
                </th>
                {dayArr.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isWeekend = dow === 5 || dow === 6;
                  const isThursday = dow === 4;
                  const isToday = d === today;
                  return (
                    <th key={d}
                      className={`text-center px-0.5 py-1.5 font-medium border-l border-border/50
                        ${isToday ? 'bg-primary/20 text-primary font-bold' : isWeekend ? 'text-muted-foreground/50 bg-muted/40' : isThursday ? 'text-muted-foreground/70 bg-muted/20' : 'text-muted-foreground'}`}
                      style={{ minWidth: 36 }}>
                      {d}
                    </th>
                  );
                })}
                <th
                  onClick={() => handleSort('total')}
                  className="sticky left-0 z-30 text-center py-1.5 font-bold text-primary bg-muted border-r-2 border-border cursor-pointer"
                  style={{ minWidth: 64 }}>
                  المجموع <SortIcon field="total" />
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedEmployees.length === 0 ? (
                <tr><td colSpan={days + 2} className="text-center py-12 text-muted-foreground">لا يوجد مناديب</td></tr>
              ) : sortedEmployees.map((emp, idx) => {
                const activeApps = getActiveApps(emp.id);
                const isExpanded = expandedEmp.has(emp.id);
                const total = empMonthTotal(emp.id);
                const rowBg = idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted))';

                return (
                  <React.Fragment key={emp.id}>
                    <tr className={`border-b border-border/40 select-none ${isExpanded ? 'border-b-0' : ''}`}>
                      <td
                        className="sticky right-0 z-10 px-1.5 py-1 border-l-2 border-border cursor-pointer hover:brightness-[0.98] transition-[filter] dark:hover:brightness-110"
                        style={{
                          backgroundColor: isExpanded ? 'hsl(var(--muted))' : rowBg,
                          minWidth: repColMin,
                        }}
                        onClick={() => activeApps.length > 0 && toggleExpand(emp.id)}
                      >
                        <div className="flex items-center gap-1">
                          {activeApps.length > 0 && (
                            <span className="text-muted-foreground flex-shrink-0">
                              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </span>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[7.5rem]" title={emp.name}>{shortName(emp.name)}</span>
                        </div>
                        {activeApps.length > 0 && (
                          <div className="flex gap-0.5 flex-wrap mt-0.5 pr-7">
                            {activeApps.slice(0, 3).map(a => {
                              const c = getAppColor(appColorsList, a.name);
                              return (
                                <span key={a.id} className="text-[9px] px-1 rounded font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                                  {a.name.slice(0, 4)}
                                </span>
                              );
                            })}
                            {activeApps.length > 3 && <span className="text-[9px] text-muted-foreground">+{activeApps.length - 3}</span>}
                          </div>
                        )}
                      </td>

                      {dayArr.map(d => {
                        const val = empDayTotal(emp.id, d);
                        const dow = new Date(year, month - 1, d).getDay();
                        const isWeekend = dow === 5 || dow === 6;
                        const isThursday = dow === 4;
                        const isToday = d === today;
                        const isOpen = cellPopover?.empId === emp.id && cellPopover?.day === d;
                        const dayApps = visibleApps.filter(a => getVal(emp.id, a.id, d) > 0);

                        return (
                          <td key={d}
                            className={`text-center p-0 border-l border-border/30 transition-colors
                              ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/20' : isThursday ? 'bg-muted/10' : ''}
                              ${isOpen ? 'ring-2 ring-inset ring-primary' : ''}
                              ${canEditMonth ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                            style={{ minWidth: 36 }}
                            onClick={e => handleCellClick(e, emp.id, d)}
                          >
                            <div className="h-7 flex flex-col items-center justify-center gap-0">
                              {val > 0 ? (
                                <>
                                  <span className="font-semibold text-foreground leading-none">{val}</span>
                                  {dayApps.length > 0 && (
                                    <div className="flex gap-0.5 mt-0.5">
                                      {dayApps.slice(0, 3).map(a => {
                                        const c = getAppColor(appColorsList, a.name);
                                        return <span key={a.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.bg }} />;
                                      })}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground/20">·</span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Totals column - sticky left, solid background to prevent bleed */}
                      <td
                        className="sticky left-0 z-10 text-center px-1 py-1 font-bold text-primary border-r-2 border-border bg-muted"
                        style={{ minWidth: 64 }}
                      >
                        {total > 0 ? total : <span className="text-muted-foreground/30">0</span>}
                      </td>
                    </tr>

                    {isExpanded && activeApps.map(app => {
                      const c = getAppColor(appColorsList, app.name);
                      const appTotal = empAppMonthTotal(emp.id, app.id);
                      return (
                        <tr key={`${emp.id}-${app.id}`} className="border-b border-border/20" style={{ backgroundColor: c.cellBg }}>
                          <td className="sticky right-0 z-10 px-1.5 py-1 border-l-2 border-border" style={{ backgroundColor: c.cellBg, minWidth: repColMin }}>
                            <div className="flex items-center gap-2 pr-8">
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: c.bg, color: c.text }}>
                                {app.name}
                              </span>
                            </div>
                          </td>
                          {dayArr.map(d => {
                            const val = getVal(emp.id, app.id, d);
                            const dow = new Date(year, month - 1, d).getDay();
                            const isWeekend = dow === 5 || dow === 6;
                            const isThursday = dow === 4;
                            const isToday = d === today;
                            return (
                              <td key={d} className={`text-center p-0 border-l border-border/20 ${isToday ? 'bg-primary/5' : isWeekend ? 'bg-muted/20 opacity-70' : isThursday ? 'bg-muted/10' : ''}`} style={{ minWidth: 36 }}>
                                <div className="h-6 flex items-center justify-center font-medium text-[10px]" style={{ color: val > 0 ? c.val : undefined }}>
                                  {val > 0 ? val : <span className="text-muted-foreground/20">·</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className="sticky left-0 z-10 text-center px-1 py-1 font-bold border-r-2 border-border text-[10px] bg-muted" style={{ color: c.val, minWidth: 64 }}>
                            {appTotal > 0 ? appTotal : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Footer totals */}
              <tr className="border-t-2 border-border font-semibold">
                <td className="sticky right-0 z-10 px-1.5 py-1.5 text-xs font-bold border-l-2 border-border text-foreground bg-muted"
                  style={{ minWidth: repColMin }}>
                  الإجمالي
                </td>
                {dayArr.map(d => {
                  const dayTotal = sortedEmployees.reduce((s, e) => s + empDayTotal(e.id, d), 0);
                  const isToday = d === today;
                  return (
                    <td key={d} className={`text-center px-0.5 py-1.5 font-bold border-l border-border/40 ${isToday ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                      style={{ minWidth: 36, backgroundColor: isToday ? undefined : 'hsl(var(--muted) / 0.4)' }}>
                      {dayTotal > 0 ? dayTotal : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  );
                })}
                <td className="sticky left-0 z-10 text-center px-1.5 py-1.5 font-bold text-xs text-primary border-r-2 border-border bg-muted"
                  style={{ minWidth: 64 }}>
                  {sortedEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {apps.length > 0 && (
        <div className="flex flex-col gap-2 pt-3 flex-shrink-0 border-t border-border/60 mt-1">
          <p className="text-xs font-semibold text-foreground">تصفية المنصات</p>
          <p className="text-[10px] text-muted-foreground -mt-1">اختر منصة لعرض طلباتها فقط، أو «كل المنصات» لعرض الجميع.</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPlatformFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${platformFilter === 'all' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card border-border hover:bg-muted/50'}`}
            >
              كل المنصات
            </button>
            {apps.map(app => {
              const c = getAppColor(appColorsList, app.name);
              const active = platformFilter === app.id;
              return (
                <button
                  key={`plat-${app.id}`}
                  type="button"
                  onClick={() => setPlatformFilter(app.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors max-w-[10rem] truncate ${active ? 'border-primary ring-1 ring-primary/30' : 'border-border/70 hover:border-border'}`}
                  style={active ? { backgroundColor: c.bg, color: c.text, borderColor: c.bg } : { borderColor: 'hsl(var(--border))' }}
                  title={app.name}
                >
                  {app.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {cellPopover && (
        <CellPopover
          state={cellPopover} apps={apps} data={data} appColorsList={appColorsList}
          canEdit={canEditMonth} onApply={handlePopoverApply} onClose={() => setCellPopover(null)}
        />
      )}
    </div>
  );
};

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = () => {
  const { apps: appColorsList } = useAppColors();
  const { toast } = useToast();
  const { permissions } = usePermissions('orders');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'total' | `app:${string}`>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      orderService.getActiveEmployees(),
      orderService.getActiveApps(),
    ]).then(([empRes, appRes]) => {
      if (!isMounted) return;
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as App[]);
    });
    return () => { isMounted = false; };
  }, []);

  // Load targets when month changes
  useEffect(() => {
    let isMounted = true;
    const my = monthYear(year, month);
    setTargets({});
    orderService.getAppTargets(my)
      .then(({ data: rows }) => {
        if (!isMounted) return;
        const t: Record<string, string> = {};
        if (rows) (rows as AppTargetRow[]).forEach(r => { t[r.app_id] = String(r.target_orders); });
        setTargets(t);
      });
    return () => { isMounted = false; };
  }, [year, month]);

  useEffect(() => {
    let isMounted = true;
    const my = monthYear(year, month);
    orderService.getMonthLockStatus(my).then(({ locked }) => {
        if (!isMounted) return;
        setIsMonthLocked(locked);
      });
    return () => {
      isMounted = false;
    };
  }, [year, month]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    orderService.getMonthRaw(year, month).then(({ data: rows }) => {
        if (!isMounted) return;
        const d: DailyData = {};
        rows?.forEach(r => {
          const day = new Date(r.date + 'T00:00:00').getDate();
          d[`${r.employee_id}::${r.app_id}::${day}`] = r.orders_count;
        });
        setData(d);
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [year, month]);

  const saveTarget = async (appId: string, value: string) => {
    if (isMonthLocked) return;
    const targetOrders = parseInt(value) || 0;
    const my = monthYear(year, month);
    setSavingTarget(appId);
    const { error } = await orderService.upsertAppTarget(appId, my, targetOrders);
    setSavingTarget(null);
    if (error) toast({ title: 'خطأ في حفظ التارجت', variant: 'destructive' });
    else toast({ title: '✅ تم حفظ التارجت' });
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
      let aVal: number | string = '';
      let bVal: number | string = '';
      if (sortField === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else if (sortField === 'total') {
        aVal = empTotal(a.id);
        bVal = empTotal(b.id);
      } else {
        const appId = sortField.replace('app:', '');
        aVal = dayArr.reduce((s, d) => s + (data[`${a.id}::${appId}::${d}`] ?? 0), 0);
        bVal = dayArr.reduce((s, d) => s + (data[`${b.id}::${appId}::${d}`] ?? 0), 0);
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal, 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const cmp = Number(aVal) - Number(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [employees, sortField, sortDir, data, dayArr, empTotal]);

  const handleSort = (field: 'name' | 'total' | `app:${string}`) => {
    if (sortField === field) setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: 'name' | 'total' | `app:${string}` }) => {
    if (sortField !== field) return <span className="text-muted-foreground/40 text-[10px] mr-0.5">⇅</span>;
    return <span className="text-[10px] mr-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>
      </div>

      {/* Per-app target cards */}
      {!loading && apps.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">إجمالي المنصات والتارجت الشهري</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {/* Grand total card */}
            <div className="bg-card border-2 border-primary/30 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={13} className="text-primary" />
                <span className="text-xs font-semibold text-primary">الإجمالي الكلي</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{grandTotal.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{employees.length} مندوب</p>
            </div>

            {apps.map(app => {
              const c = getAppColor(appColorsList, app.name);
              const total = appGrandTotal(app.id);
              const targetVal = parseInt(targets[app.id] || '0') || 0;
              const pct = targetVal > 0 ? Math.min(Math.round((total / targetVal) * 100), 100) : 0;
              const overTarget = targetVal > 0 && total >= targetVal;
              const isSaving = savingTarget === app.id;

              return (
                <div key={app.id} className="bg-card border border-border/50 rounded-xl p-3 flex flex-col gap-2.5 hover:border-border transition-colors">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: c.bg, color: c.text }}>
                      {app.name}
                    </span>
                    {overTarget && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full font-semibold">✓ حُقِّق</span>}
                  </div>

                  <div>
                    <p className="text-xl font-bold" style={{ color: c.val }}>{total.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">طلب هذا الشهر</p>
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
                      className="w-full h-6 text-xs rounded border border-border bg-muted/30 px-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-center"
                    />
                    {isSaving && <Loader2 size={10} className="animate-spin text-muted-foreground flex-shrink-0" />}
                  </div>

                  {targetVal > 0 && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <p className="text-[11px] font-semibold" style={{ color: overTarget ? 'hsl(var(--success))' : c.val }}>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/40">
                <th className="text-center p-3 font-semibold text-muted-foreground w-10">#</th>
                <th className="text-center p-3 font-semibold text-foreground min-w-[160px] cursor-pointer" onClick={() => handleSort('name')}>
                  المندوب <SortIcon field="name" />
                </th>
                {apps.map(app => {
                  const c = getAppColor(appColorsList, app.name);
                  return (
                    <th
                      key={app.id}
                      onClick={() => handleSort(`app:${app.id}`)}
                      className="text-center p-3 font-semibold min-w-[90px] border-l border-border/50 cursor-pointer"
                      style={{ backgroundColor: `${c.bg}22`, color: c.val }}>
                      {app.name} <SortIcon field={`app:${app.id}`} />
                    </th>
                  );
                })}
                <th className="text-center p-3 font-semibold text-primary min-w-[80px] border-l border-border cursor-pointer" onClick={() => handleSort('total')}>
                  الإجمالي <SortIcon field="total" />
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground min-w-[80px]">متوسط يومي</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: apps.length + 4 }).map((_, j) => (
                      <td key={j} className="p-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : sortedEmployees.map((emp, idx) => {
                const total = empTotal(emp.id);
                const avg = total > 0 ? Math.round(total / days) : 0;
                return (
                  <tr key={emp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 1 ? 'bg-muted/5' : ''}`}>
                    <td className="p-3 text-center text-xs text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground whitespace-nowrap">{emp.name}</span>
                      </div>
                    </td>
                    {apps.map(app => {
                      const c = getAppColor(appColorsList, app.name);
                      const appTotal = dayArr.reduce((s, d) => s + (data[`${emp.id}::${app.id}::${d}`] ?? 0), 0);
                      return (
                        <td key={app.id} className="text-center p-3 font-semibold border-l border-border/30" style={{ color: appTotal > 0 ? c.val : undefined }}>
                          {appTotal > 0 ? appTotal : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-bold text-primary border-l border-border">{total > 0 ? total : 0}</td>
                    <td className="p-3 text-center text-muted-foreground">{avg}</td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && employees.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                  <td colSpan={2} className="p-3">
                    <span className="text-sm font-bold text-foreground">الإجمالي</span>
                  </td>
                  {apps.map(app => {
                    const c = getAppColor(appColorsList, app.name);
                    const total = appGrandTotal(app.id);
                    return (
                      <td key={app.id} className="text-center p-3 font-bold border-l border-border/40" style={{ color: c.val }}>
                        {total > 0 ? total : '—'}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center font-bold text-primary border-l border-border">{grandTotal}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
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
        </TabsList>
        <TabsContent value="grid" className="mt-4 outline-none"><SpreadsheetGrid /></TabsContent>
        <TabsContent value="summary" className="mt-4 overflow-x-auto outline-none"><MonthSummary /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
