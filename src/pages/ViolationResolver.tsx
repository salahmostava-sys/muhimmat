import { useState } from 'react';
import { Search, AlertTriangle, User, Car, Clock, CheckCircle, XCircle, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

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

// ─── Helper ───────────────────────────────────────────────────────────────────
const formatDateTime = (dt: string | null) => {
  if (!dt) return '—';
  try {
    return format(parseISO(dt), 'dd/MM/yyyy HH:mm', { locale: ar });
  } catch {
    return dt;
  }
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ViolationResolver = () => {
  const { toast } = useToast();
  const [form, setForm] = useState<ViolationForm>({
    plate_number: '',
    violation_datetime: '',
    amount: '',
    note: '',
  });
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<MatchedDriver | null | 'not_found' | 'no_vehicle'>(null);
  const [assigned, setAssigned] = useState(false);

  // ── Search Logic ─────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const plate = form.plate_number.trim();
    const dt = form.violation_datetime;
    if (!plate) return toast({ title: 'أدخل رقم اللوحة', variant: 'destructive' });
    if (!dt) return toast({ title: 'أدخل تاريخ ووقت المخالفة', variant: 'destructive' });

    setSearching(true);
    setResult(null);
    setAssigned(false);

    // 1) Find vehicle by plate number
    const { data: vehicles, error: vErr } = await supabase
      .from('vehicles')
      .select('id, plate_number, brand, type')
      .ilike('plate_number', `%${plate}%`)
      .limit(5);

    if (vErr || !vehicles?.length) {
      setSearching(false);
      setResult('no_vehicle');
      return;
    }

    const vehicleIds = vehicles.map(v => v.id);
    const violationTs = new Date(dt).toISOString();

    // 2) Find assignments where violation datetime falls within [start_at, returned_at]
    // Strategy: fetch all assignments for these vehicles, then filter client-side for precision
    const { data: assignments, error: aErr } = await supabase
      .from('vehicle_assignments')
      .select(`
        id,
        vehicle_id,
        employee_id,
        start_date,
        start_at,
        returned_at,
        end_date,
        employees (id, name),
        vehicles (plate_number, brand, type)
      `)
      .in('vehicle_id', vehicleIds)
      .order('start_at', { ascending: false });

    setSearching(false);

    if (aErr || !assignments?.length) {
      setResult('not_found');
      return;
    }

    const violationTime = new Date(violationTs).getTime();

    // Find exact match: violation time is between start_at and returned_at (or still active)
    const match = assignments.find(a => {
      const start = a.start_at ? new Date(a.start_at).getTime() : new Date(a.start_date).getTime();
      const end = a.returned_at
        ? new Date(a.returned_at).getTime()
        : a.end_date
        ? new Date(a.end_date + 'T23:59:59').getTime()
        : Date.now() + 1; // still active

      return violationTime >= start && violationTime <= end;
    });

    if (!match) {
      setResult('not_found');
      return;
    }

    const veh = vehicles.find(v => v.id === match.vehicle_id);
    setResult({
      assignment_id: match.id,
      employee_id: match.employee_id,
      employee_name: (match.employees as any)?.name || '—',
      vehicle_plate: (match.vehicles as any)?.plate_number || plate,
      vehicle_brand: (match.vehicles as any)?.brand || null,
      vehicle_type: (match.vehicles as any)?.type || '—',
      start_at: match.start_at,
      returned_at: match.returned_at,
      start_date: match.start_date,
    });
  };

  // ── Assign Violation ──────────────────────────────────────────────────────
  const handleAssignViolation = async () => {
    if (!result || result === 'not_found' || result === 'no_vehicle') return;
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' });

    setAssigning(true);
    const violationDate = form.violation_datetime ? form.violation_datetime.split('T')[0] : new Date().toISOString().split('T')[0];
    const applyMonth = violationDate.substring(0, 7); // yyyy-MM

    const { error } = await supabase.from('external_deductions').insert({
      employee_id: result.employee_id,
      amount: amt,
      type: 'fine',
      apply_month: applyMonth,
      incident_date: violationDate,
      note: form.note
        ? `مخالفة مرورية - ${result.vehicle_plate} - ${form.note}`
        : `مخالفة مرورية - لوحة: ${result.vehicle_plate}`,
      approval_status: 'pending',
    });

    setAssigning(false);
    if (error) {
      toast({ title: 'حدث خطأ أثناء التسجيل', description: error.message, variant: 'destructive' });
      return;
    }

    setAssigned(true);
    toast({ title: 'تم تسجيل المخالفة بنجاح', description: `تم تسجيل المخالفة على ${result.employee_name}` });
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setForm({ plate_number: '', violation_datetime: '', amount: '', note: '' });
    setResult(null);
    setAssigned(false);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <FileWarning className="text-destructive" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">مُحقق المخالفات</h1>
          <p className="text-sm text-muted-foreground">تحديد المندوب المسؤول عن مخالفة مرورية بناءً على رقم اللوحة والوقت</p>
        </div>
      </div>

      {/* ── Search Card ── */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Search size={16} className="text-primary" />
          بيانات المخالفة
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm mb-1.5 block">
              رقم لوحة المركبة <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.plate_number}
              onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))}
              placeholder="مثال: أ ب ج 1234"
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">
              تاريخ ووقت المخالفة <span className="text-destructive">*</span>
            </Label>
            <Input
              type="datetime-local"
              value={form.violation_datetime}
              onChange={e => setForm(f => ({ ...f, violation_datetime: e.target.value }))}
            />
          </div>
        </div>

        <Button
          onClick={handleSearch}
          disabled={searching}
          className="w-full gap-2 h-11 text-base font-semibold"
        >
          {searching ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full" />
              جاري البحث...
            </>
          ) : (
            <>
              <Search size={17} />
              بحث عن السائق المسؤول
            </>
          )}
        </Button>
      </div>

      {/* ── No Vehicle Found ── */}
      {result === 'no_vehicle' && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <XCircle className="mx-auto text-muted-foreground" size={40} />
          <p className="font-semibold text-foreground">لم يتم العثور على المركبة</p>
          <p className="text-sm text-muted-foreground">
            لا توجد مركبة مسجلة بالرقم "<span className="font-medium">{form.plate_number}</span>" في النظام.
          </p>
          <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">بحث جديد</Button>
        </div>
      )}

      {/* ── No Assignment Found ── */}
      {result === 'not_found' && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <AlertTriangle className="mx-auto text-warning" size={40} />
          <p className="font-semibold text-foreground">لا يوجد سائق مسجّل في هذا الوقت</p>
          <p className="text-sm text-muted-foreground">
            لم يتم العثور على أي سائق تسلّم المركبة في وقت المخالفة
            {form.violation_datetime && (
              <> (<span className="font-medium">{formatDateTime(new Date(form.violation_datetime).toISOString())}</span>)</>
            )}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">تأكد من صحة التاريخ والوقت، أو راجع سجل التسليم والاستلام في صفحة المركبات.</p>
          <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">بحث جديد</Button>
        </div>
      )}

      {/* ── Driver Found ── */}
      {result && result !== 'not_found' && result !== 'no_vehicle' && (
        <div className={`bg-card border-2 rounded-2xl overflow-hidden shadow-sm transition-all ${assigned ? 'border-success/50' : 'border-primary/30'}`}>
          {/* Result Header */}
          <div className={`px-6 py-4 flex items-center gap-3 ${assigned ? 'bg-success/10' : 'bg-primary/5'}`}>
            {assigned ? (
              <CheckCircle className="text-success" size={22} />
            ) : (
              <User className="text-primary" size={22} />
            )}
            <div>
              <p className="text-xs text-muted-foreground">{assigned ? 'تم تسجيل المخالفة بنجاح' : 'السائق المسؤول عن المركبة'}</p>
              <p className="font-bold text-lg text-foreground">{result.employee_name}</p>
            </div>
          </div>

          {/* Vehicle & Assignment Details */}
          <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-border/50">
            <div className="flex items-start gap-2">
              <Car size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">المركبة</p>
                <p className="font-semibold text-sm text-foreground">{result.vehicle_plate}</p>
                {result.vehicle_brand && (
                  <p className="text-xs text-muted-foreground">{result.vehicle_brand} — {result.vehicle_type === 'motorcycle' ? 'موتوسيكل' : 'سيارة'}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">فترة الاستلام</p>
                <p className="font-semibold text-sm text-foreground">{formatDateTime(result.start_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {result.returned_at ? `حتى: ${formatDateTime(result.returned_at)}` : 'لم يُعَد بعد'}
                </p>
              </div>
            </div>
          </div>

          {/* Assign Violation Form */}
          {!assigned ? (
            <div className="px-6 py-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">تسجيل المخالفة على هذا المندوب</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm mb-1.5 block">
                    مبلغ المخالفة (ر.س) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">ملاحظة إضافية</Label>
                  <Input
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    placeholder="مثال: تجاوز إشارة حمراء"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button
                  onClick={handleAssignViolation}
                  disabled={assigning}
                  className="flex-1 gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  {assigning ? (
                    <>
                      <span className="animate-spin w-4 h-4 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full" />
                      جاري التسجيل...
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={15} />
                      تسجيل المخالفة
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleReset}>إلغاء</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                سيتم تسجيل المخالفة كخصم معلق (بانتظار الموافقة) في ملف المندوب تحت قسم "الخصومات الخارجية".
              </p>
            </div>
          ) : (
            <div className="px-6 py-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-success">تم تسجيل المخالفة بنجاح ✓</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  خصم {parseFloat(form.amount || '0').toLocaleString()} ر.س — بانتظار الموافقة في الخصومات الخارجية
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>بحث جديد</Button>
            </div>
          )}
        </div>
      )}

      {/* ── Info Banner ── */}
      {!result && (
        <div className="bg-muted/40 border border-border/50 rounded-xl p-4 flex gap-3">
          <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">كيف يعمل المُحقق؟</p>
            <p>أدخل رقم لوحة المركبة وتاريخ ووقت المخالفة بدقة. سيقوم النظام تلقائياً بمطابقة الوقت مع سجلات التسليم والاستلام لتحديد المندوب المسؤول.</p>
            <p className="text-xs">ملاحظة: يعتمد النظام على دقة بيانات التسليم والاستلام المسجّلة في صفحة المركبات.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViolationResolver;
