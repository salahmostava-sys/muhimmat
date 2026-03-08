import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Save, Package, Download, ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { useAppColors, getAppColor } from '@/hooks/useAppColors';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ──────────────────────────────────────────────────────────
type Employee = { id: string; name: string; salary_type: string; status: string; sponsorship_status: string | null };
type App = { id: string; name: string; name_en: string | null };
// key: `${empId}::${appId}::${day}`
type DailyData = Record<string, number>;

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
const dateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

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

  // Re-position so popover stays within viewport
  useLayoutEffect(() => {
    if (!popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    let left = state.x;
    let top = state.y + 6;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight - 8) top = state.y - rect.height - 6;
    setPos({ top, left });
  }, [state.x, state.y]);

  // Close on outside click
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
      const n = parseInt(v) || 0;
      result[appId] = n;
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
        <span className="text-xs font-semibold text-foreground">يوم {state.day} — اختر المنصة والطلبات</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
          <X size={13} />
        </button>
      </div>
      <div className="space-y-1.5">
        {apps.map(app => {
          const c = getAppColor(appColorsList, app.name);
          return (
            <div key={app.id} className="flex items-center gap-2">
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 min-w-[70px] text-center"
                style={{ backgroundColor: c.bg, color: c.text }}
              >
                {app.name}
              </span>
              <input
                type="number"
                min={0}
                placeholder="0"
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

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [cellPopover, setCellPopover] = useState<PopoverState | null>(null);

  // ── Fetch employees + apps once ──
  useEffect(() => {
    Promise.all([
      supabase.from('employees')
        .select('id, name, salary_type, status, sponsorship_status')
        .eq('status', 'active')
        .not('sponsorship_status', 'in', '("absconded","terminated")')
        .order('name'),
      supabase.from('apps').select('id, name, name_en').eq('is_active', true).order('name'),
    ]).then(([empRes, appRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as App[]);
    });
  }, []);

  // ── Fetch daily orders for current month ──
  useEffect(() => {
    const days = getDaysInMonth(year, month);
    const from = dateStr(year, month, 1);
    const to   = dateStr(year, month, days);
    setLoading(true);
    supabase.from('daily_orders')
      .select('employee_id, app_id, date, orders_count')
      .gte('date', from).lte('date', to)
      .then(({ data: rows }) => {
        const d: DailyData = {};
        rows?.forEach(r => {
          const day = new Date(r.date).getDate();
          d[`${r.employee_id}::${r.app_id}::${day}`] = r.orders_count;
        });
        setData(d);
        setLoading(false);
      });
  }, [year, month]);

  const filteredEmployees = employees.filter(emp => emp.name.includes(search));
  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);
  const today = now.getFullYear() === year && (now.getMonth() + 1) === month ? now.getDate() : -1;

  const getVal = (empId: string, appId: string, day: number) =>
    data[`${empId}::${appId}::${day}`] ?? 0;

  // Apps that have data for this employee this month
  const getActiveApps = (empId: string) =>
    apps.filter(app => dayArr.some(d => getVal(empId, app.id, d) > 0));

  // Sum across all apps for a day
  const empDayTotal = (empId: string, day: number) =>
    apps.reduce((s, a) => s + getVal(empId, a.id, day), 0);

  // Monthly total for employee
  const empMonthTotal = (empId: string) =>
    dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0);

  // Monthly total for employee+app
  const empAppMonthTotal = (empId: string, appId: string) =>
    dayArr.reduce((s, d) => s + getVal(empId, appId, d), 0);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const toggleExpand = (empId: string) => {
    setExpandedEmp(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const handleCellClick = useCallback((e: React.MouseEvent, empId: string, day: number) => {
    if (!permissions.can_edit && apps.length === 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPopover({ empId, day, x: rect.left, y: rect.bottom });
  }, [permissions.can_edit, apps.length]);

  const handlePopoverApply = useCallback((empId: string, day: number, vals: Record<string, number>) => {
    setData(prev => {
      const next = { ...prev };
      Object.entries(vals).forEach(([appId, count]) => {
        const key = `${empId}::${appId}::${day}`;
        if (count > 0) next[key] = count;
        else delete next[key];
      });
      return next;
    });
  }, []);

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    const rows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];

    Object.entries(data).forEach(([key, count]) => {
      const [empId, appId, dayStr] = key.split('::');
      const day = parseInt(dayStr);
      if (!isNaN(day) && day >= 1 && day <= days) {
        rows.push({ employee_id: empId, app_id: appId, date: dateStr(year, month, day), orders_count: count });
      }
    });

    const CHUNK = 200;
    let saved = 0;
    const failed: string[] = [];

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from('daily_orders').upsert(chunk, {
        onConflict: 'employee_id,app_id,date',
      });
      if (error) failed.push(...chunk.map(r => r.date));
      else saved += chunk.length;
    }

    setSaving(false);
    if (failed.length > 0) {
      toast({ title: `فشل في حفظ ${failed.length} إدخال`, description: `تم حفظ ${saved} بنجاح`, variant: 'destructive' });
    } else {
      toast({ title: `✅ تم حفظ ${saved} إدخال بنجاح`, description: `بيانات ${monthLabel(year, month)}` });
    }
  };

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

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>

        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="mr-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel}><Download size={14} /> Excel</Button>
          {permissions.can_edit && (
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> جاري الحفظ...</> : <><Save size={14} /> حفظ</>}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 انقر على أي خلية يوم لإدخال الطلبات حسب المنصة — السهم لعرض تفاصيل المنصات
      </p>

      {/* Grid */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <table className="w-full border-collapse text-xs" style={{ minWidth: `${200 + days * 44 + 60}px` }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/60 border-b border-border">
                <th className="sticky right-0 z-30 bg-muted/80 backdrop-blur text-right px-3 py-2.5 font-semibold text-foreground min-w-[200px] border-l border-border">
                  المندوب / المنصة
                </th>
                {dayArr.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isWeekend = dow === 5 || dow === 6;
                  const isToday = d === today;
                  return (
                    <th key={d}
                      className={`text-center px-1 py-2.5 font-medium min-w-[42px] border-l border-border/30
                        ${isToday ? 'bg-primary/20 text-primary font-bold' : isWeekend ? 'text-muted-foreground/50 bg-muted/30' : 'text-muted-foreground'}`}>
                      {d}
                    </th>
                  );
                })}
                <th className="sticky left-0 text-center px-2 py-2.5 font-semibold text-primary min-w-[70px] border-r border-border bg-primary/5 z-30">المجموع</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={days + 2} className="text-center py-12 text-muted-foreground">لا يوجد مناديب</td></tr>
              ) : filteredEmployees.map((emp, idx) => {
                const activeApps = getActiveApps(emp.id);
                const isExpanded = expandedEmp.has(emp.id);
                const total = empMonthTotal(emp.id);
                const rowBg = idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted)/0.05)';

                return (
                  <>
                    {/* Main employee row */}
                    <tr key={emp.id}
                      className={`border-b border-border/30 select-none
                        ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/5'}
                        ${isExpanded ? 'bg-primary/5 border-b-0' : ''}`}>

                      {/* Name cell */}
                      <td
                        className="sticky right-0 z-10 px-3 py-2 border-l border-border cursor-pointer hover:bg-muted/30 transition-colors"
                        style={{ backgroundColor: isExpanded ? 'hsl(var(--primary)/0.07)' : rowBg }}
                        onClick={() => activeApps.length > 0 && toggleExpand(emp.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          {activeApps.length > 0 && (
                            <span className="text-muted-foreground flex-shrink-0">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          )}
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">
                            {emp.name.charAt(0)}
                          </div>
                          <span className="font-medium text-foreground truncate max-w-[100px]">{emp.name}</span>
                          {/* Active platform badges */}
                          {activeApps.length > 0 && (
                            <div className="flex gap-0.5 flex-wrap">
                              {activeApps.slice(0, 3).map(a => {
                                const c = getAppColor(appColorsList, a.name);
                                return (
                                  <span key={a.id} className="text-[9px] px-1 rounded font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
                                    {a.name.slice(0, 3)}
                                  </span>
                                );
                              })}
                              {activeApps.length > 3 && <span className="text-[9px] text-muted-foreground">+{activeApps.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Day cells — click to open platform popover */}
                      {dayArr.map(d => {
                        const val = empDayTotal(emp.id, d);
                        const dow = new Date(year, month - 1, d).getDay();
                        const isWeekend = dow === 5 || dow === 6;
                        const isToday = d === today;
                        const isOpen = cellPopover?.empId === emp.id && cellPopover?.day === d;

                        // Which apps have data for this day
                        const dayApps = apps.filter(a => getVal(emp.id, a.id, d) > 0);

                        return (
                          <td key={d}
                            className={`text-center p-0 border-l border-border/30 transition-colors
                              ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/20' : ''}
                              ${isOpen ? 'ring-2 ring-inset ring-primary' : ''}
                              ${permissions.can_edit ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                            onClick={e => handleCellClick(e, emp.id, d)}
                          >
                            <div className="h-9 flex flex-col items-center justify-center gap-0">
                              {val > 0 ? (
                                <>
                                  <span className="font-semibold text-foreground leading-none">{val}</span>
                                  {/* Mini platform dots */}
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

                      {/* Total */}
                      <td className="sticky left-0 text-center px-2 py-2 font-bold text-primary bg-primary/5 border-r border-border z-10">
                        {total > 0 ? total : <span className="text-muted-foreground/30">0</span>}
                      </td>
                    </tr>

                    {/* Expanded per-app rows */}
                    {isExpanded && activeApps.map(app => {
                      const c = getAppColor(appColorsList, app.name);
                      const appTotal = empAppMonthTotal(emp.id, app.id);
                      return (
                        <tr key={`${emp.id}-${app.id}`}
                          className="border-b border-border/20"
                          style={{ backgroundColor: c.cellBg }}>
                          <td className="sticky right-0 z-10 px-3 py-1.5 border-l border-border" style={{ backgroundColor: c.cellBg }}>
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
                            const isToday = d === today;
                            return (
                              <td key={d}
                                className={`text-center p-0 border-l border-border/20
                                  ${isToday ? 'bg-primary/5' : isWeekend ? 'opacity-70' : ''}`}>
                                <div className="h-7 flex items-center justify-center font-medium text-xs"
                                  style={{ color: val > 0 ? c.val : undefined }}>
                                  {val > 0 ? val : <span className="text-muted-foreground/20">·</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className="sticky left-0 text-center px-2 py-1.5 font-bold border-r border-border/30 z-10 text-xs" style={{ backgroundColor: c.cellBg, color: c.val }}>
                            {appTotal > 0 ? appTotal : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              })}

              {/* Footer totals */}
              <tr className="border-t-2 border-border bg-muted/30 font-semibold sticky bottom-0">
                <td className="sticky right-0 z-10 bg-muted/50 px-3 py-2 text-sm border-l border-border">الإجمالي</td>
                {dayArr.map(d => {
                  const dayTotal = filteredEmployees.reduce((s, e) => s + empDayTotal(e.id, d), 0);
                  const isToday = d === today;
                  return (
                    <td key={d} className={`text-center px-1 py-2 text-xs text-muted-foreground border-l border-border/30 ${isToday ? 'bg-primary/10 text-primary font-bold' : ''}`}>
                      {dayTotal > 0 ? dayTotal : ''}
                    </td>
                  );
                })}
                <td className="sticky left-0 text-center px-2 py-2 text-primary bg-primary/5 border-r border-border z-10 font-bold">
                  {filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Cell Popover */}
      {cellPopover && (
        <CellPopover
          state={cellPopover}
          apps={apps}
          data={data}
          appColorsList={appColorsList}
          canEdit={permissions.can_edit}
          onApply={handlePopoverApply}
          onClose={() => setCellPopover(null)}
        />
      )}
    </div>
  );
};

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = () => {
  const { apps: appColorsList } = useAppColors();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('id, name, salary_type, status, sponsorship_status')
        .eq('status', 'active').not('sponsorship_status', 'in', '("absconded","terminated")').order('name'),
      supabase.from('apps').select('id, name, name_en').eq('is_active', true).order('name'),
    ]).then(([empRes, appRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as App[]);
    });
  }, []);

  useEffect(() => {
    const days = getDaysInMonth(year, month);
    setLoading(true);
    supabase.from('daily_orders')
      .select('employee_id, app_id, date, orders_count')
      .gte('date', dateStr(year, month, 1)).lte('date', dateStr(year, month, days))
      .then(({ data: rows }) => {
        const d: DailyData = {};
        rows?.forEach(r => {
          const day = new Date(r.date).getDate();
          d[`${r.employee_id}::${r.app_id}::${day}`] = r.orders_count;
        });
        setData(d);
        setLoading(false);
      });
  }, [year, month]);

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  const empTotal = (empId: string) => dayArr.reduce((s, d) =>
    s + apps.reduce((ss, a) => ss + (data[`${empId}::${a.id}::${d}`] ?? 0), 0), 0);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 font-semibold text-muted-foreground sticky right-0 bg-muted/30">المندوب</th>
                {apps.map(app => {
                  const c = getAppColor(appColorsList, app.name);
                  return (
                    <th key={app.id} className="text-center p-3 font-semibold min-w-[80px]"
                      style={{ backgroundColor: c.bg, color: c.text }}>
                      {app.name}
                    </th>
                  );
                })}
                <th className="text-center p-4 font-semibold text-primary min-w-[80px] bg-primary/5">الإجمالي</th>
                <th className="text-center p-4 font-semibold text-muted-foreground">متوسط يومي</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: apps.length + 3 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : employees.map(emp => {
                const total = empTotal(emp.id);
                const avg = total > 0 ? Math.round(total / days) : 0;
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 sticky right-0 bg-card">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{emp.name.charAt(0)}</div>
                        <span className="font-medium text-foreground whitespace-nowrap">{emp.name}</span>
                      </div>
                    </td>
                    {apps.map(app => {
                      const c = getAppColor(appColorsList, app.name);
                      const appTotal = dayArr.reduce((s, d) => s + (data[`${emp.id}::${app.id}::${d}`] ?? 0), 0);
                      return (
                        <td key={app.id} className="text-center p-3 font-semibold" style={{ color: appTotal > 0 ? c.val : undefined }}>
                          {appTotal > 0 ? appTotal : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      );
                    })}
                    <td className="p-4 text-center font-bold text-primary bg-primary/5">{total > 0 ? total : 0}</td>
                    <td className="p-4 text-center text-muted-foreground">{avg}</td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && employees.length > 0 && (
              <tfoot>
                <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                  <td className="p-4 sticky right-0 bg-muted/40 text-foreground">الإجمالي</td>
                  {apps.map(app => {
                    const c = getAppColor(appColorsList, app.name);
                    const appGrandTotal = employees.reduce((s, e) =>
                      s + dayArr.reduce((ss, d) => ss + (data[`${e.id}::${app.id}::${d}`] ?? 0), 0), 0);
                    return (
                      <td key={app.id} className="text-center p-3 font-bold" style={{ color: c.val }}>
                        {appGrandTotal > 0 ? appGrandTotal : '—'}
                      </td>
                    );
                  })}
                  <td className="p-4 text-center font-bold text-primary bg-primary/5">
                    {employees.reduce((s, e) => s + empTotal(e.id), 0)}
                  </td>
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
  const exportRef = useRef<HTMLInputElement>(null);

  const handleOrdersTemplate = () => {
    const headers = [['اسم الموظف', 'التطبيق', 'التاريخ (YYYY-MM-DD)', 'عدد الطلبات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_orders.xlsx');
  };

  return (
  <div className="space-y-3" dir="rtl">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>الطلبات اليومية</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} /> الطلبات اليومية
        </h1>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2"><Download size={15} /> 📥 تحميل ▾</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleOrdersTemplate}>📋 تحميل القالب</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <Tabs defaultValue="grid" dir="rtl">
      <TabsList>
        <TabsTrigger value="grid">📊 Grid الشهري</TabsTrigger>
        <TabsTrigger value="summary">ملخص الشهر</TabsTrigger>
      </TabsList>
      <TabsContent value="grid" className="mt-4"><SpreadsheetGrid /></TabsContent>
      <TabsContent value="summary" className="mt-4"><MonthSummary /></TabsContent>
    </Tabs>
  </div>
  );
};

export default Orders;
