import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Upload, Download, Edit2, Trash2,
  Fuel, TrendingUp, DollarSign, Package,
  X, Check, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { format, endOfMonth } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type MileageRow = {
  id: string;
  employee_id: string;
  month_year: string;
  km_total: number;
  fuel_cost: number;
  cost_per_km: number | null;
  notes: string | null;
  employee?: { name: string; personal_photo_url?: string | null };
  orders_count?: number;
};

type Employee = { id: string; name: string; personal_photo_url?: string | null };

type ImportRow = {
  raw_name: string;
  km_total: number;
  fuel_cost: number;
  notes?: string;
  matched_employee?: Employee | null;
  manual_employee_id?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = [
  { v: '01', l: 'يناير' }, { v: '02', l: 'فبراير' }, { v: '03', l: 'مارس' },
  { v: '04', l: 'أبريل' }, { v: '05', l: 'مايو' }, { v: '06', l: 'يونيو' },
  { v: '07', l: 'يوليو' }, { v: '08', l: 'أغسطس' }, { v: '09', l: 'سبتمبر' },
  { v: '10', l: 'أكتوبر' }, { v: '11', l: 'نوفمبر' }, { v: '12', l: 'ديسمبر' },
];

const costPerKmColor = (v: number | null) => {
  if (v === null) return 'text-muted-foreground';
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
  <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Manual Entry Modal — only fuel & km manual, employee & orders auto ────────
const ManualEntryModal = ({
  employees, defaultMonthYear, onClose, onSaved, editRow,
}: {
  employees: Employee[];
  defaultMonthYear: string;
  onClose: () => void;
  onSaved: () => void;
  editRow?: MileageRow | null;
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    employee_id: editRow?.employee_id || '',
    month_year: editRow?.month_year || defaultMonthYear,
    km_total: editRow?.km_total ? String(editRow.km_total) : '',
    fuel_cost: editRow?.fuel_cost ? String(editRow.fuel_cost) : '',
    notes: editRow?.notes || '',
  });
  const [employeeOrders, setEmployeeOrders] = useState<number | null>(null);

  // Auto-fetch orders when employee or month changes
  useEffect(() => {
    if (!form.employee_id || !form.month_year) { setEmployeeOrders(null); return; }
    const [year, month] = form.month_year.split('-');
    const start = `${form.month_year}-01`;
    const end = format(endOfMonth(new Date(`${form.month_year}-01`)), 'yyyy-MM-dd');
    supabase.from('daily_orders')
      .select('orders_count')
      .eq('employee_id', form.employee_id)
      .gte('date', start).lte('date', end)
      .then(({ data }) => {
        const total = (data || []).reduce((s, r) => s + r.orders_count, 0);
        setEmployeeOrders(total);
      });
  }, [form.employee_id, form.month_year]);

  const km = parseFloat(form.km_total) || 0;
  const fuel = parseFloat(form.fuel_cost) || 0;
  const liveRatio = km > 0 ? fuel / km : null;

  const save = async () => {
    if (!form.employee_id) return toast({ title: 'اختر المندوب', variant: 'destructive' });
    if (!km) return toast({ title: 'أدخل الكيلومترات', variant: 'destructive' });
    if (!fuel) return toast({ title: 'أدخل تكلفة البنزين', variant: 'destructive' });
    setSaving(true);
    const payload = {
      employee_id: form.employee_id,
      month_year: form.month_year,
      km_total: km,
      fuel_cost: fuel,
      notes: form.notes || null,
    };
    const { error } = editRow
      ? await supabase.from('vehicle_mileage').update(payload).eq('id', editRow.id)
      : await supabase.from('vehicle_mileage').upsert([payload], { onConflict: 'employee_id,month_year' });
    setSaving(false);
    if (error) return toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    toast({ title: 'تم الحفظ بنجاح' });
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{editRow ? 'تعديل السجل' : 'إدخال بيانات استهلاك'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Employee — auto from DB */}
          <div>
            <Label className="text-sm mb-1.5 block">المندوب <span className="text-destructive">*</span></Label>
            <Select value={form.employee_id} onValueChange={v => setForm(f => ({ ...f, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Month */}
          <div>
            <Label className="text-sm mb-1.5 block">الشهر</Label>
            <Input type="month" value={form.month_year} onChange={e => setForm(f => ({ ...f, month_year: e.target.value }))} />
          </div>

          {/* Orders — auto fetched, read-only */}
          {form.employee_id && (
            <div className="bg-muted/40 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Package size={14} /> عدد الطلبات (تلقائي من الطلبات)
              </span>
              <span className="font-bold text-primary">
                {employeeOrders === null ? '...' : employeeOrders.toLocaleString()}
              </span>
            </div>
          )}

          {/* Manual: km & fuel only */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm mb-1.5 block">الكيلومترات <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.km_total} onChange={e => setForm(f => ({ ...f, km_total: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">تكلفة البنزين (ر.س) <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.fuel_cost} onChange={e => setForm(f => ({ ...f, fuel_cost: e.target.value }))} placeholder="0" />
            </div>
          </div>

          {liveRatio !== null && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium bg-muted/40 ${costPerKmColor(liveRatio)}`}>
              التكلفة/كم: {liveRatio.toFixed(3)} ر.س/كم
            </div>
          )}

          <div>
            <Label className="text-sm mb-1.5 block">ملاحظات</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="اختياري" />
          </div>
        </div>
        <div className="flex justify-between px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? 'جاري الحفظ...' : <><Check size={15} /> حفظ</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Import Modal ─────────────────────────────────────────────────────────────
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
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState({ name: '', km: '', fuel: '', notes: '' });
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
      const data = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, any>[];
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
      const fuel_cost = mapping.fuel ? parseFloat(String(r[mapping.fuel] || 0)) || 0 : 0;
      const notes = mapping.notes ? String(r[mapping.notes] || '') : '';
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
    const { error } = await supabase.from('vehicle_mileage').upsert(payload, {
      onConflict: replaceExisting ? 'employee_id,month_year' : undefined,
      ignoreDuplicates: !replaceExisting,
    });
    setSaving(false);
    if (error) return toast({ title: 'خطأ في الاستيراد', description: error.message, variant: 'destructive' });
    toast({ title: `تم استيراد ${payload.length} سجل بنجاح` });
    onImported();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-border/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">استيراد كيلومترات GPS</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><X size={16} /></button>
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
                  { key: 'name', label: 'عمود اسم المندوب', required: true },
                  { key: 'km', label: 'عمود الكيلومترات', required: true },
                  { key: 'fuel', label: 'عمود تكلفة البنزين', required: false },
                  { key: 'notes', label: 'عمود الملاحظات', required: false },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-sm mb-1.5 block">{f.label} {f.required && <span className="text-destructive">*</span>}</Label>
                    <Select value={(mapping as any)[f.key]} onValueChange={v => setMapping(m => ({ ...m, [f.key]: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={f.required ? 'مطلوب' : 'اختياري'} /></SelectTrigger>
                      <SelectContent>
                        {!f.required && <SelectItem value="">— لا يوجد —</SelectItem>}
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
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(now, 'MM'));
  const [selectedYear, setSelectedYear] = useState(format(now, 'yyyy'));
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<MileageRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editRow, setEditRow] = useState<MileageRow | null>(null);

  const monthYear = `${selectedYear}-${selectedMonth}`;

  // Fetch active employees from DB
  useEffect(() => {
    supabase.from('employees').select('id, name, personal_photo_url')
      .eq('status', 'active').order('name')
      .then(({ data }) => { if (data) setEmployees(data); });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const start = `${monthYear}-01`;
    const end = format(endOfMonth(new Date(`${monthYear}-01`)), 'yyyy-MM-dd');

    const [mileageRes, ordersRes] = await Promise.all([
      supabase.from('vehicle_mileage').select('*, employee:employees(name, personal_photo_url)')
        .eq('month_year', monthYear).order('employee(name)'),
      supabase.from('daily_orders').select('employee_id, orders_count')
        .gte('date', start).lte('date', end),
    ]);

    if (mileageRes.data) {
      const orderMap: Record<string, number> = {};
      (ordersRes.data || []).forEach(o => {
        orderMap[o.employee_id] = (orderMap[o.employee_id] || 0) + o.orders_count;
      });
      setRows(mileageRes.data.map((r: any) => ({ ...r, orders_count: orderMap[r.employee_id] || 0 })));
    }
    setLoading(false);
  }, [monthYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا السجل؟')) return;
    const { error } = await supabase.from('vehicle_mileage').delete().eq('id', id);
    if (error) return toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    toast({ title: 'تم الحذف' });
    fetchData();
  };

  const filtered = rows.filter(r => !search || (r.employee?.name || '').toLowerCase().includes(search.toLowerCase()));

  const totalKm = filtered.reduce((s, r) => s + r.km_total, 0);
  const totalFuel = filtered.reduce((s, r) => s + r.fuel_cost, 0);
  const avgCostPerKm = totalKm > 0 ? totalFuel / totalKm : 0;
  const totalOrders = filtered.reduce((s, r) => s + (r.orders_count || 0), 0);

  const handleExport = () => {
    const data = filtered.map(r => ({
      'الاسم': r.employee?.name || '',
      'الكيلومترات': r.km_total,
      'تكلفة البنزين (ر.س)': r.fuel_cost,
      'تكلفة/كم (ر.س)': r.cost_per_km ? r.cost_per_km.toFixed(3) : '',
      'عدد الطلبات': r.orders_count || 0,
      'تكلفة البنزين/طلب': r.orders_count ? (r.fuel_cost / r.orders_count).toFixed(2) : '',
      'كم/طلب': r.orders_count ? (r.km_total / r.orders_count).toFixed(1) : '',
      'ملاحظات': r.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الاستهلاك');
    XLSX.writeFile(wb, `بيانات_الاستهلاك_${selectedMonth}_${selectedYear}.xlsx`);
  };

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  return (
    <div className="space-y-6">
      {/* Header */}
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
              <p className="text-sm text-muted-foreground">الوقود والكيلومترات حسب المندوب</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={22} />} label="إجمالي الكيلومترات" value={totalKm.toLocaleString()} sub="كم هذا الشهر" />
        <StatCard icon={<Fuel size={22} />} label="إجمالي تكلفة البنزين" value={`${totalFuel.toLocaleString()} ر.س`} sub="هذا الشهر" />
        <StatCard icon={<DollarSign size={22} />} label="متوسط تكلفة الكيلومتر" value={avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س` : '—'} sub="ر.س / كم" />
        <StatCard icon={<Package size={22} />} label="إجمالي الطلبات" value={totalOrders.toLocaleString()} sub="من الطلبات اليومية" />
      </div>

      {/* Info banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-3 text-sm">
        <span className="text-primary mt-0.5">ℹ️</span>
        <div>
          <span className="font-semibold text-foreground">المناديب يُجلبون تلقائياً</span> من قاعدة الموظفين النشطين —{' '}
          <span className="font-semibold text-foreground">عدد الطلبات يُحسب تلقائياً</span> من الطلبات اليومية —{' '}
          أدخل <span className="font-semibold text-primary">الكيلومترات والبنزين</span> يدوياً فقط.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث باسم المندوب..." className="ps-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
          <Upload size={15} /> استيراد GPS
        </Button>
        <Button className="gap-2" onClick={() => { setEditRow(null); setShowManual(true); }}>
          <Plus size={15} /> إدخال يدوي
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download size={15} /> تصدير Excel
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">المندوب</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">الكيلومترات</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">تكلفة البنزين</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">تكلفة/كم</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">عدد الطلبات 📦</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">بنزين/طلب</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">كم/طلب</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-muted-foreground">ملاحظات</th>
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <span className="text-4xl">⛽</span>
                      <p className="font-medium">لا توجد بيانات لهذا الشهر</p>
                      <p className="text-xs">استورد من GPS أو أدخل يدوياً</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {filtered.map(row => {
                    const costPerKm = row.cost_per_km;
                    const orders = row.orders_count || 0;
                    const fuelPerOrder = orders > 0 ? row.fuel_cost / orders : null;
                    const kmPerOrder = orders > 0 ? row.km_total / orders : null;
                    const initial = (row.employee?.name || '?').charAt(0);
                    return (
                      <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {row.employee?.personal_photo_url
                              ? <img src={row.employee.personal_photo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
                              : <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{initial}</div>
                            }
                            <span className="font-medium text-foreground">{row.employee?.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-primary">{row.km_total.toLocaleString()} كم</td>
                        <td className="px-4 py-3 text-center font-medium" style={{ color: 'hsl(var(--warning))' }}>{row.fuel_cost.toLocaleString()} ر.س</td>
                        <td className={`px-4 py-3 text-center ${costPerKmColor(costPerKm)}`}>
                          {costPerKm !== null ? `${costPerKm.toFixed(3)} ر.س/كم` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {orders > 0
                            ? <span className="font-semibold text-foreground">{orders.toLocaleString()}</span>
                            : <span className="text-muted-foreground/40">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">{fuelPerOrder !== null ? `${fuelPerOrder.toFixed(2)} ر.س` : '—'}</span>
                            {fuelPerOrderBadge(fuelPerOrder)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                          {kmPerOrder !== null ? `${kmPerOrder.toFixed(1)} كم` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">{row.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => { setEditRow(row); setShowManual(true); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="تعديل">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="حذف">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold text-sm">
                    <td className="px-4 py-3 text-foreground">الإجمالي ({filtered.length} مندوب)</td>
                    <td className="px-4 py-3 text-center text-primary">{totalKm.toLocaleString()} كم</td>
                    <td className="px-4 py-3 text-center" style={{ color: 'hsl(var(--warning))' }}>{totalFuel.toLocaleString()} ر.س</td>
                    <td className={`px-4 py-3 text-center ${costPerKmColor(avgCostPerKm)}`}>
                      {avgCostPerKm > 0 ? `${avgCostPerKm.toFixed(3)} ر.س/كم` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">{totalOrders.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {totalOrders > 0 ? `${(totalFuel / totalOrders).toFixed(2)} ر.س` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {totalOrders > 0 ? `${(totalKm / totalOrders).toFixed(1)} كم` : '—'}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showManual && (
        <ManualEntryModal
          employees={employees}
          defaultMonthYear={monthYear}
          editRow={editRow}
          onClose={() => { setShowManual(false); setEditRow(null); }}
          onSaved={() => { setShowManual(false); setEditRow(null); fetchData(); }}
        />
      )}
      {showImport && (
        <ImportModal
          employees={employees}
          monthYear={monthYear}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); fetchData(); }}
        />
      )}
    </div>
  );
};

export default FuelPage;
