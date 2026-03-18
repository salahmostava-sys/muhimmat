import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Save, Package, Upload, Download, ChevronLeft, ChevronRight, Loader2, ChevronDown, ChevronUp, X, Check, Target, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { useAppColors, getAppColor } from '@/hooks/useAppColors';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguage } from '@/context/LanguageContext';

// ─── Types ──────────────────────────────────────────────────────────
type Employee = { id: string; name: string; salary_type: string; status: string; sponsorship_status: string | null };
type App = { id: string; name: string; name_en: string | null };
type DailyData = Record<string, number>;

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
const dateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const monthYear = (y: number, m: number) =>
  `${y}-${String(m).padStart(2, '0')}`;

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

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedEmp, setExpandedEmp] = useState<Set<string>>(new Set());
  const [cellPopover, setCellPopover] = useState<PopoverState | null>(null);

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

  useEffect(() => {
    const days = getDaysInMonth(year, month);
    const from = dateStr(year, month, 1);
    const to = dateStr(year, month, days);
    setLoading(true);
    supabase.from('daily_orders')
      .select('employee_id, app_id, date, orders_count')
      .gte('date', from).lte('date', to)
      .then(({ data: rows }) => {
        const d: DailyData = {};
        rows?.forEach(r => {
          const day = new Date(r.date + 'T00:00:00').getDate();
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

  const getVal = (empId: string, appId: string, day: number) => data[`${empId}::${appId}::${day}`] ?? 0;
  const getActiveApps = (empId: string) => apps.filter(app => dayArr.some(d => getVal(empId, app.id, d) > 0));
  const empDayTotal = (empId: string, day: number) => apps.reduce((s, a) => s + getVal(empId, a.id, day), 0);
  const empMonthTotal = (empId: string) => dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0);
  const empAppMonthTotal = (empId: string, appId: string) => dayArr.reduce((s, d) => s + getVal(empId, appId, d), 0);

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
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPopover({ empId, day, x: rect.left, y: rect.bottom });
  }, []);

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

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    const rows: { employee_id: string; app_id: string; date: string; orders_count: number }[] = [];
    Object.entries(data).forEach(([key, count]) => {
      const [empId, appId, dayStr] = key.split('::');
      const day = parseInt(dayStr);
      if (!isNaN(day) && day >= 1 && day <= days)
        rows.push({ employee_id: empId, app_id: appId, date: dateStr(year, month, day), orders_count: count });
    });
    const CHUNK = 200;
    let saved = 0;
    const failed: string[] = [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from('daily_orders').upsert(chunk, { onConflict: 'employee_id,app_id,date' });
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

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Controls bar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="mr-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportExcel}>
            <Download size={14} /> تصدير
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={() => importRef.current?.click()}>
            <Upload size={14} /> استيراد
          </Button>
          {permissions.can_edit && (
            <Button size="sm" className="gap-1.5 h-9" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 size={14} className="animate-spin" /> جاري الحفظ...</> : <><Save size={14} /> حفظ</>}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex-shrink-0">
        💡 انقر على أي خلية يوم لإدخال الطلبات حسب المنصة — السهم لعرض تفاصيل المنصات
      </p>

      {/* Grid — flex-1 fills remaining space, internal scroll only */}
      <div
        className="bg-card rounded-xl border border-border shadow-sm overflow-auto flex-1 min-h-0"
        onScroll={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <table className="border-collapse text-xs" style={{ minWidth: `${220 + days * 44 + 80}px`, width: '100%' }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/90 border-b-2 border-border">
                <th className="sticky right-0 z-30 bg-muted/95 text-right px-3 py-2.5 font-semibold text-foreground border-l-2 border-border"
                  style={{ minWidth: 220 }}>
                  المندوب / المنصة
                </th>
                {dayArr.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isWeekend = dow === 5 || dow === 6;
                  const isThursday = dow === 4;
                  const isToday = d === today;
                  return (
                    <th key={d}
                      className={`text-center px-1 py-2.5 font-medium border-l border-border/50
                        ${isToday ? 'bg-primary/20 text-primary font-bold' : isWeekend ? 'text-muted-foreground/50 bg-muted/40' : isThursday ? 'text-muted-foreground/70 bg-muted/20' : 'text-muted-foreground'}`}
                      style={{ minWidth: 42 }}>
                      {d}
                    </th>
                  );
                })}
                <th className="sticky left-0 z-30 text-center py-2.5 font-bold text-primary bg-primary/15 border-r-2 border-border"
                  style={{ minWidth: 72 }}>
                  المجموع
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={days + 2} className="text-center py-12 text-muted-foreground">لا يوجد مناديب</td></tr>
              ) : filteredEmployees.map((emp, idx) => {
                const activeApps = getActiveApps(emp.id);
                const isExpanded = expandedEmp.has(emp.id);
                const total = empMonthTotal(emp.id);
                const rowBg = idx % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.15)';

                return (
                  <React.Fragment key={emp.id}>
                    <tr className={`border-b border-border/40 select-none ${isExpanded ? 'border-b-0' : ''}`}>
                      <td
                        className="sticky right-0 z-10 px-3 py-2 border-l-2 border-border cursor-pointer hover:bg-muted/30 transition-colors"
                        style={{ backgroundColor: isExpanded ? 'hsl(var(--primary)/0.07)' : rowBg, minWidth: 220 }}
                        onClick={() => activeApps.length > 0 && toggleExpand(emp.id)}
                      >
                        <div className="flex items-center gap-1.5">
                          {activeApps.length > 0 && (
                            <span className="text-muted-foreground flex-shrink-0">
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          )}
                          <span className="font-medium text-foreground truncate max-w-[140px]">{emp.name}</span>
                        </div>
                        {activeApps.length > 0 && (
                          <div className="flex gap-0.5 flex-wrap mt-0.5 pr-7">
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
                      </td>

                      {dayArr.map(d => {
                        const val = empDayTotal(emp.id, d);
                        const dow = new Date(year, month - 1, d).getDay();
                        const isWeekend = dow === 5 || dow === 6;
                        const isThursday = dow === 4;
                        const isToday = d === today;
                        const isOpen = cellPopover?.empId === emp.id && cellPopover?.day === d;
                        const dayApps = apps.filter(a => getVal(emp.id, a.id, d) > 0);

                        return (
                          <td key={d}
                            className={`text-center p-0 border-l border-border/30 transition-colors
                              ${isToday ? 'bg-primary/10' : isWeekend ? 'bg-muted/20' : isThursday ? 'bg-muted/10' : ''}
                              ${isOpen ? 'ring-2 ring-inset ring-primary' : ''}
                              ${permissions.can_edit ? 'cursor-pointer hover:bg-primary/5' : ''}`}
                            style={{ minWidth: 42 }}
                            onClick={e => handleCellClick(e, emp.id, d)}
                          >
                            <div className="h-9 flex flex-col items-center justify-center gap-0">
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
                        className="sticky left-0 z-10 text-center px-2 py-2 font-bold text-primary border-r-2 border-border"
                        style={{ minWidth: 72, backgroundColor: 'hsl(var(--primary) / 0.12)' }}
                      >
                        {total > 0 ? total : <span className="text-muted-foreground/30">0</span>}
                      </td>
                    </tr>

                    {isExpanded && activeApps.map(app => {
                      const c = getAppColor(appColorsList, app.name);
                      const appTotal = empAppMonthTotal(emp.id, app.id);
                      return (
                        <tr key={`${emp.id}-${app.id}`} className="border-b border-border/20" style={{ backgroundColor: c.cellBg }}>
                          <td className="sticky right-0 z-10 px-3 py-1.5 border-l-2 border-border" style={{ backgroundColor: c.cellBg, minWidth: 220 }}>
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
                              <td key={d} className={`text-center p-0 border-l border-border/20 ${isToday ? 'bg-primary/5' : isWeekend ? 'opacity-70' : ''}`} style={{ minWidth: 42 }}>
                                <div className="h-7 flex items-center justify-center font-medium text-xs" style={{ color: val > 0 ? c.val : undefined }}>
                                  {val > 0 ? val : <span className="text-muted-foreground/20">·</span>}
                                </div>
                              </td>
                            );
                          })}
                          <td className="sticky left-0 z-10 text-center px-2 py-1.5 font-bold border-r-2 border-border text-xs" style={{ backgroundColor: c.cellBg, color: c.val, minWidth: 72 }}>
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
                <td className="sticky right-0 z-10 px-3 py-2.5 text-sm font-bold border-l-2 border-border text-foreground"
                  style={{ backgroundColor: 'hsl(var(--muted) / 0.8)', minWidth: 220 }}>
                  الإجمالي
                </td>
                {dayArr.map(d => {
                  const dayTotal = filteredEmployees.reduce((s, e) => s + empDayTotal(e.id, d), 0);
                  const isToday = d === today;
                  return (
                    <td key={d} className={`text-center px-1 py-2.5 font-bold border-l border-border/40 ${isToday ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                      style={{ minWidth: 42, backgroundColor: isToday ? undefined : 'hsl(var(--muted) / 0.4)' }}>
                      {dayTotal > 0 ? dayTotal : <span className="text-muted-foreground/30">—</span>}
                    </td>
                  );
                })}
                <td className="sticky left-0 z-10 text-center px-2 py-2.5 font-bold text-sm text-primary border-r-2 border-border"
                  style={{ backgroundColor: 'hsl(var(--primary) / 0.2)', minWidth: 72 }}>
                  {filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {cellPopover && (
        <CellPopover
          state={cellPopover} apps={apps} data={data} appColorsList={appColorsList}
          canEdit={permissions.can_edit} onApply={handlePopoverApply} onClose={() => setCellPopover(null)}
        />
      )}
    </div>
  );
};

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = () => {
  const { apps: appColorsList } = useAppColors();
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);

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

  // Load targets when month changes
  useEffect(() => {
    const my = monthYear(year, month);
    supabase.from('app_targets' as any).select('app_id, target_orders').eq('month_year', my)
      .then(({ data: rows }) => {
        if (rows) {
          const t: Record<string, string> = {};
          (rows as any[]).forEach(r => { t[r.app_id] = String(r.target_orders); });
          setTargets(t);
        }
      });
  }, [year, month]);

  useEffect(() => {
    const days = getDaysInMonth(year, month);
    setLoading(true);
    supabase.from('daily_orders')
      .select('employee_id, app_id, date, orders_count')
      .gte('date', dateStr(year, month, 1)).lte('date', dateStr(year, month, days))
      .then(({ data: rows }) => {
        const d: DailyData = {};
        rows?.forEach(r => {
          const day = new Date(r.date + 'T00:00:00').getDate();
          d[`${r.employee_id}::${r.app_id}::${day}`] = r.orders_count;
        });
        setData(d);
        setLoading(false);
      });
  }, [year, month]);

  const saveTarget = async (appId: string, value: string) => {
    const targetOrders = parseInt(value) || 0;
    const my = monthYear(year, month);
    setSavingTarget(appId);
    const { error } = await supabase.from('app_targets' as any).upsert(
      { app_id: appId, month_year: my, target_orders: targetOrders },
      { onConflict: 'app_id,month_year' }
    );
    setSavingTarget(null);
    if (error) toast({ title: 'خطأ في حفظ التارجت', variant: 'destructive' });
    else toast({ title: '✅ تم حفظ التارجت' });
  };

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  const empTotal = (empId: string) =>
    dayArr.reduce((s, d) => s + apps.reduce((ss, a) => ss + (data[`${empId}::${a.id}::${d}`] ?? 0), 0), 0);

  const appGrandTotal = (appId: string) =>
    employees.reduce((s, e) => s + dayArr.reduce((ss, d) => ss + (data[`${e.id}::${appId}::${d}`] ?? 0), 0), 0);

  const grandTotal = employees.reduce((s, e) => s + empTotal(e.id), 0);

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
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border bg-muted/40">
                <th className="text-center p-3 font-semibold text-muted-foreground w-10">#</th>
                <th className="text-right p-3 font-semibold text-foreground min-w-[160px]">المندوب</th>
                {apps.map(app => {
                  const c = getAppColor(appColorsList, app.name);
                  return (
                    <th key={app.id} className="text-center p-3 font-semibold min-w-[90px] border-l border-border/50"
                      style={{ backgroundColor: `${c.bg}22`, color: c.val }}>
                      {app.name}
                    </th>
                  );
                })}
                <th className="text-center p-3 font-semibold text-primary min-w-[80px] border-l border-border">الإجمالي</th>
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
              ) : employees.map((emp, idx) => {
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
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex-shrink-0">
        <nav className="page-breadcrumb">
          <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>{lang === 'ar' ? 'الطلبات اليومية' : 'Daily Orders'}</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <Package size={18} /> {lang === 'ar' ? 'الطلبات اليومية' : 'Daily Orders'}
        </h1>
      </div>

      <Tabs defaultValue="grid" dir="rtl" className="flex-1 flex flex-col min-h-0">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="grid">📊 Grid الشهري</TabsTrigger>
          <TabsTrigger value="summary">ملخص الشهر</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="mt-4 flex-1 flex flex-col min-h-0"><SpreadsheetGrid /></TabsContent>
        <TabsContent value="summary" className="mt-4 overflow-auto"><MonthSummary /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Orders;
