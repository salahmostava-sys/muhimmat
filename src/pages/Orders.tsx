import { useState, useRef, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Search, Save, Package, Download, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { useAppColors } from '@/hooks/useAppColors';

// ─── Types ──────────────────────────────────────────────────────────
type Employee = { id: string; name: string; salary_type: string; status: string; sponsorship_status: string | null };
type App = { id: string; name: string; name_en: string | null };
type EmployeeApp = { employee_id: string; app_id: string; apps: { name: string } | null };
// key: `${empId}::${appId}::${day}`
type DailyData = Record<string, number>;

const getDaysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();
const monthLabel = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
const dateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;


// ─── SpreadsheetGrid ─────────────────────────────────────────────────
const SpreadsheetGrid = () => {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedApp, setSelectedApp] = useState('الكل');
  const [search, setSearch] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [employeeApps, setEmployeeApps] = useState<EmployeeApp[]>([]);
  const [data, setData] = useState<DailyData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<{ key: string } | null>(null);
  const [editVal, setEditVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch employees + apps once ──
  useEffect(() => {
    Promise.all([
      supabase.from('employees')
        .select('id, name, salary_type, status, sponsorship_status')
        .eq('status', 'active')
        .not('sponsorship_status', 'in', '("absconded","terminated")')
        .order('name'),
      supabase.from('apps').select('id, name, name_en').eq('is_active', true).order('name'),
      supabase.from('employee_apps').select('employee_id, app_id, apps(name)'),
    ]).then(([empRes, appRes, eaRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as App[]);
      if (eaRes.data) setEmployeeApps(eaRes.data as EmployeeApp[]);
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

  // ── Filtering ──
  const filteredEmployees = employees.filter(emp => {
    const matchSearch = emp.name.includes(search);
    const matchApp = selectedApp === 'الكل'
      ? true
      : employeeApps.some(ea => ea.employee_id === emp.id && ea.apps?.name === selectedApp);
    return matchSearch && matchApp;
  });

  // Apps to show as columns: when "الكل" → all apps, else single selected app
  const visibleApps = selectedApp === 'الكل'
    ? apps
    : apps.filter(a => a.name === selectedApp);

  const days = getDaysInMonth(year, month);
  const dayArr = Array.from({ length: days }, (_, i) => i + 1);

  const getVal = (empId: string, appId: string, day: number) =>
    data[`${empId}::${appId}::${day}`] ?? 0;

  const empDayTotal = (empId: string, day: number) =>
    visibleApps.reduce((s, a) => s + getVal(empId, a.id, day), 0);

  const empMonthTotal = (empId: string) =>
    dayArr.reduce((s, d) => s + empDayTotal(empId, d), 0);

  // ── Edit cell ──
  const startEdit = (key: string, cur: number) => {
    setEditing({ key });
    setEditVal(cur > 0 ? String(cur) : '');
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const val = Math.max(0, parseInt(editVal) || 0);
    setData(prev => ({ ...prev, [editing.key]: val }));
    setEditing(null);
  }, [editing, editVal]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditing(null);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

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
      if (error) {
        failed.push(...chunk.map(r => r.date));
      } else {
        saved += chunk.length;
      }
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

  const isMultiApp = selectedApp === 'الكل' && visibleApps.length > 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button onClick={prevMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronRight size={16} /></button>
          <span className="px-3 text-sm font-medium min-w-28 text-center">{monthLabel(year, month)}</span>
          <button onClick={nextMonth} className="p-1.5 rounded hover:bg-background transition-colors"><ChevronLeft size={16} /></button>
        </div>

        {/* App filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setSelectedApp('الكل')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedApp === 'الكل' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            الكل
          </button>
          {apps.map(app => {
            const c = appColor(app.name);
            const isActive = selectedApp === app.name;
            return (
              <button key={app.id} onClick={() => setSelectedApp(app.name)}
                style={isActive ? { backgroundColor: c.bg, color: c.text } : {}}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!isActive ? 'bg-muted text-muted-foreground hover:bg-accent' : ''}`}>
                {app.name}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="mr-auto flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel}><Download size={14} /> Excel</Button>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 size={14} className="animate-spin" /> جاري الحفظ...</> : <><Save size={14} /> حفظ</>}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">💡 انقر مرتين على أي خلية لتعديلها — Enter للحفظ، Esc للإلغاء</p>

      {/* Grid */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> جاري التحميل...
          </div>
        ) : (
          <table className="w-full border-collapse text-xs" style={{ minWidth: `${200 + (isMultiApp ? visibleApps.length * 80 : days * 44)}px` }}>
            <thead className="sticky top-0 z-20">
              {/* Row 1: fixed cols + day numbers (single app) or app headers (multi) */}
              <tr className="bg-muted/60 border-b border-border">
                <th className="sticky right-0 z-30 bg-muted/80 backdrop-blur text-right px-3 py-2.5 font-semibold text-foreground min-w-[180px] border-l border-border">المندوب</th>

                {isMultiApp ? (
                  // Multi-app: columns per app
                  <>
                    {visibleApps.map(app => {
                      const c = appColor(app.name);
                      return (
                        <th key={app.id} className="text-center px-2 py-2.5 font-semibold min-w-[80px] border-l border-border"
                          style={{ backgroundColor: c.bg, color: c.text }}>
                          {app.name}
                        </th>
                      );
                    })}
                    <th className="text-center px-2 py-2.5 font-semibold text-primary min-w-[70px] border-l border-border bg-primary/5">المجموع</th>
                  </>
                ) : (
                  // Single app or all with daily grid
                  <>
                    {dayArr.map(d => {
                      const dow = new Date(year, month - 1, d).getDay();
                      const isWeekend = dow === 5 || dow === 6;
                      return (
                        <th key={d} className={`text-center px-1 py-2.5 font-medium min-w-[40px] border-l border-border/30 ${isWeekend ? 'text-destructive bg-destructive/5' : 'text-muted-foreground'}`}>{d}</th>
                      );
                    })}
                    <th className="text-center px-2 py-2.5 font-semibold text-primary min-w-[70px] border-l border-border bg-primary/5">المجموع</th>
                  </>
                )}
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={isMultiApp ? visibleApps.length + 2 : days + 2} className="text-center py-12 text-muted-foreground">لا يوجد مناديب</td></tr>
              ) : filteredEmployees.map((emp, idx) => {
                const total = empMonthTotal(emp.id);
                return (
                  <tr key={emp.id} className={`border-b border-border/30 hover:bg-muted/20 ${idx % 2 === 0 ? '' : 'bg-muted/5'}`}>
                    {/* Name */}
                    <td className="sticky right-0 z-10 bg-card px-3 py-2 border-l border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold flex-shrink-0">{emp.name.charAt(0)}</div>
                        <span className="font-medium text-foreground truncate max-w-[130px]">{emp.name}</span>
                      </div>
                    </td>

                    {isMultiApp ? (
                      // Multi-app columns: monthly total per app
                      <>
                        {visibleApps.map(app => {
                          const c = appColor(app.name);
                          const appMonthTotal = dayArr.reduce((s, d) => s + getVal(emp.id, app.id, d), 0);
                          return (
                            <td key={app.id} className="text-center px-2 py-2 font-semibold border-l border-border/30" style={{ backgroundColor: c.cellBg, color: c.val }}>
                              {appMonthTotal > 0 ? appMonthTotal : <span className="text-muted-foreground/30">·</span>}
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-2 font-bold text-primary bg-primary/5 border-l border-border">{total}</td>
                      </>
                    ) : (
                      // Daily grid for selected single app (or default first app if only one)
                      <>
                        {dayArr.map(d => {
                          const appId = visibleApps[0]?.id ?? '';
                          const key = `${emp.id}::${appId}::${d}`;
                          const val = data[key] ?? 0;
                          const isEditing = editing?.key === key;
                          const dow = new Date(year, month - 1, d).getDay();
                          const isWeekend = dow === 5 || dow === 6;
                          const c = appId ? appColor(visibleApps[0]?.name ?? '') : { cellBg: '', val: 'inherit' };
                          return (
                            <td key={d}
                              className={`text-center p-0 border-l border-border/30 ${isWeekend ? 'bg-destructive/5' : ''}`}
                              onDoubleClick={() => !isWeekend && startEdit(key, val)}>
                              {isEditing ? (
                                <input ref={inputRef} type="number" min={0} value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onBlur={commitEdit} onKeyDown={handleKeyDown}
                                  className="w-full h-9 text-center bg-primary/10 border-2 border-primary outline-none text-sm font-medium" />
                              ) : (
                                <div className="h-9 flex items-center justify-center cursor-pointer hover:bg-muted/40 font-medium transition-colors"
                                  style={{ color: val > 0 ? c.val : undefined }}>
                                  {val > 0 ? val : <span className="text-muted-foreground/30">·</span>}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-center px-2 py-2 font-bold text-primary bg-primary/5 border-l border-border">{total}</td>
                      </>
                    )}
                  </tr>
                );
              })}

              {/* Footer totals */}
              <tr className="border-t-2 border-border bg-muted/30 font-semibold sticky bottom-0">
                <td className="sticky right-0 z-10 bg-muted/50 px-3 py-2 text-sm border-l border-border">الإجمالي</td>
                {isMultiApp ? (
                  <>
                    {visibleApps.map(app => {
                      const c = appColor(app.name);
                      const appTotal = filteredEmployees.reduce((s, e) => s + dayArr.reduce((ss, d) => ss + getVal(e.id, app.id, d), 0), 0);
                      return (
                        <td key={app.id} className="text-center px-2 py-2 border-l border-border/30 font-bold" style={{ color: c.val }}>
                          {appTotal > 0 ? appTotal : ''}
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-2 text-primary bg-primary/5 border-l border-border">
                      {filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
                    </td>
                  </>
                ) : (
                  <>
                    {dayArr.map(d => {
                      const appId = visibleApps[0]?.id ?? '';
                      const dayTotal = filteredEmployees.reduce((s, e) => s + getVal(e.id, appId, d), 0);
                      return (
                        <td key={d} className="text-center px-1 py-2 text-xs text-muted-foreground border-l border-border/30">
                          {dayTotal > 0 ? dayTotal : ''}
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-2 text-primary bg-primary/5 border-l border-border">
                      {filteredEmployees.reduce((s, e) => s + empMonthTotal(e.id), 0)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ─── Month Summary ─────────────────────────────────────────────────
const MonthSummary = () => {
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
                  const c = appColor(app.name);
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
                      const c = appColor(app.name);
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
                    const c = appColor(app.name);
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
const Orders = () => (
  <div className="space-y-6" dir="rtl">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <Package size={24} /> الطلبات اليومية
      </h1>
      <p className="text-sm text-muted-foreground mt-1">إدخال ومتابعة طلبات المناديب — Grid الشهري</p>
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

export default Orders;
