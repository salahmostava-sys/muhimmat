import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, AlertTriangle, XCircle, FileWarning, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  vehicle_plate: string;
  platforms: string[];
  violation_date: string;
  violation_place: string;
  employee_id: string;
  assignment_id: string;
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
  const [assigning, setAssigning] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [noVehicle, setNoVehicle] = useState(false);
  const [assigned, setAssigned] = useState(false);
  const suggRef = useRef<HTMLDivElement>(null);

  // ── Vehicle autocomplete ──────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    const { data } = await supabase
      .from('vehicles')
      .select('id, plate_number, plate_number_en, brand, type')
      .or(`plate_number.ilike.%${q}%,plate_number_en.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(8);
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
    setAssigned(false);
  };

  // ── Search handler ────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const vehicleId = form.selected_vehicle_id;
    const plate = form.plate_number.trim();
    if (!plate) return toast({ title: 'أدخل رقم اللوحة', variant: 'destructive' });

    const dateVal = form.use_time ? form.violation_datetime : form.violation_date_only;
    if (!dateVal) return toast({ title: 'أدخل تاريخ المخالفة', variant: 'destructive' });

    setSearching(true); setResults(null); setNoVehicle(false); setAssigned(false);

    // Find vehicle(s)
    let vehicleIds: string[] = [];
    if (vehicleId) {
      vehicleIds = [vehicleId];
    } else {
      const { data: vData } = await supabase
        .from('vehicles')
        .select('id')
        .ilike('plate_number', `%${plate}%`)
        .limit(5);
      vehicleIds = (vData || []).map(v => v.id);
    }

    if (!vehicleIds.length) { setSearching(false); setNoVehicle(true); return; }

    // Find assignments at that time
    const violationTs = form.use_time
      ? new Date(dateVal).toISOString()
      : new Date(dateVal + 'T12:00:00').toISOString();

    const { data: assignments } = await supabase
      .from('vehicle_assignments')
      .select('id, vehicle_id, employee_id, start_date, start_at, returned_at, end_date, employees(id, name, national_id), vehicles(plate_number, brand, type)')
      .in('vehicle_id', vehicleIds)
      .order('start_at', { ascending: false });

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

    // Fetch platforms for each employee
    const empIds = [...new Set(matched.map(a => a.employee_id))];
    const { data: empApps } = await supabase
      .from('employee_apps')
      .select('employee_id, apps(name)')
      .in('employee_id', empIds)
      .eq('status', 'active');

    const platformsByEmp: Record<string, string[]> = {};
    (empApps || []).forEach(ea => {
      if (!platformsByEmp[ea.employee_id]) platformsByEmp[ea.employee_id] = [];
      const appName = (ea.apps as any)?.name;
      if (appName) platformsByEmp[ea.employee_id].push(appName);
    });

    const rows: ResultRow[] = matched.map(a => ({
      assignment_id: a.id,
      employee_id: a.employee_id,
      employee_name: (a.employees as any)?.name || '—',
      national_id: (a.employees as any)?.national_id || null,
      vehicle_plate: (a.vehicles as any)?.plate_number || plate,
      platforms: platformsByEmp[a.employee_id] || [],
      violation_date: dateVal,
      violation_place: form.place,
    }));

    setResults(rows);
    setSearching(false);
  };

  // ── Assign violation ──────────────────────────────────────────────────────
  const handleAssign = async (row: ResultRow) => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) return toast({ title: 'أدخل مبلغ المخالفة', variant: 'destructive' });
    setAssigning(true);
    const violationDate = form.use_time
      ? form.violation_datetime.split('T')[0]
      : form.violation_date_only;
    const noteText = [
      'مخالفة مرورية',
      `لوحة: ${row.vehicle_plate}`,
      form.place ? `مكان: ${form.place}` : null,
      form.note || null,
    ].filter(Boolean).join(' - ');

    const { error } = await supabase.from('external_deductions').insert({
      employee_id: row.employee_id,
      amount: amt,
      type: 'fine',
      apply_month: violationDate.substring(0, 7),
      incident_date: violationDate,
      note: noteText,
      approval_status: 'pending',
    });
    setAssigning(false);
    if (error) { toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' }); return; }
    setAssigned(true);
    toast({ title: '✅ تم تسجيل المخالفة', description: `على ${row.employee_name}` });
  };

  const handleReset = () => {
    setForm({ plate_number: '', selected_vehicle_id: null, violation_datetime: '', violation_date_only: '', amount: '', note: '', place: '', use_time: true });
    setResults(null); setNoVehicle(false); setAssigned(false); setSuggestions([]);
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

      <div className="max-w-2xl space-y-5">
        {/* ── Search Card ── */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search size={15} className="text-primary" /> بيانات الاستعلام
          </h2>

          {/* Plate number with autocomplete */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative" ref={suggRef}>
              <Label className="text-sm mb-1.5 block">رقم لوحة المركبة <span className="text-destructive">*</span></Label>
              <Input
                value={form.plate_number}
                onChange={e => {
                  setForm(f => ({ ...f, plate_number: e.target.value, selected_vehicle_id: null }));
                  setShowSuggestions(true);
                  setResults(null);
                  setNoVehicle(false);
                  setAssigned(false);
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
          </div>

          {/* Place + Amount + Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">مكان المخالفة</Label>
              <Input
                value={form.place}
                onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
                placeholder="مثال: طريق مكة - جدة"
                className="h-10"
              />
            </div>
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
              {assigned && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle size={13} /> تم تسجيل المخالفة
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">اسم الموظف</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">رقم الهوية</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">رقم المركبة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">المنصة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">تاريخ المخالفة</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">المكان</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => (
                    <tr key={row.assignment_id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{row.employee_name}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">{row.national_id || '—'}</td>
                      <td className="px-4 py-3 text-foreground whitespace-nowrap font-medium">{row.vehicle_plate}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row.platforms.length > 0
                          ? row.platforms.map(p => (
                            <span key={p} className="inline-block text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 ml-1">{p}</span>
                          ))
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{dateDisplay}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{row.violation_place || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant={assigned ? 'outline' : 'destructive'}
                          disabled={assigning || assigned}
                          onClick={() => handleAssign(row)}
                          className="h-7 text-xs px-3"
                        >
                          {assigning ? '...' : assigned ? 'مسجّلة ✓' : 'تسجيل مخالفة'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViolationResolver;
