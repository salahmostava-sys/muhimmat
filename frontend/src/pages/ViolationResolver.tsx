import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, AlertTriangle, XCircle, FileWarning, CheckCircle, RefreshCw, CheckCircle2, Pencil, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { violationService } from '@/services/violationService';

// ─── Types ────────────────────────────────────────────────────────────────────
type VehicleSuggestion = {
  id: string;
  plate_number: string;
  plate_number_en: string | null;
  brand: string | null;
  type: string;
};

type ResultRow = {
  employee_name: string;
  national_id: string | null;
  violation_details: string;
  violation_date: string;
  amount: number;
  status: 'recorded' | 'not_recorded';
  external_deduction_id: string | null;
  employee_id: string;
  assignment_id: string;
};

type ViolationRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  national_id: string | null;
  violation_details: string;
  incident_date: string | null;
  amount: number;
  apply_month: string;
  status: string; // approval_status
};

type ViolationForm = {
  plate_number: string;
  selected_vehicle_id: string | null;
  violation_datetime: string;
  violation_date_only: string; // for date-only mode
  amount: string;
  note: string;
  place: string;
  use_time: boolean;
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ViolationResolver = () => {
  const { toast } = useToast();
  const { permissions: perms } = usePermissions('violation_resolver');
  const [form, setForm] = useState<ViolationForm>({
    plate_number: '',
    selected_vehicle_id: null,
    violation_datetime: '',
    violation_date_only: '',
    amount: '',
    note: '',
    place: '',
    use_time: true,
  });
  const [suggestions, setSuggestions] = useState<VehicleSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [noVehicle, setNoVehicle] = useState(false);
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string | null>(null);
  const suggRef = useRef<HTMLDivElement>(null);

  // ── Violations management table ──
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editViolationId, setEditViolationId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    incident_date: '',
    note: '',
    approval_status: 'pending',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const fetchViolations = useCallback(async () => {
    setViolationsLoading(true);
    const { data, error } = await violationService.getViolations();

    if (error) {
      setViolationsLoading(false);
      return;
    }

    setViolations(
      (data || []).map((v: any) => ({
        id: v.id,
        employee_id: v.employee_id,
        employee_name: v.employees?.name || '—',
        national_id: v.employees?.national_id || null,
        violation_details: v.note || '—',
        incident_date: v.incident_date,
        amount: Number(v.amount) || 0,
        apply_month: v.apply_month,
        status: v.approval_status,
      }))
    );
    setViolationsLoading(false);
  }, []);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  // ── Vehicle autocomplete ──────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    const { data } = await violationService.findVehiclesByPlateQuery(q);
    setSuggestions(data || []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (form.plate_number && !form.selected_vehicle_id) fetchSuggestions(form.plate_number);
    }, 200);
    return () => clearTimeout(t);
  }, [form.plate_number, form.selected_vehicle_id, fetchSuggestions]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectVehicle = (v: VehicleSuggestion) => {
    setForm(f => ({ ...f, plate_number: v.plate_number, selected_vehicle_id: v.id }));
    setSuggestions([]);
    setShowSuggestions(false);
    setResults(null);
    setNoVehicle(false);
    setAssigningEmployeeId(null);
  };

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const enteredAmount = parseFloat(form.amount);
    if (!enteredAmount || enteredAmount <= 0) {
      return toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' });
    }

    const vehicleId = form.selected_vehicle_id;
    const plate = form.plate_number.trim();
    if (!plate) return toast({ title: 'أدخل رقم اللوحة', variant: 'destructive' });

    const dateVal = form.use_time ? form.violation_datetime : form.violation_date_only;
    if (!dateVal) return toast({ title: 'أدخل تاريخ المخالفة', variant: 'destructive' });

    const violationDate = form.use_time
      ? (form.violation_datetime.split('T')[0] || '')
      : form.violation_date_only;
    if (!violationDate) return toast({ title: 'أدخل تاريخ المخالفة', variant: 'destructive' });

    setSearching(true); setResults(null); setNoVehicle(false); setAssigningEmployeeId(null);

    // Find vehicle(s)
    let vehicleIds: string[] = [];
    if (vehicleId) {
      vehicleIds = [vehicleId];
    } else {
      const { data: vData } = await violationService.findVehicleIdsByPlate(plate);
      vehicleIds = (vData || []).map(v => v.id);
    }

    if (!vehicleIds.length) { setSearching(false); setNoVehicle(true); return; }

    // Find assignments at that time
    const violationTs = form.use_time
      ? new Date(dateVal).toISOString()
      : new Date(dateVal + 'T12:00:00').toISOString();

    const { data: assignments } = await violationService.getAssignmentsByVehicleIds(vehicleIds);

    if (!assignments?.length) { setSearching(false); setResults([]); return; }

    const violationTime = new Date(violationTs).getTime();

    let matched = assignments.filter(a => {
      const start = a.start_at ? new Date(a.start_at).getTime() : new Date(a.start_date).getTime();
      const end = a.returned_at
        ? new Date(a.returned_at).getTime()
        : a.end_date ? new Date(a.end_date + 'T23:59:59').getTime() : Date.now() + 1;
      return violationTime >= start && violationTime <= end;
    });

    // if no exact match by timestamp, fallback to same day
    if (!matched.length && !form.use_time) {
      const dayStart = new Date(dateVal + 'T00:00:00').getTime();
      const dayEnd = new Date(dateVal + 'T23:59:59').getTime();
      matched = assignments.filter(a => {
        const start = a.start_at ? new Date(a.start_at).getTime() : new Date(a.start_date).getTime();
        const end = a.returned_at
          ? new Date(a.returned_at).getTime()
          : a.end_date ? new Date(a.end_date + 'T23:59:59').getTime() : Date.now() + 1;
        return start <= dayEnd && end >= dayStart;
      });
    }

    if (!matched.length) { setSearching(false); setResults([]); return; }

    const empIds = [...new Set(matched.map(a => a.employee_id))];

    // Existing external_deductions for this employee/date/amount
    const applyMonth = violationDate.substring(0, 7);
    const { data: existingDeduction } = await violationService.getExistingFineDeductions(empIds, violationDate, applyMonth);

    const recordedByEmployee = new Map<string, { id: string; amount: number }>();
    (existingDeduction || []).forEach((d: any) => {
      const amt = Number(d.amount) || 0;
      if (amt === enteredAmount && !recordedByEmployee.has(d.employee_id)) {
        recordedByEmployee.set(d.employee_id, { id: d.id, amount: amt });
      }
    });

    const rows: ResultRow[] = matched.map(a => {
      const vehiclePlate = (a.vehicles as any)?.plate_number || plate;
      const violationDetails = [
        vehiclePlate ? `لوحة: ${vehiclePlate}` : null,
        form.place ? `مكان: ${form.place}` : null,
      ].filter(Boolean).join(' — ');

      const rec = recordedByEmployee.get(a.employee_id) || null;
      return {
      assignment_id: a.id,
      employee_id: a.employee_id,
      employee_name: (a.employees as any)?.name || '—',
      national_id: (a.employees as any)?.national_id || null,
      violation_details: violationDetails || '—',
      violation_date: violationDate,
      amount: enteredAmount,
      status: rec ? 'recorded' : 'not_recorded',
      external_deduction_id: rec?.id || null,
    };
    });

    setResults(rows);
    setSearching(false);
  };

  // ── Assign violation ──────────────────────────────────────────────────────
  const handleAssign = async (row: ResultRow) => {
    const amt = row.amount;
    if (!amt || amt <= 0) return toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' });
    if (row.status === 'recorded' && row.external_deduction_id) return;
    setAssigningEmployeeId(row.employee_id);
    const violationDate = row.violation_date;
    const noteText = [
      'مخالفة مرورية',
      row.violation_details,
      form.note || null,
    ].filter(Boolean).join(' - ');

    const { data: inserted, error } = await violationService.createFineDeduction({
      employee_id: row.employee_id,
      amount: amt,
      type: 'fine',
      apply_month: violationDate.substring(0, 7),
      incident_date: violationDate,
      note: noteText,
      approval_status: 'pending',
    });

    setAssigningEmployeeId(null);
    if (error) { toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }); return; }

    setResults(prev => {
      if (!prev) return prev;
      return prev.map(r => r.employee_id === row.employee_id
        ? { ...r, status: 'recorded', external_deduction_id: inserted?.id || r.external_deduction_id }
        : r
      );
    });

    toast({ title: '✅ تم تسجيل المخالفة', description: `على ${row.employee_name}` });
    fetchViolations();
  };

  const openEditViolation = (v: ViolationRecord) => {
    setEditViolationId(v.id);
    setEditForm({
      amount: String(v.amount ?? ''),
      incident_date: v.incident_date || '',
      note: v.violation_details || '',
      approval_status: v.status || 'pending',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editViolationId) return;
    const amount = parseFloat(editForm.amount);
    if (!amount || amount <= 0) return toast({ title: 'خطأ', description: 'أدخل مبلغ صحيح', variant: 'destructive' });
    if (!editForm.incident_date) return toast({ title: 'خطأ', description: 'أدخل تاريخ المخالفة', variant: 'destructive' });

    setEditSaving(true);
    const { error } = await violationService.updateViolation(editViolationId, {
        amount,
        incident_date: editForm.incident_date,
        note: editForm.note,
        approval_status: editForm.approval_status as 'pending' | 'approved' | 'rejected',
      });

    setEditSaving(false);
    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
      return;
    }

    setEditDialogOpen(false);
    setEditViolationId(null);
    fetchViolations();
    toast({ title: 'تم الحفظ ✅' });
  };

  const handleDeleteViolation = async (id: string) => {
    if (!perms.can_delete) {
      toast({ title: 'صلاحية غير كافية', description: 'ليس لديك صلاحية الحذف', variant: 'destructive' });
      return;
    }
    setDeletingId(id);
    const { error } = await violationService.deleteViolation(id);
    setDeletingId(null);
    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    fetchViolations();
    toast({ title: 'تم الحذف' });
  };

  const handleConvertToAdvance = async (v: ViolationRecord) => {
    if (!v.apply_month) return toast({ title: 'خطأ', description: 'بيانات القسط غير مكتملة', variant: 'destructive' });
    const today = new Date().toISOString().slice(0, 10);
    const violationDate = v.incident_date || today;

    const details = (v.violation_details || '').replace(/^مخالفة مرورية\\s*[-–—:]*\\s*/u, '').trim() || '—';
    const noteText = `مخالفة مرورية — ${details} — بتاريخ ${violationDate} — تم الخصم بتاريخ ${today}`;

    // Guard against converting the same fine multiple times
    const amountMin = v.amount - 0.01;
    const amountMax = v.amount + 0.01;
    const { data: existingAdv } = await violationService.findMatchingAdvanceForFine(v.employee_id, v.apply_month, amountMin, amountMax);

    if (existingAdv && existingAdv.length > 0) {
      toast({ title: 'تم التحويل مسبقاً', description: 'يوجد سلفة نشطة مطابقة لهذه المخالفة.' });
      return;
    }

    setConvertingId(v.id);
    const { data: advInserted, error: advErr } = await violationService.createAdvanceFromFine({
        employee_id: v.employee_id,
        amount: v.amount,
        disbursement_date: today,
        total_installments: 1,
        monthly_amount: v.amount,
        first_deduction_month: v.apply_month,
        note: noteText,
        status: 'active',
      });

    if (advErr || !advInserted?.id) {
      setConvertingId(null);
      toast({ title: 'حدث خطأ', description: (advErr as any)?.message || 'تعذر إنشاء السلفة', variant: 'destructive' });
      return;
    }

    const { error: instErr } = await violationService.createSingleInstallment({
      advance_id: advInserted.id,
      month_year: v.apply_month,
      amount: v.amount,
      status: 'pending',
    });

    setConvertingId(null);
    if (instErr) {
      toast({ title: 'حدث خطأ', description: instErr.message, variant: 'destructive' });
      return;
    }

    fetchViolations();
    toast({ title: 'تم التحويل إلى سلفة ✅' });
  };

  const handleReset = () => {
    setForm({ plate_number: '', selected_vehicle_id: null, violation_datetime: '', violation_date_only: '', amount: '', note: '', place: '', use_time: true });
    setResults(null); setNoVehicle(false); setAssigningEmployeeId(null); setSuggestions([]);
  };

  const dateDisplay = form.use_time
    ? (form.violation_datetime ? format(new Date(form.violation_datetime), 'dd/MM/yyyy HH:mm', { locale: ar }) : '—')
    : (form.violation_date_only ? format(parseISO(form.violation_date_only), 'dd/MM/yyyy', { locale: ar }) : '—');

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <FileWarning className="text-destructive" size={22} />
        </div>
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">استعلام المخالفات</span>
          </nav>
          <h1 className="page-title">استعلام المخالفات</h1>
        </div>
      </div>

      <div className="max-w-5xl space-y-4">
        {/* ── Search Card ── */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search size={15} className="text-primary" /> بيانات الاستعلام
          </h2>

          {/* Filters in one horizontal row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Plate number with autocomplete */}
            <div className="relative" ref={suggRef}>
              <Label className="text-sm mb-1.5 block">رقم لوحة المركبة <span className="text-destructive">*</span></Label>
              <Input
                value={form.plate_number}
                onChange={e => {
                  setForm(f => ({ ...f, plate_number: e.target.value, selected_vehicle_id: null }));
                  setShowSuggestions(true);
                  setResults(null);
                  setNoVehicle(false);
                  setAssigningEmployeeId(null);
                }}
                onFocus={() => form.plate_number && setShowSuggestions(true)}
                placeholder="مثال: أ ب ج 1234"
                className="h-10"
                autoComplete="off"
              />
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {suggestions.map(v => (
                    <button
                      key={v.id}
                      onMouseDown={() => selectVehicle(v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/60 text-sm text-right transition-colors"
                    >
                      <span className="font-semibold text-foreground">{v.plate_number}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.plate_number_en && <span className="ml-2 text-muted-foreground/60">{v.plate_number_en}</span>}
                        {v.brand && <span>{v.brand} · </span>}
                        <span>{v.type === 'motorcycle' ? 'دراجة' : 'سيارة'}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {/* Selected badge */}
              {form.selected_vehicle_id && (
                <p className="text-xs text-success mt-1 flex items-center gap-1">
                  <CheckCircle size={11} /> تم تحديد المركبة
                </p>
              )}
            </div>

            {/* Date / datetime toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-sm">تاريخ المخالفة <span className="text-destructive">*</span></Label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, use_time: !f.use_time }))}
                  className="text-xs text-primary hover:underline"
                >
                  {form.use_time ? 'بدون وقت' : 'مع الوقت'}
                </button>
              </div>
              {form.use_time ? (
                <Input
                  type="datetime-local"
                  value={form.violation_datetime}
                  onChange={e => setForm(f => ({ ...f, violation_datetime: e.target.value }))}
                  className="h-10"
                />
              ) : (
                <Input
                  type="date"
                  value={form.violation_date_only}
                  onChange={e => setForm(f => ({ ...f, violation_date_only: e.target.value }))}
                  className="h-10"
                />
              )}
            </div>

            {/* Place */}
            <div>
              <Label className="text-sm mb-1.5 block">مكان المخالفة</Label>
              <Input
                value={form.place}
                onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
                placeholder="مثال: طريق مكة - جدة"
                className="h-10"
              />
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm mb-1.5 block">المبلغ (ر.س)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="h-10"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">ملاحظة إضافية</Label>
            <Input
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="أي تفاصيل إضافية..."
              className="h-10"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={searching} className="flex-1 gap-2 h-11 text-base font-semibold">
              {searching
                ? <><span className="animate-spin w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full" />جاري البحث...</>
                : <><Search size={17} />بحث عن المسؤول</>}
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-11 gap-1.5">
              <RefreshCw size={14} /> مسح
            </Button>
          </div>
        </div>

        {/* ── No Vehicle Found ── */}
        {noVehicle && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <XCircle className="mx-auto text-muted-foreground" size={36} />
            <p className="font-semibold text-foreground">لم يتم العثور على المركبة</p>
            <p className="text-sm text-muted-foreground">
              لا توجد مركبة نشطة بالرقم "<span className="font-medium">{form.plate_number}</span>" في النظام.
            </p>
          </div>
        )}

        {/* ── No Assignment Found ── */}
        {results !== null && results.length === 0 && !noVehicle && (
          <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
            <AlertTriangle className="mx-auto text-warning" size={36} />
            <p className="font-semibold text-foreground">لا يوجد سائق مسؤول في هذا التوقيت</p>
            <p className="text-sm text-muted-foreground">
              لم يتم تسليم المركبة لأي مندوب في تاريخ <span className="font-medium">{dateDisplay}</span>.
            </p>
          </div>
        )}

        {/* ── Results Table ── */}
        {results && results.length > 0 && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                نتائج الاستعلام · {results.length} سجل
              </h2>
              <span className="text-xs text-muted-foreground">اضغط على ✓ لتأكيد التسجيل لكل موظف</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">اسم الموظف</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">تفاصيل المخالفة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">المبلغ</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">تأكيد</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={row.assignment_id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{row.employee_name}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{row.violation_details || '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{row.violation_date}</td>
                      <td className="px-4 py-3 text-center font-medium text-foreground whitespace-nowrap">
                        {row.amount.toLocaleString()} ر.س
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {row.status === 'recorded' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                            <CheckCircle2 size={12} /> مسجّلة
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">
                            — غير مسجّلة
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant={row.status === 'recorded' ? 'outline' : 'destructive'}
                          disabled={!perms.can_edit || assigningEmployeeId === row.employee_id || row.status === 'recorded'}
                          onClick={() => handleAssign(row)}
                          className="h-7 text-xs px-3"
                        >
                          {assigningEmployeeId === row.employee_id ? '...' : row.status === 'recorded' ? 'مسجّلة ✓' : 'تأكيد ✓'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Violations Management ── */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              إدارة المخالفات المسجلة
            </h2>
            <span className="text-xs text-muted-foreground">{violationsLoading ? 'جارٍ التحميل...' : `${violations.length} سجل`}</span>
          </div>

          {violationsLoading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>
          ) : violations.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-3 text-success opacity-30" size={48} />
              <p className="font-medium">لا توجد مخالفات مسجلة</p>
              <p className="text-sm mt-1">قم بعمل بحث ثم تأكيد ✓ للحفظ.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">اسم الموظف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">تفاصيل المخالفة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">التاريخ</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">المبلغ</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">الحالة</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {violations.map(v => {
                    const statusBadge =
                      v.status === 'approved'
                        ? 'bg-success/10 text-success border-success/20'
                        : v.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive border-destructive/20'
                          : 'bg-muted text-muted-foreground border-border/50';

                    return (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">{v.employee_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <div className="max-w-[520px]">{v.violation_details || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{v.incident_date || '—'}</td>
                        <td className="px-4 py-3 text-center font-medium whitespace-nowrap">{v.amount?.toLocaleString()} ر.س</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${statusBadge}`}>
                            {v.status === 'pending' ? 'قيد المراجعة' : v.status === 'approved' ? 'موافَق' : v.status === 'rejected' ? 'مرفوض' : v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs"
                              disabled={!perms.can_edit}
                              onClick={() => openEditViolation(v)}
                            >
                              <Pencil size={14} /> تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                              disabled={!perms.can_delete || deletingId === v.id}
                              onClick={() => handleDeleteViolation(v.id)}
                            >
                              <Trash2 size={14} /> {deletingId === v.id ? '...' : 'حذف'}
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-2 text-xs gap-2"
                              disabled={!perms.can_edit || convertingId === v.id}
                              onClick={() => handleConvertToAdvance(v)}
                            >
                              <CreditCard size={14} />
                              {convertingId === v.id ? '...' : 'Convert to Advance'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Edit Modal ── */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل المخالفة</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>المبلغ (ر.س)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.amount}
                  onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label>تاريخ المخالفة</Label>
                <Input
                  type="date"
                  value={editForm.incident_date}
                  onChange={e => setEditForm(p => ({ ...p, incident_date: e.target.value }))}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={editForm.approval_status} onValueChange={val => setEditForm(p => ({ ...p, approval_status: val }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                    <SelectItem value="approved">موافَق</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>ملاحظات / تفاصيل</Label>
                <Textarea
                  value={editForm.note}
                  onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editSaving}>
                إلغاء
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSaving || !perms.can_edit}>
                {editSaving ? '...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ViolationResolver;
