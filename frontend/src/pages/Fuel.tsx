import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search, Plus, Upload, Download, FolderOpen, Edit2, Trash2,
  Fuel, TrendingUp, DollarSign, Package,
  X, Check, Activity, Calendar, BarChart3, ChevronDown, ChevronUp,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fuelService } from '@/services/fuelService';
import { usePermissions } from '@/hooks/usePermissions';
import * as XLSX from '@e965/xlsx';
import { format, endOfMonth } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyRow = {
  id: string;
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
  employee?: { name: string; personal_photo_url?: string | null };
};

type MonthlyRow = {
  employee_id: string;
  employee_name: string;
  personal_photo_url?: string | null;
  km_total: number;
  fuel_cost: number;
  orders_count: number;
  vehicle?: { plate_number: string; type: string; brand?: string | null; model?: string | null } | null;
  daily_count: number;
};

type Employee = { id: string; name: string; personal_photo_url?: string | null };
type AppRow = { id: string; name: string };
type DailyMileageResponseRow = DailyRow & { employees?: Employee };

type ImportRow = {
  raw_name: string;
  km_total: number;
  fuel_cost: number;
  notes?: string;
  matched_employee?: Employee | null;
  manual_employee_id?: string;
};

/** Daily fuel/km — table public.vehicle_mileage_daily (not fuel_logs) */
async function saveVehicleMileageDaily(
  payload: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null },
  editId?: string
) {
  return fuelService.upsertDailyMileage(payload, editId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  { v: '01', l: 'يناير' }, { v: '02', l: 'فبراير' }, { v: '03', l: 'مارس' },
  { v: '04', l: 'أبريل' }, { v: '05', l: 'مايو' }, { v: '06', l: 'يونيو' },
  { v: '07', l: 'يوليو' }, { v: '08', l: 'أغسطس' }, { v: '09', l: 'سبتمبر' },
  { v: '10', l: 'أكتوبر' }, { v: '11', l: 'نوفمبر' }, { v: '12', l: 'ديسمبر' },
];

const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const costPerKmColor = (v: number | null) => {
  if (v === null || v === 0) return 'text-muted-foreground';
  if (v < 0.20) return 'text-success font-semibold';
  if (v <= 0.35) return 'text-warning font-semibold';
  return 'text-destructive font-semibold';
};

const fuelPerOrderBadge = (v: number | null) => {
  if (v === null || !isFinite(v)) return null;
  if (v < 0.5) return <span className="badge-success">ممتاز</span>;
  if (v <= 1.0) return <span className="badge-warning">متوسط</span>;
  return <span className="badge-urgent">مرتفع</span>;
};

const StatCard = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) => (
  <div className="bg-card rounded-xl shadow-card p-5 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Import Modal (GPS monthly) ───────────────────────────────────────────────
const ImportModal = ({
  employees, monthYear, onClose, onImported,
}: {
  employees: Employee[];
  monthYear: string;
  onClose: () => void;
  onImported: () => void;
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState({ name: '', km: '', fuel: '__none__', notes: '__none__' });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
      if (!data.length) return toast({ title: 'الملف فارغ', variant: 'destructive' });
      setHeaders(Object.keys(data[0]));
      setRawData(data);
      setStep(2);
    };
    reader.readAsBinaryString(file);
  };

  const buildPreview = () => {
    if (!mapping.name || !mapping.km) return toast({ title: 'حدد عمود الاسم والكيلومترات', variant: 'destructive' });
    const preview: ImportRow[] = rawData.map(r => {
      const raw_name = String(r[mapping.name] || '').trim();
      const km_total = parseFloat(String(r[mapping.km] || 0)) || 0;
      const fuel_cost = mapping.fuel && mapping.fuel !== '__none__' ? parseFloat(String(r[mapping.fuel] || 0)) || 0 : 0;
      const notes = mapping.notes && mapping.notes !== '__none__' ? String(r[mapping.notes] || '') : '';
      const exact = employees.find(e => e.name === raw_name);
      const partial = !exact ? employees.find(e => e.name.includes(raw_name) || raw_name.includes(e.name)) : null;
      return { raw_name, km_total, fuel_cost, notes, matched_employee: exact || partial || null };
    }).filter(r => r.raw_name);
    setRows(preview);
    setStep(3);
  };

  const matched = rows.filter(r => r.matched_employee || r.manual_employee_id).length;

  const doImport = async () => {
    const toSave = rows.filter(r => r.matched_employee || r.manual_employee_id);
    if (!toSave.length) return toast({ title: 'لا توجد سجلات للاستيراد', variant: 'destructive' });
    setSaving(true);
    const payload = toSave.map(r => ({
      employee_id: r.manual_employee_id || r.matched_employee!.id,
      month_year: monthYear,
      km_total: r.km_total,
      fuel_cost: r.fuel_cost,
      notes: r.notes || null,
    }));
    const { error } = await fuelService.saveMonthlyMileageImport(payload, replaceExisting);
    setSaving(false);
    if (error) return toast({ title: 'خطأ في الاستيراد', description: error.message, variant: 'destructive' });
    toast({ title: `تم استيراد ${payload.length} سجل بنجاح` });
    onImported();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">استيراد كيلومترات GPS (شهري)</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border/50 shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{s}</div>
              <span className="text-xs text-muted-foreground">{s === 1 ? 'رفع الملف' : s === 2 ? 'ربط الأعمدة' : 'معاينة وتأكيد'}</span>
              {s < 3 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <div className="text-4xl mb-3">📂</div>
              <p className="font-medium text-foreground">اضغط لرفع ملف Excel أو CSV</p>
              <p className="text-sm text-muted-foreground mt-1">ملف GPS يحتوي على أسماء المناديب والكيلومترات</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">تم اكتشاف <strong>{headers.length}</strong> عمود و <strong>{rawData.length}</strong> صف.</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'name' as const, label: 'عمود اسم المندوب', required: true },
                  { key: 'km' as const, label: 'عمود الكيلومترات', required: true },
                  { key: 'fuel' as const, label: 'عمود تكلفة البنزين', required: false },
                  { key: 'notes' as const, label: 'عمود الملاحظات', required: false },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-sm mb-1.5 block">{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                    <Select
                      value={mapping[f.key]}
                      onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={f.required ? 'مطلوب' : 'اختياري'} /></SelectTrigger>
                      <SelectContent>
                        {!f.required && <SelectItem value="__none__">— لا يوجد —</SelectItem>}
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={buildPreview} className="w-full">التالي: معاينة البيانات</Button>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="badge-success">{matched} متطابق</span>
                <span className="badge-warning">{rows.length - matched} يحتاج مراجعة</span>
                <label className="flex items-center gap-1.5 ms-auto text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} />
                  استبدال البيانات الموجودة
                </label>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground">الاسم في الملف</th>
                      <th className="px-3 py-2 text-start text-xs text-muted-foreground">المندوب المطابق</th>
                      <th className="px-3 py-2 text-xs text-muted-foreground">كم</th>
                      <th className="px-3 py-2 text-xs text-muted-foreground">بنزين</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const emp = row.manual_employee_id ? employees.find(e => e.id === row.manual_employee_id) : row.matched_employee;
                      const isMatched = !!emp;
                      return (
                        <tr key={i} className={`border-t border-border/30 ${isMatched ? '' : 'bg-warning/5'}`}>
                          <td className="px-3 py-2 font-medium">{row.raw_name}</td>
                          <td className="px-3 py-2">
                            {isMatched ? (
                              <span className="text-success text-xs flex items-center gap-1"><Check size={11} /> {emp!.name}</span>
                            ) : (
                              <Select value={row.manual_employee_id || ''} onValueChange={v => setRows(rs => rs.map((r, j) => j === i ? { ...r, manual_employee_id: v } : r))}>
                                <SelectTrigger className="h-7 text-xs border-warning/50"><SelectValue placeholder="اختر يدوياً..." /></SelectTrigger>
                                <SelectContent className="max-h-48">
                                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{row.km_total}</td>
                          <td className="px-3 py-2 text-center">{row.fuel_cost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        {step === 3 && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button onClick={doImport} disabled={saving || matched === 0} className="w-full gap-2">
              {saving ? 'جاري الاستيراد...' : <><Check size={15} /> تأكيد استيراد {matched} سجل</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const FuelPage = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('fuel');
  const now = new Date();
  const [view, setView] = useState<'monthly' | 'daily'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'MM'));
  const [selectedYear, setSelectedYear] = useState(format(now, 'yyyy'));
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('_all_');
  const [platformTab, setPlatformTab] = useState<'all' | string>('all');

  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [employeeAppLinks, setEmployeeAppLinks] = useState<{ employee_id: string; app_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [expandedRider, setExpandedRider] = useState<string | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ employee_id: '', date: '', km_total: '', fuel_cost: '', notes: '' });
  const [editingDaily, setEditingDaily] = useState<{ id: string; km_total: string; fuel_cost: string; notes: string } | null>(null);

  const monthYear = `${selectedYear}-${selectedMonth}`;
  const monthStart = `${monthYear}-01`;
  const monthEnd = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');
  const defaultEntryDate = todayStr >= monthStart && todayStr <= monthEnd ? todayStr : monthStart;

  const employeeIdsOnPlatform = useMemo(() => {
    if (platformTab === 'all') return null;
    const set = new Set<string>();
    employeeAppLinks.forEach(l => {
      if (l.app_id === platformTab) set.add(l.employee_id);
    });
    return set;
  }, [platformTab, employeeAppLinks]);

  const ridersForTab = useMemo(() => {
    let list = employees;
    if (employeeIdsOnPlatform) {
      list = employees.filter(e => employeeIdsOnPlatform.has(e.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [employees, employeeIdsOnPlatform, search]);

  useEffect(() => {
    Promise.all([
      fuelService.getActiveEmployees(),
      fuelService.getActiveApps(),
      fuelService.getActiveEmployeeAppLinks(),
    ]).then(([empRes, appRes, linkRes]) => {
      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (appRes.data) setApps(appRes.data as AppRow[]);
      if (linkRes.data) setEmployeeAppLinks(linkRes.data as { employee_id: string; app_id: string }[]);
    });
  }, []);

  useEffect(() => {
    setNewEntry(ne => ({ ...ne, date: defaultEntryDate }));
  }, [monthYear, defaultEntryDate]);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    const ms = `${monthYear}-01`;
    const me = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
    const [dailyRes, ordersRes, assignmentsRes] = await Promise.all([
      fuelService.getMonthlyDailyMileage(ms, me),
      fuelService.getMonthlyOrders(ms, me),
      fuelService.getActiveVehicleAssignments(),
    ]);

    const orderMap: Record<string, number> = {};
    (ordersRes.data || []).forEach((o: { employee_id: string; orders_count: number }) => {
      orderMap[o.employee_id] = (orderMap[o.employee_id] || 0) + o.orders_count;
    });

    const vehicleMap: Record<string, { plate_number: string; type: string; brand?: string | null; model?: string | null }> = {};
    (assignmentsRes.data || []).forEach((a: { employee_id: string; vehicles?: { plate_number: string; type: string; brand?: string | null; model?: string | null } }) => {
      if (!vehicleMap[a.employee_id] && a.vehicles) vehicleMap[a.employee_id] = a.vehicles;
    });

    const aggMap: Record<string, { km: number; fuel: number; count: number; name: string; photo?: string | null }> = {};
    (dailyRes.data || []).forEach((r: {
      employee_id: string; km_total: number; fuel_cost: number;
      employees?: { name: string; personal_photo_url?: string | null };
    }) => {
      if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(r.employee_id)) return;
      const emp = r.employees;
      if (!aggMap[r.employee_id]) {
        aggMap[r.employee_id] = { km: 0, fuel: 0, count: 0, name: emp?.name || '', photo: emp?.personal_photo_url };
      }
      aggMap[r.employee_id].km += Number(r.km_total) || 0;
      aggMap[r.employee_id].fuel += Number(r.fuel_cost) || 0;
      aggMap[r.employee_id].count += 1;
    });

    const rows: MonthlyRow[] = Object.entries(aggMap).map(([emp_id, agg]) => ({
      employee_id: emp_id,
      employee_name: agg.name,
      personal_photo_url: agg.photo,
      km_total: agg.km,
      fuel_cost: agg.fuel,
      orders_count: orderMap[emp_id] || 0,
      vehicle: vehicleMap[emp_id] || null,
      daily_count: agg.count,
    })).sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'ar'));

    setMonthlyRows(rows);
    setLoading(false);
  }, [monthYear, employeeIdsOnPlatform]);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    const ms = `${monthYear}-01`;
    const me = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');
    const { data, error } = await fuelService.getDailyMileageByMonth(ms, me);
    if (error) {
      toast({ title: 'خطأ في جلب البيانات', description: error.message, variant: 'destructive' });
    }
    let mapped = ((data || []) as DailyMileageResponseRow[]).map((r) => ({ ...r, employee: r.employees as Employee | undefined }));
    if (selectedEmployee && selectedEmployee !== '_all_') {
      mapped = mapped.filter((r) => r.employee_id === selectedEmployee);
    } else if (employeeIdsOnPlatform) {
      const ids = Array.from(employeeIdsOnPlatform);
      if (ids.length === 0) {
        setDailyRows([]);
        setLoading(false);
        return;
      }
      mapped = mapped.filter((r) => ids.includes(r.employee_id));
    }
    setDailyRows(mapped as DailyRow[]);
    setLoading(false);
  }, [monthYear, selectedEmployee, employeeIdsOnPlatform, toast]);

  useEffect(() => {
    if (view === 'monthly') fetchMonthly();
    else fetchDaily();
  }, [view, fetchMonthly, fetchDaily]);

  const refresh = () => {
    if (view === 'monthly') fetchMonthly();
    else fetchDaily();
  };

  const handleDeleteDaily = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    const { error } = await fuelService.deleteDailyMileage(id);
    if (error) return toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    toast({ title: 'تم الحذف' });
    fetchDaily();
    fetchMonthly();
  };

  const submitNewEntry = async () => {
    if (!permissions.can_edit) return;
    if (!newEntry.employee_id) return toast({ title: 'اختر المندوب', variant: 'destructive' });
    if (!newEntry.date) return toast({ title: 'اختر التاريخ', variant: 'destructive' });
    const km = parseFloat(newEntry.km_total) || 0;
    const fuel = parseFloat(newEntry.fuel_cost) || 0;
    if (!km && !fuel) return toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' });
    if (employeeIdsOnPlatform && !employeeIdsOnPlatform.has(newEntry.employee_id)) {
      return toast({ title: 'المندوب غير مسجّل على هذه المنصة', variant: 'destructive' });
    }
    setSavingEntry(true);
    const { error } = await saveVehicleMileageDaily({
      employee_id: newEntry.employee_id,
      date: newEntry.date,
      km_total: km,
      fuel_cost: fuel,
      notes: newEntry.notes.trim() || null,
    });
    setSavingEntry(false);
    if (error) return toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    toast({ title: 'تم الحفظ بنجاح' });
    setNewEntry(ne => ({ ...ne, km_total: '', fuel_cost: '', notes: '' }));
    refresh();
  };

  const saveEditedDaily = async (row: DailyRow) => {
    if (!permissions.can_edit || !editingDaily) return;
    const km = parseFloat(editingDaily.km_total) || 0;
    const fuel = parseFloat(editingDaily.fuel_cost) || 0;
    if (!km && !fuel) return toast({ title: 'أدخل الكيلومترات أو تكلفة البنزين', variant: 'destructive' });
    setSavingEntry(true);
    const { error } = await saveVehicleMileageDaily(
      {
        employee_id: row.employee_id,
        date: row.date,
        km_total: km,
        fuel_cost: fuel,
        notes: editingDaily.notes.trim() || null,
      },
      row.id
    );
    setSavingEntry(false);
    if (error) return toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    toast({ title: 'تم تحديث السجل' });
    setEditingDaily(null);
    refresh();
  };

  const filteredMonthly = monthlyRows.filter(r =>
    !search || r.employee_name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDaily = dailyRows.filter(r =>
    !search || (r.employee?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalKm = filteredMonthly.reduce((s, r) => s + r.km_total, 0);
  const totalFuel = filteredMonthly.reduce((s, r) => s + r.fuel_cost, 0);
  const avgCostPerKm = totalKm > 0 ? totalFuel / totalKm : 0;
  const totalOrders = filteredMonthly.reduce((s, r) => s + r.orders_count, 0);

  const dailyTotalKm = filteredDaily.reduce((s, r) => s + r.km_total, 0);
  const dailyTotalFuel = filteredDaily.reduce((s, r) => s + r.fuel_cost, 0);

  const tableRef = useRef<HTMLTableElement>(null);
  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  const handleExportMonthly = () => {
    const data = filteredMonthly.map(r => ({
      'الاسم': r.employee_name,
      'أيام مسجّلة': r.daily_count,
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'تكلفة/كم (ر.س)': r.km_total > 0 ? (r.fuel_cost / r.km_total).toFixed(3) : '',
      'عدد الطلبات': r.orders_count,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ملخص شهري');
    XLSX.writeFile(wb, `ملخص_الاستهلاك_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const handleExportDaily = () => {
    const data = filteredDaily.map(r => ({
      'التاريخ': r.date,
      'اليوم': DAY_NAMES[new Date(r.date + 'T12:00:00').getDay()],
      'الاسم': r.employee?.name || '',
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'ملاحظات': r.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'إدخالات يومية');
    XLSX.writeFile(wb, `إدخالات_يومية_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const dailyForRider = (empId: string) =>
    filteredDaily.filter(r => r.employee_id === empId).sort((a, b) => b.date.localeCompare(a.date));

  const riderMonthKm = (empId: string) => dailyForRider(empId).reduce((s, r) => s + (Number(r.km_total) || 0), 0);
  const riderMonthFuel = (empId: string) => dailyForRider(empId).reduce((s, r) => s + (Number(r.fuel_cost) || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>بيانات الاستهلاك</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">بيانات الاستهلاك</h1>
              <p className="text-sm text-muted-foreground">الوقود والكيلومترات — يومي وشهري (vehicle_mileage_daily)</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setView('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <BarChart3 size={13} /> عرض شهري
            </button>
            <button
              type="button"
              onClick={() => setView('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === 'daily' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Calendar size={13} /> عرض يومي
            </button>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground font-medium">المنصة:</span>
        <button
          type="button"
          onClick={() => setPlatformTab('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${platformTab === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/50'}`}
        >
          الكل
        </button>
        {apps.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setPlatformTab(a.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${platformTab === a.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted/50'}`}
          >
            {a.name}
          </button>
        ))}
      </div>

      {view === 'monthly' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={totalKm.toLocaleString()} sub="كم هذا الشهر" />
            <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${totalFuel.toLocaleString()} ر.س`} sub="هذا الشهر" />
            <StatCard icon={<DollarSign size={22} />} label="متوسط تكلفة الكيلومتر" value={avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س` : '—'} sub="ر.س / كم" />
            <StatCard icon={<Package size={22} />} label="إجمالي الطلبات" value={totalOrders.toLocaleString()} sub="من الطلبات اليومية" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث باسم المندوب..." className="ps-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportMonthly}>📊 تصدير Excel (ملخص شهري)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const headers = [['اسم المندوب', 'الكيلومترات', 'تكلفة البنزين (ر.س)', 'ملاحظات']];
                  const ws = XLSX.utils.aoa_to_sheet(headers);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'قالب');
                  XLSX.writeFile(wb, 'template_fuel.xlsx');
                }}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowImport(true)}>
                  <Upload size={14} className="ml-2" /> استيراد GPS شهري
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="bg-card rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table ref={tableRef} className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">المندوب</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">أيام مسجّلة</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">الكيلومترات</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">تكلفة البنزين</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">تكلفة/كم</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">الدباب 🏍️</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">عدد الطلبات 📦</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">بنزين/طلب</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/30">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/60 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredMonthly.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <span className="text-4xl">⛽</span>
                          <p className="font-medium">لا توجد بيانات لهذا الشهر</p>
                          <p className="text-xs">أضف إدخالات يومية من عرض يومي أو غيّر المنصة/البحث</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredMonthly.map(row => {
                        const costPerKm = row.km_total > 0 ? row.fuel_cost / row.km_total : null;
                        const fuelPerOrder = row.orders_count > 0 ? row.fuel_cost / row.orders_count : null;
                        return (
                          <tr key={row.employee_id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {row.personal_photo_url && (
                                  <img src={row.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                                )}
                                <span className="font-medium text-foreground">{row.employee_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{row.daily_count} يوم</span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-primary">{row.km_total.toLocaleString()} كم</td>
                            <td className="px-4 py-3 text-center font-medium" style={{ color: 'hsl(var(--warning))' }}>{row.fuel_cost.toLocaleString()} ر.س</td>
                            <td className={`px-4 py-3 text-center ${costPerKmColor(costPerKm)}`}>
                              {costPerKm !== null ? `${costPerKm.toFixed(3)} ر.س/كم` : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.vehicle ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs font-semibold text-foreground">
                                    {row.vehicle.type === 'motorcycle' ? '🏍️' : '🚗'} {row.vehicle.plate_number}
                                  </span>
                                  {(row.vehicle.brand || row.vehicle.model) && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {[row.vehicle.brand, row.vehicle.model].filter(Boolean).join(' ')}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.orders_count > 0
                                ? <span className="font-semibold text-foreground">{row.orders_count.toLocaleString()}</span>
                                : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs text-muted-foreground">{fuelPerOrder !== null ? `${fuelPerOrder.toFixed(2)} ر.س` : '—'}</span>
                                {fuelPerOrderBadge(fuelPerOrder)}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployee(row.employee_id);
                                  setView('daily');
                                  setExpandedRider(row.employee_id);
                                }}
                                className="text-xs text-primary hover:underline"
                              >
                                الأيام ←
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
                        <td className="px-4 py-3 text-foreground">الإجمالي ({filteredMonthly.length} مندوب)</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-center text-primary">{totalKm.toLocaleString()} كم</td>
                        <td className="px-4 py-3 text-center" style={{ color: 'hsl(var(--warning))' }}>{totalFuel.toLocaleString()} ر.س</td>
                        <td className={`px-4 py-3 text-center ${costPerKmColor(avgCostPerKm)}`}>
                          {avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س/كم` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">—</td>
                        <td className="px-4 py-3 text-center">{totalOrders.toLocaleString()}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {totalOrders > 0 ? `${(totalFuel / totalOrders).toFixed(2)} ر.س` : '—'}
                        </td>
                        <td />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'daily' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={<Calendar size={22} />} label="إجمالي الإدخالات" value={String(filteredDaily.length)} sub="سجل في هذا الشهر" />
            <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={dailyTotalKm.toLocaleString()} sub="كم" />
            <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${dailyTotalFuel.toLocaleString()} ر.س`} sub="هذا الشهر" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث باسم المندوب..." className="ps-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="كل المناديب" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="_all_">كل المناديب (المنصة)</SelectItem>
                {ridersForTab.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleExportDaily}>
              <Download size={14} /> تصدير Excel
            </Button>
          </div>

          {/* Riders + expandable daily + bottom inline add */}
          <div className="bg-card rounded-xl shadow-card overflow-hidden border border-border/50">
            <div className="px-4 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
              مناديب المنصة المختارة — اضغط السهم لعرض السجلات اليومية وإضافة إدخال من الصف السفلي.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="w-10 px-2 py-2" />
                    <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">المندوب</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">كم (الشهر)</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">بنزين (الشهر)</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">جاري التحميل...</td></tr>
                  ) : ridersForTab.length === 0 ? (
                    <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">لا يوجد مناديب على هذه المنصة</td></tr>
                  ) : (
                    ridersForTab.map(emp => {
                      const open = expandedRider === emp.id;
                      const days = dailyForRider(emp.id);
                      return (
                        <React.Fragment key={emp.id}>
                          <tr className="border-b border-border/30 hover:bg-muted/10">
                            <td className="px-2 py-2 text-center">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-muted"
                                onClick={() => setExpandedRider(open ? null : emp.id)}
                                aria-expanded={open}
                              >
                                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                {emp.personal_photo_url && <img src={emp.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />}
                                <span className="font-medium">{emp.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center font-medium text-primary">{riderMonthKm(emp.id).toLocaleString()}</td>
                            <td className="px-4 py-2 text-center" style={{ color: 'hsl(var(--warning))' }}>{riderMonthFuel(emp.id).toLocaleString()} ر.س</td>
                          </tr>
                          {open && (
                            <tr className="bg-muted/10">
                              <td colSpan={4} className="p-0">
                                <div className="p-3 space-y-2">
                                  {days.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-2">لا سجلات يومية لهذا الشهر</p>
                                  ) : (
                                    <table className="w-full text-xs border border-border/40 rounded-lg overflow-hidden">
                                      <thead className="bg-muted/50">
                                        <tr>
                                          <th className="px-2 py-1.5 text-start">التاريخ</th>
                                          <th className="px-2 py-1.5 text-center">كم</th>
                                          <th className="px-2 py-1.5 text-center">بنزين</th>
                                          <th className="px-2 py-1.5 text-start">ملاحظات</th>
                                          <th className="px-2 py-1.5 text-center w-24">إجراء</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {days.map(dr => (
                                          <tr key={dr.id} className="border-t border-border/30">
                                            <td className="px-2 py-1.5 font-mono">{dr.date}</td>
                                            <td className="px-2 py-1.5 text-center">
                                              {editingDaily?.id === dr.id ? (
                                                <Input className="h-7 text-xs" type="number" value={editingDaily.km_total} onChange={e => setEditingDaily(ed => ed ? { ...ed, km_total: e.target.value } : null)} />
                                              ) : (dr.km_total || '—')}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                              {editingDaily?.id === dr.id ? (
                                                <Input className="h-7 text-xs" type="number" value={editingDaily.fuel_cost} onChange={e => setEditingDaily(ed => ed ? { ...ed, fuel_cost: e.target.value } : null)} />
                                              ) : (dr.fuel_cost || '—')}
                                            </td>
                                            <td className="px-2 py-1.5">
                                              {editingDaily?.id === dr.id ? (
                                                <Input className="h-7 text-xs" value={editingDaily.notes} onChange={e => setEditingDaily(ed => ed ? { ...ed, notes: e.target.value } : null)} />
                                              ) : (dr.notes || '—')}
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                              {permissions.can_edit && (
                                                <div className="flex gap-1 justify-center">
                                                  {editingDaily?.id === dr.id ? (
                                                    <>
                                                      <Button type="button" size="sm" className="h-7 text-[10px] px-2" disabled={savingEntry} onClick={() => saveEditedDaily(dr)}>حفظ</Button>
                                                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => setEditingDaily(null)}>إلغاء</Button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => setEditingDaily({ id: dr.id, km_total: String(dr.km_total), fuel_cost: String(dr.fuel_cost), notes: dr.notes || '' })}><Edit2 size={13} /></button>
                                                      <button type="button" className="p-1 rounded hover:bg-destructive/10 text-destructive" onClick={() => handleDeleteDaily(dr.id)}><Trash2 size={13} /></button>
                                                    </>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
                {permissions.can_edit && (
                  <tfoot>
                    <tr className="bg-primary/5 border-t-2 border-primary/20">
                      <td colSpan={4} className="p-3">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="min-w-[160px] flex-1">
                            <Label className="text-[10px] text-muted-foreground">مندوب</Label>
                            <Select value={newEntry.employee_id} onValueChange={v => setNewEntry(ne => ({ ...ne, employee_id: v }))}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                              <SelectContent className="max-h-56">
                                {ridersForTab.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">تاريخ</Label>
                            <Input type="date" className="h-9 w-[150px]" value={newEntry.date || defaultEntryDate} onChange={e => setNewEntry(ne => ({ ...ne, date: e.target.value }))} />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">كم</Label>
                            <Input type="number" className="h-9 w-24" value={newEntry.km_total} onChange={e => setNewEntry(ne => ({ ...ne, km_total: e.target.value }))} placeholder="0" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">بنزين (ر.س)</Label>
                            <Input type="number" className="h-9 w-28" value={newEntry.fuel_cost} onChange={e => setNewEntry(ne => ({ ...ne, fuel_cost: e.target.value }))} placeholder="0" />
                          </div>
                          <div className="min-w-[120px] flex-1">
                            <Label className="text-[10px] text-muted-foreground">ملاحظات</Label>
                            <Input className="h-9" value={newEntry.notes} onChange={e => setNewEntry(ne => ({ ...ne, notes: e.target.value }))} placeholder="اختياري" />
                          </div>
                          <Button type="button" className="h-9 gap-1" onClick={submitNewEntry} disabled={savingEntry}>
                            <Plus size={14} /> {savingEntry ? '...' : 'حفظ'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {showImport && (
        <ImportModal
          employees={employees}
          monthYear={monthYear}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchMonthly(); }}
        />
      )}
    </div>
  );
};

export default FuelPage;
