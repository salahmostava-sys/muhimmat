import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle, XCircle, FileWarning, CheckCircle, RefreshCw, CheckCircle2, Pencil, Trash2, CreditCard } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Textarea } from '@shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { violationService } from '@services/violationService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { sortArrowOrNeutral } from '@shared/lib/sortTableIndicators';
import { defaultQueryRetry } from '@shared/lib/query';

// ─── Types ────────────────────────────────────────────────────────────────────
type VehicleSuggestion = {
  id: string;
  plate_number: string;
  plate_number_en: string | null;
  brand: string | null;
  type: string;
};
type AssignmentJoinRow = {
  id: string;
  employee_id: string;
  vehicles?: { plate_number?: string | null } | null;
  employees?: { name?: string | null; national_id?: string | null } | null;
};

type DeductionRow = {
  id: string;
  employee_id: string;
  amount: number | string | null;
};

type ViolationDataRow = {
  id: string;
  employee_id: string;
  note: string | null;
  incident_date: string | null;
  amount: number | string | null;
  apply_month: string;
  approval_status: string;
  linked_advance_id?: string | null;
  employees?: { name?: string | null; national_id?: string | null } | null;
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
  /** مربوط بجدول السلف عند التحويل — المصدر الرسمي لحالة السلفة */
  linked_advance_id: string | null;
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

type ViolationSortFieldKey =
  | 'employee_name'
  | 'violation_details'
  | 'incident_date'
  | 'amount'
  | 'status'
  | 'advance_status';

type VehicleAssignmentForViolation = {
  start_at?: string | null;
  start_date: string;
  returned_at?: string | null;
  end_date?: string | null;
};

function assignmentStartMs(a: VehicleAssignmentForViolation): number {
  return a.start_at ? new Date(a.start_at).getTime() : new Date(a.start_date).getTime();
}

function assignmentEndMs(a: VehicleAssignmentForViolation): number {
  if (a.returned_at) return new Date(a.returned_at).getTime();
  if (a.end_date) return new Date(a.end_date + 'T23:59:59').getTime();
  return Date.now() + 1;
}

function formatViolationFormDateDisplay(form: ViolationForm): string {
  if (form.use_time) {
    if (!form.violation_datetime) return '—';
    return format(new Date(form.violation_datetime), 'dd/MM/yyyy HH:mm', { locale: ar });
  }
  if (!form.violation_date_only) return '—';
  return format(parseISO(form.violation_date_only), 'dd/MM/yyyy', { locale: ar });
}

function searchResultAssignButtonLabel(row: ResultRow, assigningEmployeeId: string | null): string {
  if (assigningEmployeeId === row.employee_id) return '...';
  if (row.status === 'recorded') return 'مسجّلة ✓';
  return 'تأكيد ✓';
}

function violationApprovalStatusLabel(status: string): string {
  if (status === 'pending') return 'قيد المراجعة';
  if (status === 'approved') return 'موافَق';
  if (status === 'rejected') return 'مرفوض';
  return status;
}

function convertToAdvanceTitle(convertedAdv: boolean): string {
  if (convertedAdv) return 'تم تحويل هذه المخالفة لسلفة';
  return 'تحويل لسلفة';
}

function convertToAdvanceButtonLabel(convertingId: string | null, violationId: string, convertedAdv: boolean): string {
  if (convertingId === violationId) return '...';
  if (convertedAdv) return 'تم التحويل لسلفة ✓';
  return 'تحويل لسلفة';
}

function deleteViolationButtonLabel(deletingId: string | null, violationId: string): string {
  return deletingId === violationId ? '...' : 'حذف';
}

function savedViolationsCountLabel(loading: boolean, count: number): string {
  if (loading) return 'جارٍ التحميل...';
  return `${count} سجل`;
}

type ViolationAdvanceStatusCellProps = Readonly<{
  v: ViolationRecord;
  convertedAdv: boolean;
}>;

function ViolationAdvanceStatusCell({ v, convertedAdv }: ViolationAdvanceStatusCellProps) {
  if (v.linked_advance_id) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="text-[11px] px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/25 font-medium">
          محوّل لسلفة
        </span>
        <span className="text-[10px] font-mono text-muted-foreground dir-ltr" title={v.linked_advance_id}>
          {v.linked_advance_id.slice(0, 8)}…
        </span>
      </span>
    );
  }
  if (convertedAdv) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground" title="سجل قديم: مذكور في الملاحظة فقط">
        محوّل (قديم)
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">—</span>;
}

function violationApprovalBadgeClasses(status: string): string {
  if (status === 'approved') return 'bg-success/10 text-success border-success/20';
  if (status === 'rejected') return 'bg-destructive/10 text-destructive border-destructive/20';
  return 'bg-muted text-muted-foreground border-border/50';
}

function getViolationSortValue(
  row: ViolationRecord,
  field: ViolationSortFieldKey,
  isConverted: (v: ViolationRecord) => boolean
): string | number {
  switch (field) {
    case 'amount':
      return row.amount || 0;
    case 'incident_date':
      return row.incident_date || '';
    case 'status':
      return row.status || '';
    case 'violation_details':
      return row.violation_details || '';
    case 'advance_status':
      return isConverted(row) ? 1 : 0;
    default:
      return row.employee_name || '';
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const ViolationResolver = () => {
  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
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
  const {
    data: violationsData = [],
    isLoading: violationsLoading,
    error: violationsError,
    refetch: refetchViolations,
  } = useQuery({
    queryKey: ['violation-resolver', uid, 'violations'],
    enabled,
    queryFn: async () => {
      const rows = await violationService.getViolations();
      return ((rows as ViolationDataRow[]) || []).map((v) => ({
        id: v.id,
        employee_id: v.employee_id,
        employee_name: v.employees?.name || '—',
        national_id: v.employees?.national_id || null,
        violation_details: v.note || '—',
        incident_date: v.incident_date,
        amount: Number(v.amount) || 0,
        apply_month: v.apply_month,
        status: v.approval_status,
        linked_advance_id: v.linked_advance_id ?? null,
      })) as ViolationRecord[];
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });

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
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search');
  const [vSortField, setVSortField] = useState<ViolationSortFieldKey>('incident_date');
  const [vSortDir, setVSortDir] = useState<'asc' | 'desc'>('desc');
  const [savedSearch, setSavedSearch] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const isAdvanceLegacyNote = useCallback(
    (details: string) => /تم التحويل لسلفة|معرّف السلفة:/u.test(details || ''),
    []
  );

  const isViolationConvertedToAdvance = useCallback(
    (v: ViolationRecord) => Boolean(v.linked_advance_id) || isAdvanceLegacyNote(v.violation_details),
    [isAdvanceLegacyNote]
  );

  const fetchViolations = useCallback(() => {
    void refetchViolations();
  }, [refetchViolations]);

  useEffect(() => {
    setViolations(violationsData);
  }, [violationsData]);

  useEffect(() => {
    if (!violationsError) return;
    const message =
      violationsError instanceof Error
        ? violationsError.message
        : 'تعذر تحميل سجل المخالفات';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [violationsError, toast]);

  // ── Vehicle autocomplete ──────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    const data = await violationService.findVehiclesByPlateQuery(q);
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
    const enteredAmount = Number.parseFloat(form.amount);
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
    const vehicleIds = vehicleId
      ? [vehicleId]
      : ((await violationService.findVehicleIdsByPlate(plate)) || []).map(v => v.id);

    if (!vehicleIds.length) { setSearching(false); setNoVehicle(true); return; }

    // Find assignments at that time
    const violationTs = form.use_time
      ? new Date(dateVal).toISOString()
      : new Date(dateVal + 'T12:00:00').toISOString();

    const assignments = await violationService.getAssignmentsByVehicleIds(vehicleIds);

    if (!assignments?.length) { setSearching(false); setResults([]); return; }

    const violationTime = new Date(violationTs).getTime();

    let matched = assignments.filter((a) => {
      const start = assignmentStartMs(a as VehicleAssignmentForViolation);
      const end = assignmentEndMs(a as VehicleAssignmentForViolation);
      return violationTime >= start && violationTime <= end;
    });

    // if no exact match by timestamp, fallback to same day
    if (!matched.length && !form.use_time) {
      const dayStart = new Date(dateVal + 'T00:00:00').getTime();
      const dayEnd = new Date(dateVal + 'T23:59:59').getTime();
      matched = assignments.filter((a) => {
        const start = assignmentStartMs(a as VehicleAssignmentForViolation);
        const end = assignmentEndMs(a as VehicleAssignmentForViolation);
        return start <= dayEnd && end >= dayStart;
      });
    }

    if (!matched.length) { setSearching(false); setResults([]); return; }

    const empIds = [...new Set(matched.map(a => a.employee_id))];

    // Existing external_deductions for this employee/date/amount
    const applyMonth = violationDate.substring(0, 7);
    const existingDeduction = await violationService.getExistingFineDeductions(empIds, violationDate, applyMonth);

    const recordedByEmployee = new Map<string, { id: string; amount: number }>();
    (existingDeduction as DeductionRow[] || []).forEach((d) => {
      const amt = Number(d.amount) || 0;
      if (amt === enteredAmount && !recordedByEmployee.has(d.employee_id)) {
        recordedByEmployee.set(d.employee_id, { id: d.id, amount: amt });
      }
    });

    const rows: ResultRow[] = (matched as AssignmentJoinRow[]).map((a) => {
      const vehiclePlate = a.vehicles?.plate_number || plate;
      const violationDetails = [
        vehiclePlate ? `لوحة: ${vehiclePlate}` : null,
        form.place ? `مكان: ${form.place}` : null,
      ].filter(Boolean).join(' — ');

      const rec = recordedByEmployee.get(a.employee_id) || null;
      return {
      assignment_id: a.id,
      employee_id: a.employee_id,
      employee_name: a.employees?.name || '—',
      national_id: a.employees?.national_id || null,
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

    let inserted: { id: string };
    try {
      inserted = await violationService.createFineDeduction({
        employee_id: row.employee_id,
        amount: amt,
        type: 'fine',
        apply_month: violationDate.substring(0, 7),
        incident_date: violationDate,
        note: noteText,
        approval_status: 'pending',
      });
    } catch (e: unknown) {
      setAssigningEmployeeId(null);
      const message = e instanceof Error ? e.message : 'حدث خطأ';
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    setAssigningEmployeeId(null);

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
    const amount = Number.parseFloat(editForm.amount);
    if (!amount || amount <= 0) return toast({ title: 'خطأ', description: 'أدخل مبلغ صحيح', variant: 'destructive' });
    if (!editForm.incident_date) return toast({ title: 'خطأ', description: 'أدخل تاريخ المخالفة', variant: 'destructive' });

    setEditSaving(true);
    try {
      await violationService.updateViolation(editViolationId, {
        amount,
        incident_date: editForm.incident_date,
        note: editForm.note,
        approval_status: editForm.approval_status as 'pending' | 'approved' | 'rejected',
      });
    } catch (e: unknown) {
      setEditSaving(false);
      const message = e instanceof Error ? e.message : 'حدث خطأ';
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    setEditSaving(false);

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
    try {
      await violationService.deleteViolation(id);
    } catch (e: unknown) {
      setDeletingId(null);
      const message = e instanceof Error ? e.message : 'حدث خطأ';
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }
    setDeletingId(null);
    fetchViolations();
    toast({ title: 'تم الحذف' });
  };

  const handleConvertToAdvance = async (v: ViolationRecord) => {
    if (!v.apply_month) return toast({ title: 'خطأ', description: 'بيانات القسط غير مكتملة', variant: 'destructive' });
    if (isViolationConvertedToAdvance(v)) {
      toast({ title: 'تم التحويل مسبقاً', description: 'هذه المخالفة مسجّلة كسلفة بالفعل.', variant: 'destructive' });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const violationDate = v.incident_date || today;
    const fullDetails = (v.violation_details || '').trim() || '—';

    const advanceNote = [
      `مخالفة مرورية بتاريخ ${violationDate}.`,
      `المبلغ: ${v.amount.toLocaleString()} ر.س — شهر الخصم: ${v.apply_month}`,
      '',
      'تفاصيل المخالفة (كاملة):',
      fullDetails,
      '',
      `تم إنشاء السلفة بتاريخ ${today}.`,
    ].join('\n');

    // Guard against converting the same fine multiple times
    const amountMin = v.amount - 0.01;
    const amountMax = v.amount + 0.01;
    const existingAdv = await violationService.findMatchingAdvanceForFine(v.employee_id, v.apply_month, amountMin, amountMax);

    if (existingAdv.length > 0) {
      toast({ title: 'تم التحويل مسبقاً', description: 'يوجد سلفة نشطة مطابقة لهذه المخالفة.' });
      return;
    }

    setConvertingId(v.id);
    let advInserted: { id: string };
    try {
      advInserted = await violationService.createAdvanceFromFine({
        employee_id: v.employee_id,
        amount: v.amount,
        disbursement_date: today,
        total_installments: 1,
        monthly_amount: v.amount,
        first_deduction_month: v.apply_month,
        note: advanceNote,
        status: 'active',
      });
    } catch (e: unknown) {
      setConvertingId(null);
      const message = e instanceof Error ? e.message : 'تعذر إنشاء السلفة';
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    if (!advInserted?.id) {
      setConvertingId(null);
      toast({ title: 'حدث خطأ', description: 'تعذر إنشاء السلفة', variant: 'destructive' });
      return;
    }

    try {
      await violationService.createSingleInstallment({
        advance_id: advInserted.id,
        month_year: v.apply_month,
        amount: v.amount,
        status: 'pending',
      });
    } catch (e: unknown) {
      setConvertingId(null);
      const message = e instanceof Error ? e.message : 'حدث خطأ';
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      return;
    }

    const appended = [
      fullDetails,
      '',
      `[تم التحويل لسلفة بتاريخ ${today} — معرّف السلفة: ${advInserted.id}]`,
    ].join('\n');

    try {
      await violationService.updateViolation(v.id, {
        note: appended,
        linked_advance_id: advInserted.id,
      });
    } catch {
      toast({ title: 'تم إنشاء السلفة', description: 'تعذر ربط سجل المخالفة بالسلفة في النظام — راجع السجل يدوياً.' });
    }
    setConvertingId(null);

    fetchViolations();
    toast({ title: 'تم تحويل لسلفة ✅', description: `رقم السلفة: ${advInserted.id.slice(0, 8)}…` });
  };

  const sortedViolations = useMemo(() => {
    const rows = [...violations];
    rows.sort((a, b) => {
      const va = getViolationSortValue(a, vSortField, isViolationConvertedToAdvance);
      const vb = getViolationSortValue(b, vSortField, isViolationConvertedToAdvance);
      if (va < vb) return vSortDir === 'asc' ? -1 : 1;
      if (va > vb) return vSortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [isViolationConvertedToAdvance, violations, vSortDir, vSortField]);

  const filteredSortedViolations = useMemo(() => {
    const query = savedSearch.trim().toLowerCase();
    return sortedViolations.filter((row) => {
      if (savedStatusFilter !== 'all' && row.status !== savedStatusFilter) return false;
      if (!query) return true;
      return row.employee_name.toLowerCase().includes(query)
        || row.violation_details.toLowerCase().includes(query);
    });
  }, [savedSearch, savedStatusFilter, sortedViolations]);

  const violationStats = useMemo(() => {
    const total = violations.length;
    const pending = violations.filter((v) => v.status === 'pending').length;
    const approved = violations.filter((v) => v.status === 'approved').length;
    const converted = violations.filter((v) => isViolationConvertedToAdvance(v)).length;
    return { total, pending, approved, converted };
  }, [isViolationConvertedToAdvance, violations]);

  const toggleVSort = (field: ViolationSortFieldKey) => {
    if (vSortField === field) setVSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setVSortField(field);
      setVSortDir('asc');
    }
  };

  const handleReset = () => {
    setForm({ plate_number: '', selected_vehicle_id: null, violation_datetime: '', violation_date_only: '', amount: '', note: '', place: '', use_time: true });
    setResults(null); setNoVehicle(false); setAssigningEmployeeId(null); setSuggestions([]);
  };

  const dateDisplay = formatViolationFormDateDisplay(form);

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-sm">إجمالي المخالفات: <span className="font-bold">{violationStats.total}</span></div>
          <div className="rounded-lg border bg-card p-3 text-sm">قيد المراجعة: <span className="font-bold">{violationStats.pending}</span></div>
          <div className="rounded-lg border bg-card p-3 text-sm">موافَق: <span className="font-bold">{violationStats.approved}</span></div>
          <div className="rounded-lg border bg-card p-3 text-sm">محوّل لسلفة: <span className="font-bold">{violationStats.converted}</span></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={activeTab === 'search' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('search')}>
            الاستعلام
          </Button>
          <Button
            variant={activeTab === 'saved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('saved');
              fetchViolations();
            }}
          >
            المخالفات المرحلة
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">المرحلة = المخالفات المؤكدة ✓ المحفوظة دائماً هنا</span>
        </div>

        {activeTab === 'search' && (
          <>
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
            <div className="px-5 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                نتائج الاستعلام · {results.length} سجل
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">اضغط ✓ لتسجيل المخالفة ثم</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setActiveTab('saved');
                    fetchViolations();
                  }}
                >
                  ترحيل ← المخالفات المرحلة
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">اسم الموظف</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">تفاصيل المخالفة</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">التاريخ</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">المبلغ</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground">الحالة</th>
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
                          {searchResultAssignButtonLabel(row, assigningEmployeeId)}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </>
        )}

        {/* ── Violations Management ── */}
        {activeTab === 'saved' && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                المخالفات المرحلة (المحفوظة)
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">كل ما تم تأكيده من الاستعلام يظهر هنا — ترتيب الأعمدة بالضغط على العنوان</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActiveTab('search')}>
                ← رجوع للاستعلام
              </Button>
              <span className="text-xs text-muted-foreground">{savedViolationsCountLabel(violationsLoading, violations.length)}</span>
            </div>
          </div>

          <div className="px-5 py-3 border-b border-border/40 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input
                value={savedSearch}
                onChange={(e) => setSavedSearch(e.target.value)}
                placeholder="بحث باسم الموظف أو تفاصيل المخالفة..."
                className="h-9"
              />
              <Select value={savedStatusFilter} onValueChange={(v) => setSavedStatusFilter(v as 'all' | 'pending' | 'approved' | 'rejected')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  <SelectItem value="pending">قيد المراجعة</SelectItem>
                  <SelectItem value="approved">موافَق</SelectItem>
                  <SelectItem value="rejected">مرفوض</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(() => {
            if (violationsLoading) {
              return <div className="p-10 text-center text-muted-foreground text-sm">جارٍ التحميل...</div>;
            }
            if (filteredSortedViolations.length === 0) {
              return (
                <div className="p-12 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-3 text-success opacity-30" size={48} />
                  <p className="font-medium">لا توجد نتائج مطابقة</p>
                  <p className="text-sm mt-1">غيّر الفلاتر أو قم بتسجيل مخالفات جديدة.</p>
                </div>
              );
            }
            return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th onClick={() => toggleVSort('employee_name')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      اسم الموظف {sortArrowOrNeutral(vSortField, 'employee_name', vSortDir, '⇅')}
                    </th>
                    <th onClick={() => toggleVSort('violation_details')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none min-w-[200px]">
                      تفاصيل المخالفة {sortArrowOrNeutral(vSortField, 'violation_details', vSortDir, '⇅')}
                    </th>
                    <th onClick={() => toggleVSort('incident_date')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      التاريخ {sortArrowOrNeutral(vSortField, 'incident_date', vSortDir, '⇅')}
                    </th>
                    <th onClick={() => toggleVSort('amount')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      المبلغ {sortArrowOrNeutral(vSortField, 'amount', vSortDir, '⇅')}
                    </th>
                    <th onClick={() => toggleVSort('status')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none">
                      الحالة {sortArrowOrNeutral(vSortField, 'status', vSortDir, '⇅')}
                    </th>
                    <th onClick={() => toggleVSort('advance_status')} className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none" title="مربوط بجدول السلف في قاعدة البيانات أو سجل قديم في الملاحظة">
                      حالة السلفة {sortArrowOrNeutral(vSortField, 'advance_status', vSortDir, '⇅')}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredSortedViolations.map(v => {
                    const statusBadge = violationApprovalBadgeClasses(v.status);
                    const convertedAdv = isViolationConvertedToAdvance(v);

                    return (
                      <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold whitespace-nowrap">{v.employee_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs align-top">
                          <div className="max-w-[520px] whitespace-pre-wrap break-words">{v.violation_details || '—'}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{v.incident_date || '—'}</td>
                        <td className="px-4 py-3 text-center font-medium whitespace-nowrap">{v.amount?.toLocaleString()} ر.س</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${statusBadge}`}>
                            {violationApprovalStatusLabel(v.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap align-top">
                          <ViolationAdvanceStatusCell v={v} convertedAdv={convertedAdv} />
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
                              <Trash2 size={14} /> {deleteViolationButtonLabel(deletingId, v.id)}
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 px-2 text-xs gap-2"
                              disabled={!perms.can_edit || convertingId === v.id || convertedAdv}
                              onClick={() => handleConvertToAdvance(v)}
                              title={convertToAdvanceTitle(convertedAdv)}
                            >
                              <CreditCard size={14} />
                              {convertToAdvanceButtonLabel(convertingId, v.id, convertedAdv)}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
        )}

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
