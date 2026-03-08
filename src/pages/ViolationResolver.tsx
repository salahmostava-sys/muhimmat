import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, User, Car, Clock, CheckCircle, XCircle, FileWarning, History, RefreshCw, Ban, BadgeAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────
type MatchedDriver = {
  assignment_id: string;
  employee_id: string;
  employee_name: string;
  vehicle_plate: string;
  vehicle_brand: string | null;
  vehicle_type: string;
  start_at: string | null;
  returned_at: string | null;
  start_date: string;
};

type ViolationForm = {
  plate_number: string;
  violation_datetime: string;
  amount: string;
  note: string;
};

type ViolationRecord = {
  id: string;
  employee_id: string;
  amount: number;
  incident_date: string | null;
  apply_month: string;
  note: string | null;
  approval_status: string;
  created_at: string;
  employees?: { name: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDateTime = (dt: string | null) => {
  if (!dt) return '—';
  try { return format(parseISO(dt), 'dd/MM/yyyy HH:mm', { locale: ar }); } catch { return dt; }
};

const statusBadge = (s: string) => {
  if (s === 'approved') return <span className="badge-success">معتمدة</span>;
  if (s === 'rejected') return <span className="badge-urgent">مرفوضة</span>;
  return <span className="badge-warning">معلّقة</span>;
};

// ─── History Tab Component ─────────────────────────────────────────────────────
const ViolationsHistory = () => {
  const [records, setRecords] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('external_deductions')
      .select('id, employee_id, amount, incident_date, apply_month, note, approval_status, created_at, employees(name)')
      .eq('type', 'fine')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) setRecords(data as ViolationRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (r.employees?.name || '').toLowerCase().includes(q)
      || (r.note || '').toLowerCase().includes(q)
      || (r.incident_date || '').includes(q);
    const matchStatus = statusFilter === 'all' || r.approval_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalAmount = filtered.reduce((s, r) => s + r.amount, 0);
  const pendingCount = records.filter(r => r.approval_status === 'pending').length;
  const approvedAmount = records.filter(r => r.approval_status === 'approved').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المخالفات', value: records.length, sub: 'سجل', cls: 'text-foreground', icon: '📋' },
          { label: 'معلّقة', value: pendingCount, sub: 'بانتظار الموافقة', cls: 'text-warning', icon: '⏳' },
          { label: 'إجمالي المبالغ المعتمدة', value: `${approvedAmount.toLocaleString()} ر.س`, sub: '', cls: 'text-success', icon: '✅' },
          { label: 'مبلغ النتائج الحالية', value: `${totalAmount.toLocaleString()} ر.س`, sub: `${filtered.length} سجل`, cls: 'text-primary', icon: '💰' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span>{s.icon}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
            {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث باسم المندوب أو الملاحظة..."
            className="pr-9 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${statusFilter === opt ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {opt === 'all' ? 'الكل' : opt === 'pending' ? 'معلّقة' : opt === 'approved' ? 'معتمدة' : 'مرفوضة'}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 h-9" onClick={fetch}>
          <RefreshCw size={13} /> تحديث
        </Button>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th">#</th>
                <th className="ta-th">المندوب</th>
                <th className="ta-th">تاريخ الحادثة</th>
                <th className="ta-th">شهر الخصم</th>
                <th className="ta-th">المبلغ</th>
                <th className="ta-th">الملاحظة</th>
                <th className="ta-th">حالة الموافقة</th>
                <th className="ta-th">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <BadgeAlert size={40} className="opacity-30" />
                      <p className="font-medium">لا توجد مخالفات مسجّلة</p>
                      <p className="text-xs">المخالفات المُسجّلة من خلال المُحقق ستظهر هنا</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((r, idx) => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-semibold text-sm text-foreground whitespace-nowrap">
                      {r.employees?.name || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                    {r.incident_date ? format(parseISO(r.incident_date), 'yyyy/MM/dd') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                    {r.apply_month}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-destructive whitespace-nowrap">
                      {r.amount.toLocaleString()} ر.س
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[220px]">
                    <span className="line-clamp-2">{r.note || '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">{statusBadge(r.approval_status)}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    <div>{format(parseISO(r.created_at), 'yyyy/MM/dd')}</div>
                    <div className="text-muted-foreground/60">
                      {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true, locale: ar })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ViolationResolver = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'resolver' | 'history'>('resolver');
  const [form, setForm] = useState<ViolationForm>({ plate_number: '', violation_datetime: '', amount: '', note: '' });
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<MatchedDriver | null | 'not_found' | 'no_vehicle'>(null);
  const [assigned, setAssigned] = useState(false);

  const handleSearch = async () => {
    const plate = form.plate_number.trim();
    const dt = form.violation_datetime;
    if (!plate) return toast({ title: 'أدخل رقم اللوحة', variant: 'destructive' });
    if (!dt) return toast({ title: 'أدخل تاريخ ووقت المخالفة', variant: 'destructive' });
    setSearching(true); setResult(null); setAssigned(false);

    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles').select('id, plate_number, brand, type')
      .ilike('plate_number', `%${plate}%`).limit(5);

    if (vErr || !vehicles?.length) { setSearching(false); setResult('no_vehicle'); return; }

    const vehicleIds = vehicles.map(v => v.id);
    const violationTs = new Date(dt).toISOString();

    const { data: assignments, error: aErr } = await supabase
      .from('vehicle_assignments')
      .select('id, vehicle_id, employee_id, start_date, start_at, returned_at, end_date, employees(id, name), vehicles(plate_number, brand, type)')
      .in('vehicle_id', vehicleIds)
      .order('start_at', { ascending: false });

    setSearching(false);
    if (aErr || !assignments?.length) { setResult('not_found'); return; }

    const violationTime = new Date(violationTs).getTime();
    const match = assignments.find(a => {
      const start = a.start_at ? new Date(a.start_at).getTime() : new Date(a.start_date).getTime();
      const end = a.returned_at
        ? new Date(a.returned_at).getTime()
        : a.end_date ? new Date(a.end_date + 'T23:59:59').getTime() : Date.now() + 1;
      return violationTime >= start && violationTime <= end;
    });

    if (!match) { setResult('not_found'); return; }
    const veh = vehicles.find(v => v.id === match.vehicle_id);
    setResult({
      assignment_id: match.id, employee_id: match.employee_id,
      employee_name: (match.employees as any)?.name || '—',
      vehicle_plate: (match.vehicles as any)?.plate_number || plate,
      vehicle_brand: (match.vehicles as any)?.brand || null,
      vehicle_type: (match.vehicles as any)?.type || '—',
      start_at: match.start_at, returned_at: match.returned_at, start_date: match.start_date,
    });
  };

  const handleAssignViolation = async () => {
    if (!result || result === 'not_found' || result === 'no_vehicle') return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' });
    setAssigning(true);
    const violationDate = form.violation_datetime ? form.violation_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('external_deductions').insert({
      employee_id: result.employee_id, amount: amt, type: 'fine',
      apply_month: violationDate.substring(0, 7), incident_date: violationDate,
      note: form.note ? `مخالفة مرورية - ${result.vehicle_plate} - ${form.note}` : `مخالفة مرورية - لوحة: ${result.vehicle_plate}`,
      approval_status: 'pending',
    });
    setAssigning(false);
    if (error) { toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }); return; }
    setAssigned(true);
    toast({ title: 'تم تسجيل المخالفة بنجاح', description: `تم تسجيل المخالفة على ${result.employee_name}` });
  };

  const handleReset = () => { setForm({ plate_number: '', violation_datetime: '', amount: '', note: '' }); setResult(null); setAssigned(false); };

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <FileWarning className="text-destructive" size={22} />
        </div>
        <div>
          <nav className="page-breadcrumb"><span>العمليات</span><span className="page-breadcrumb-sep">/</span><span className="text-foreground font-medium">مُحقق المخالفات</span></nav>
          <h1 className="page-title">مُحقق المخالفات</h1>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('resolver')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'resolver' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Search size={14} /> تحديد المسؤول
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <History size={14} /> سجل المخالفات
        </button>
      </div>

      {/* ── RESOLVER TAB ── */}
      {activeTab === 'resolver' && (
        <div className="max-w-2xl space-y-5">
          {/* Search Card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Search size={15} className="text-primary" /> بيانات المخالفة
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm mb-1.5 block">رقم لوحة المركبة <span className="text-destructive">*</span></Label>
                <Input value={form.plate_number} onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))} placeholder="مثال: أ ب ج 1234" />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">تاريخ ووقت المخالفة <span className="text-destructive">*</span></Label>
                <Input type="datetime-local" value={form.violation_datetime} onChange={e => setForm(f => ({ ...f, violation_datetime: e.target.value }))} />
              </div>
            </div>
            <Button onClick={handleSearch} disabled={searching} className="w-full gap-2 h-11 text-base font-semibold">
              {searching ? <><span className="animate-spin w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full" />جاري البحث...</> : <><Search size={17} />بحث عن السائق المسؤول</>}
            </Button>
          </div>

          {/* No vehicle */}
          {result === 'no_vehicle' && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
              <XCircle className="mx-auto text-muted-foreground" size={36} />
              <p className="font-semibold text-foreground">لم يتم العثور على المركبة</p>
              <p className="text-sm text-muted-foreground">لا توجد مركبة مسجلة بالرقم "<span className="font-medium">{form.plate_number}</span>" في النظام.</p>
              <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">بحث جديد</Button>
            </div>
          )}

          {/* No assignment */}
          {result === 'not_found' && (
            <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
              <AlertTriangle className="mx-auto text-warning" size={36} />
              <p className="font-semibold text-foreground">لا يوجد سائق مسجّل في هذا الوقت</p>
              <p className="text-sm text-muted-foreground">
                لم يتم العثور على أي سائق تسلّم المركبة وقت المخالفة{form.violation_datetime && <> (<span className="font-medium">{formatDateTime(new Date(form.violation_datetime).toISOString())}</span>)</>}.
              </p>
              <p className="text-xs text-muted-foreground">تأكد من صحة التاريخ والوقت، أو راجع سجل تسليم العهد.</p>
              <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">بحث جديد</Button>
            </div>
          )}

          {/* Driver found */}
          {result && result !== 'not_found' && result !== 'no_vehicle' && (
            <div className={`bg-card border-2 rounded-2xl overflow-hidden shadow-sm ${assigned ? 'border-success/50' : 'border-primary/30'}`}>
              <div className={`px-6 py-4 flex items-center gap-3 ${assigned ? 'bg-success/10' : 'bg-primary/5'}`}>
                {assigned ? <CheckCircle className="text-success" size={22} /> : <User className="text-primary" size={22} />}
                <div>
                  <p className="text-xs text-muted-foreground">{assigned ? 'تم تسجيل المخالفة بنجاح' : 'السائق المسؤول عن المركبة'}</p>
                  <p className="font-bold text-lg text-foreground">{result.employee_name}</p>
                </div>
              </div>
              <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border/50">
                <div className="flex items-start gap-2">
                  <Car size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">المركبة</p>
                    <p className="font-semibold text-sm">{result.vehicle_plate}</p>
                    {result.vehicle_brand && <p className="text-xs text-muted-foreground">{result.vehicle_brand} — {result.vehicle_type === 'motorcycle' ? 'موتوسيكل' : 'سيارة'}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">فترة الاستلام</p>
                    <p className="font-semibold text-sm">{formatDateTime(result.start_at)}</p>
                    <p className="text-xs text-muted-foreground">{result.returned_at ? `حتى: ${formatDateTime(result.returned_at)}` : 'لم يُعَد بعد'}</p>
                  </div>
                </div>
              </div>
              {!assigned ? (
                <div className="px-6 py-5 space-y-4">
                  <h3 className="text-sm font-semibold">تسجيل المخالفة على هذا المندوب</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm mb-1.5 block">مبلغ المخالفة (ر.س) <span className="text-destructive">*</span></Label>
                      <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" min="0" />
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">ملاحظة إضافية</Label>
                      <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="مثال: تجاوز إشارة حمراء" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <Button onClick={handleAssignViolation} disabled={assigning} className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      {assigning ? <><span className="animate-spin w-4 h-4 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full" />جاري التسجيل...</> : <><AlertTriangle size={15} />تسجيل المخالفة</>}
                    </Button>
                    <Button variant="outline" onClick={handleReset}>إلغاء</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">سيتم تسجيل المخالفة كخصم معلق (بانتظار الموافقة) في ملف المندوب.</p>
                </div>
              ) : (
                <div className="px-6 py-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-success">تم تسجيل المخالفة بنجاح ✓</p>
                    <p className="text-xs text-muted-foreground mt-0.5">خصم {parseFloat(form.amount || '0').toLocaleString()} ر.س — بانتظار الموافقة</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setActiveTab('history')}>
                      <History size={13} className="ml-1" /> عرض السجل
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleReset}>بحث جديد</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info banner */}
          {!result && (
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">كيف يعمل المُحقق؟</p>
                <p>أدخل رقم لوحة المركبة وتاريخ ووقت المخالفة بدقة. سيقوم النظام بمطابقة الوقت مع سجلات التسليم لتحديد المندوب المسؤول.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && <ViolationsHistory />}
    </div>
  );
};

export default ViolationResolver;
