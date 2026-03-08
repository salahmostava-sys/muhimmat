import { useState, useEffect } from 'react';
import { Search, Plus, Bike, Wrench, Download, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format, differenceInDays, parseISO } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type VehicleStatus = 'active' | 'maintenance' | 'breakdown' | 'rental' | 'ended';

type Vehicle = {
  id: string;
  plate_number: string;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  year: number | null;
  status: VehicleStatus;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  authorization_expiry: string | null;
  notes: string | null;
};

type Assignment = {
  id: string;
  vehicle_id: string;
  employee_id: string;
  start_date: string;
  start_at: string | null;
  end_date: string | null;
  returned_at: string | null;
  notes: string | null;
  reason: string | null;
  vehicles?: { plate_number: string } | null;
  employees?: { name: string } | null;
};

type Employee = { id: string; name: string };

// ─── Labels & Styles ─────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = {
  active: 'نشطة',
  maintenance: 'صيانة',
  breakdown: 'أعطال',
  rental: 'إيجار',
  ended: 'منتهي',
};
const statusStyles: Record<string, string> = {
  active: 'badge-success',
  maintenance: 'badge-warning',
  breakdown: 'badge-urgent',
  rental: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ended: 'px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground',
};
const typeLabels: Record<string, string> = { motorcycle: 'موتوسيكل', car: 'سيارة' };
const ALL_STATUSES: VehicleStatus[] = ['active', 'maintenance', 'breakdown', 'rental', 'ended'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getDaysLeft = (date: string | null) => {
  if (!date) return null;
  return differenceInDays(parseISO(date), new Date());
};

const daysStyle = (days: number | null) => {
  if (days === null) return 'text-muted-foreground';
  if (days < 0) return 'text-destructive font-semibold';
  if (days <= 30) return 'text-destructive font-semibold';
  if (days <= 60) return 'text-yellow-600 dark:text-yellow-400 font-medium';
  return 'text-muted-foreground';
};

const daysLabel = (days: number | null) => {
  if (days === null) return '—';
  if (days < 0) return `منتهي منذ ${Math.abs(days)} يوم`;
  return `${days} يوم`;
};

const authBadge = (date: string | null) => {
  if (!date) return null;
  const days = getDaysLeft(date);
  if (days === null) return null;
  if (days < 0) return <span className="badge-urgent">منتهي</span>;
  if (days <= 30) return <span className="badge-warning">ينتهي قريباً</span>;
  return <span className="badge-success">ساري</span>;
};

// ─── Vehicle Form Modal ───────────────────────────────────────────────────────
interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editVehicle?: Vehicle | null;
}

const VehicleFormModal = ({ open, onClose, onSaved, editVehicle }: VehicleFormProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plate_number: '',
    type: 'motorcycle' as 'motorcycle' | 'car',
    brand: '',
    model: '',
    year: '',
    status: 'active' as VehicleStatus,
    insurance_expiry: '',
    registration_expiry: '',
    authorization_expiry: '',
    notes: '',
  });

  useEffect(() => {
    if (editVehicle) {
      setForm({
        plate_number: editVehicle.plate_number,
        type: editVehicle.type,
        brand: editVehicle.brand || '',
        model: editVehicle.model || '',
        year: editVehicle.year?.toString() || '',
        status: editVehicle.status,
        insurance_expiry: editVehicle.insurance_expiry || '',
        registration_expiry: editVehicle.registration_expiry || '',
        authorization_expiry: editVehicle.authorization_expiry || '',
        notes: editVehicle.notes || '',
      });
    } else {
      setForm({ plate_number: '', type: 'motorcycle', brand: '', model: '', year: '', status: 'active', insurance_expiry: '', registration_expiry: '', authorization_expiry: '', notes: '' });
    }
  }, [editVehicle, open]);

  const handleSave = async () => {
    if (!form.plate_number.trim()) return toast({ title: 'يرجى إدخال رقم اللوحة', variant: 'destructive' });
    setSaving(true);
    const payload = {
      plate_number: form.plate_number.trim(),
      type: form.type,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year ? parseInt(form.year) : null,
      status: form.status,
      insurance_expiry: form.insurance_expiry || null,
      registration_expiry: form.registration_expiry || null,
      authorization_expiry: form.authorization_expiry || null,
      notes: form.notes || null,
    };

    let error;
    if (editVehicle) {
      ({ error } = await supabase.from('vehicles').update(payload).eq('id', editVehicle.id));
    } else {
      ({ error } = await supabase.from('vehicles').insert(payload));
    }
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: editVehicle ? 'تم تحديث المركبة' : 'تم إضافة المركبة بنجاح' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editVehicle ? 'تعديل بيانات المركبة' : 'إضافة مركبة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium text-foreground mb-1 block">رقم اللوحة *</label>
            <Input value={form.plate_number} onChange={e => setForm(p => ({ ...p, plate_number: e.target.value }))} placeholder="مثال: أ ب ج 1234" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">النوع</label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as 'motorcycle' | 'car' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">موتوسيكل</SelectItem>
                <SelectItem value="car">سيارة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as VehicleStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">الماركة</label>
            <Input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="Honda, Toyota..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">الموديل</label>
            <Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="CG125, Hilux..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">سنة الصنع</label>
            <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="2022" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">انتهاء التأمين</label>
            <Input type="date" value={form.insurance_expiry} onChange={e => setForm(p => ({ ...p, insurance_expiry: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">انتهاء التسجيل</label>
            <Input type="date" value={form.registration_expiry} onChange={e => setForm(p => ({ ...p, registration_expiry: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">تاريخ انتهاء التفويض</label>
            <Input type="date" value={form.authorization_expiry} onChange={e => setForm(p => ({ ...p, authorization_expiry: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium text-foreground mb-1 block">ملاحظات</label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : editVehicle ? 'حفظ التعديلات' : 'إضافة المركبة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Assignment Form Modal ────────────────────────────────────────────────────
interface AssignmentFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  vehicles: Vehicle[];
  employees: Employee[];
}

const AssignmentFormModal = ({ open, onClose, onSaved, vehicles, employees }: AssignmentFormProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const nowStr = () => {
    const d = new Date();
    return `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;
  };
  const [form, setForm] = useState({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '' });

  useEffect(() => { if (open) setForm({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '' }); }, [open]);

  const handleSave = async () => {
    if (!form.vehicle_id || !form.employee_id) return toast({ title: 'يرجى اختيار المركبة والمندوب', variant: 'destructive' });
    setSaving(true);
    const startAt = new Date(form.start_at);
    const { error } = await supabase.from('vehicle_assignments').insert({
      vehicle_id: form.vehicle_id,
      employee_id: form.employee_id,
      start_date: format(startAt, 'yyyy-MM-dd'),
      start_at: startAt.toISOString(),
      notes: form.notes || null,
    });
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: 'تم تسجيل التسليم بنجاح' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader><DialogTitle>تسجيل تسليم مركبة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">المركبة *</label>
            <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المركبة" /></SelectTrigger>
              <SelectContent>
                {vehicles.filter(v => v.status === 'active').map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.plate_number} — {typeLabels[v.type]} {v.brand || ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">المندوب *</label>
            <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">تاريخ ووقت الاستلام</label>
            <Input type="datetime-local" value={form.start_at} onChange={e => setForm(p => ({ ...p, start_at: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">ملاحظة</label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'تسجيل التسليم'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Return Modal ─────────────────────────────────────────────────────────────
interface ReturnModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  assignment: Assignment | null;
}

const ReturnModal = ({ open, onClose, onSaved, assignment }: ReturnModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const nowStr = () => {
    const d = new Date();
    return `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;
  };
  const [returnedAt, setReturnedAt] = useState(nowStr());

  useEffect(() => { if (open) setReturnedAt(nowStr()); }, [open]);

  const handleSave = async () => {
    if (!assignment) return;
    setSaving(true);
    const rt = new Date(returnedAt);
    const { error } = await supabase.from('vehicle_assignments').update({
      returned_at: rt.toISOString(),
      end_date: format(rt, 'yyyy-MM-dd'),
    }).eq('id', assignment.id);
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: 'تم تسجيل الإعادة بنجاح' });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader><DialogTitle>تسجيل إعادة المركبة</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            المركبة: <span className="font-semibold text-foreground">{assignment?.vehicles?.plate_number}</span>
            {' — '}المندوب: <span className="font-semibold text-foreground">{assignment?.employees?.name}</span>
          </p>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">تاريخ ووقت الإعادة</label>
            <Input type="datetime-local" value={returnedAt} onChange={e => setReturnedAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'جاري الحفظ...' : 'تسجيل الإعادة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Duration helper ──────────────────────────────────────────────────────────
const calcDuration = (start: string | null, end: string | null) => {
  if (!start) return '—';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diffMs = e.getTime() - s.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days} يوم ${hours} ساعة`;
  return `${hours} ساعة`;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Vehicles = () => {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignStatusFilter, setAssignStatusFilter] = useState('all');
  const [assignDateFrom, setAssignDateFrom] = useState('');
  const [assignDateTo, setAssignDateTo] = useState('');
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [assignFormOpen, setAssignFormOpen] = useState(false);
  const [returnModal, setReturnModal] = useState<{ open: boolean; assignment: Assignment | null }>({ open: false, assignment: null });

  const fetchAll = async () => {
    setLoading(true);
    const [vRes, aRes, eRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate_number'),
      supabase.from('vehicle_assignments').select('*, vehicles(plate_number), employees(name)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
    ]);
    if (vRes.data) setVehicles(vRes.data as Vehicle[]);
    if (aRes.data) setAssignments(aRes.data as Assignment[]);
    if (eRes.data) setEmployees(eRes.data as Employee[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Vehicles filter
  const filteredVehicles = vehicles.filter(v => {
    const matchSearch = v.plate_number.toLowerCase().includes(search.toLowerCase()) ||
      (v.brand || '').toLowerCase().includes(search.toLowerCase()) ||
      (v.model || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchType = typeFilter === 'all' || v.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Assignments filter
  const filteredAssignments = assignments.filter(a => {
    const plate = a.vehicles?.plate_number || '';
    const empName = a.employees?.name || '';
    const isActive = !a.returned_at;
    const matchSearch = plate.toLowerCase().includes(assignSearch.toLowerCase()) ||
      empName.includes(assignSearch);
    const matchStatus = assignStatusFilter === 'all' ||
      (assignStatusFilter === 'active' && isActive) ||
      (assignStatusFilter === 'returned' && !isActive);
    const matchFrom = !assignDateFrom || a.start_date >= assignDateFrom;
    const matchTo = !assignDateTo || a.start_date <= assignDateTo;
    return matchSearch && matchStatus && matchFrom && matchTo;
  });

  // Excel exports
  const handleExportVehicles = () => {
    const rows = filteredVehicles.map(v => ({
      'رقم اللوحة': v.plate_number,
      'النوع': typeLabels[v.type] || v.type,
      'الماركة': v.brand || '',
      'الموديل': v.model || '',
      'الحالة': statusLabels[v.status] || v.status,
      'انتهاء التأمين': v.insurance_expiry || '',
      'أيام التأمين المتبقية': v.insurance_expiry ? getDaysLeft(v.insurance_expiry) ?? '' : '',
      'انتهاء التسجيل': v.registration_expiry || '',
      'أيام التسجيل المتبقية': v.registration_expiry ? getDaysLeft(v.registration_expiry) ?? '' : '',
      'انتهاء التفويض': v.authorization_expiry || '',
      'أيام التفويض المتبقية': v.authorization_expiry ? getDaysLeft(v.authorization_expiry) ?? '' : '',
      'ملاحظات': v.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المركبات');
    XLSX.writeFile(wb, `المركبات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportAssignments = () => {
    const rows = filteredAssignments.map(a => ({
      'رقم اللوحة': a.vehicles?.plate_number || '',
      'المندوب': a.employees?.name || '',
      'تاريخ الاستلام': a.start_at ? format(new Date(a.start_at), 'yyyy-MM-dd HH:mm') : a.start_date,
      'تاريخ الإعادة': a.returned_at ? format(new Date(a.returned_at), 'yyyy-MM-dd HH:mm') : '',
      'المدة': calcDuration(a.start_at, a.returned_at),
      'الحالة': a.returned_at ? 'مُسلَّمة' : 'خارجة الآن',
      'ملاحظة': a.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل التسليم');
    XLSX.writeFile(wb, `سجل_تسليم_المركبات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page header breadcrumb */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>المركبات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><Bike size={20} /> المركبات</h1>
            <p className="page-subtitle">{vehicles.length} مركبة مسجلة</p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2"><Download size={15} /> تحميل تقرير ▾</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportVehicles}>📊 تصدير Excel (مع حالة الانتهاء)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportAssignments}>📋 سجل التسليم Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="gap-2" onClick={() => { setEditVehicle(null); setVehicleFormOpen(true); }}>
              <Plus size={16} /> إضافة مركبة
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList className="mb-4">
          <TabsTrigger value="vehicles">🚗 قائمة المركبات</TabsTrigger>
          <TabsTrigger value="tracking">📋 سجل التسليم والاستلام</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Vehicles List ── */}
        <TabsContent value="vehicles">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث برقم اللوحة أو الماركة..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1 flex-wrap">
              {[{ v: 'all', l: 'الكل' }, { v: 'motorcycle', l: 'موتوسيكل' }, { v: 'car', l: 'سيارة' }].map(t => (
                <button key={t.v} onClick={() => setTypeFilter(t.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                  {t.l}
                </button>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {[{ v: 'all', l: 'الكل' }, ...ALL_STATUSES.map(s => ({ v: s, l: statusLabels[s] }))].map(s => (
                <button key={s.v} onClick={() => setStatusFilter(s.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          <div className="ta-table-wrap shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="ta-thead">
                  <tr>
                    <th className="ta-th">رقم اللوحة</th>
                    <th className="ta-th">النوع</th>
                    <th className="ta-th">الماركة / الموديل</th>
                    <th className="ta-th-center">التأمين</th>
                    <th className="ta-th-center">التسجيل</th>
                    <th className="ta-th-center">التفويض</th>
                    <th className="ta-th-center">حالة التفويض</th>
                    <th className="ta-th-center">الحالة</th>
                    <th className="ta-th-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="ta-tr">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="ta-td"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-muted-foreground">لا توجد مركبات مطابقة</td>
                    </tr>
                  ) : (
                    filteredVehicles.map(v => {
                      const insDays = getDaysLeft(v.insurance_expiry);
                      const regDays = getDaysLeft(v.registration_expiry);
                      return (
                        <tr key={v.id} className="ta-tr">
                          <td className="ta-td font-mono font-semibold">{v.plate_number}</td>
                          <td className="ta-td text-muted-foreground">{typeLabels[v.type]}</td>
                          <td className="ta-td text-muted-foreground">{[v.brand, v.model, v.year].filter(Boolean).join(' ')}</td>
                          <td className={`ta-td-center ${daysStyle(insDays)}`}>{daysLabel(insDays)}</td>
                          <td className={`ta-td-center ${daysStyle(regDays)}`}>{daysLabel(regDays)}</td>
                          <td className="ta-td-center text-muted-foreground">
                            {v.authorization_expiry ? format(parseISO(v.authorization_expiry), 'yyyy-MM-dd') : '—'}
                          </td>
                          <td className="ta-td-center">{authBadge(v.authorization_expiry) ?? <span className="text-muted-foreground text-xs">—</span>}</td>
                          <td className="ta-td-center"><span className={statusStyles[v.status]}>{statusLabels[v.status]}</span></td>
                          <td className="ta-td-center">
                            <div className="flex gap-1 justify-center">
                              <Button size="sm" variant="ghost" className="text-xs gap-1"
                                onClick={() => { setEditVehicle(v); setVehicleFormOpen(true); }}>
                                ✏️ تعديل
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs gap-1">
                                <Wrench size={14} /> صيانة
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Tracking Log ── */}
        <TabsContent value="tracking">
          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <span>💡</span>
            <span>يمكنك معرفة من كان يقود المركبة وقت أي مخالفة من خلال هذا السجل</span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث برقم اللوحة أو اسم المندوب..." className="pr-9" value={assignSearch} onChange={e => setAssignSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'خارجة الآن' }, { v: 'returned', l: 'مُسلَّمة' }].map(s => (
                <button key={s.v} onClick={() => setAssignStatusFilter(s.v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${assignStatusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                  {s.l}
                </button>
              ))}
            </div>
            <Input type="date" className="w-36" value={assignDateFrom} onChange={e => setAssignDateFrom(e.target.value)} placeholder="من تاريخ" />
            <Input type="date" className="w-36" value={assignDateTo} onChange={e => setAssignDateTo(e.target.value)} placeholder="إلى تاريخ" />
            <Button className="gap-2 mr-auto" onClick={() => setAssignFormOpen(true)}>
              <Plus size={16} /> تسجيل تسليم
            </Button>
          </div>

          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground">رقم اللوحة</th>
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">تاريخ ووقت الاستلام</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">تاريخ ووقت الإعادة</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">المدة</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground">ملاحظة</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/30">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="p-4"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredAssignments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-muted-foreground">لا توجد سجلات تسليم</td>
                    </tr>
                  ) : (
                    filteredAssignments.map(a => {
                      const isActive = !a.returned_at;
                      const startDisplay = a.start_at
                        ? format(new Date(a.start_at), 'yyyy-MM-dd HH:mm')
                        : a.start_date;
                      const returnDisplay = a.returned_at
                        ? format(new Date(a.returned_at), 'yyyy-MM-dd HH:mm')
                        : '—';
                      return (
                        <tr key={a.id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="p-4 text-sm font-mono font-semibold text-foreground">{a.vehicles?.plate_number || '—'}</td>
                          <td className="p-4 text-sm text-foreground">{a.employees?.name || '—'}</td>
                          <td className="p-4 text-center text-sm text-muted-foreground">{startDisplay}</td>
                          <td className="p-4 text-center text-sm text-muted-foreground">{returnDisplay}</td>
                          <td className="p-4 text-center text-sm text-muted-foreground">{calcDuration(a.start_at, a.returned_at)}</td>
                          <td className="p-4 text-center">
                            {isActive
                              ? <span className="badge-warning">خارجة الآن</span>
                              : <span className="badge-success">مُسلَّمة</span>}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{a.notes || '—'}</td>
                          <td className="p-4 text-center">
                            {isActive && (
                              <Button size="sm" variant="outline" className="text-xs"
                                onClick={() => setReturnModal({ open: true, assignment: a })}>
                                تسجيل إعادة
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <VehicleFormModal
        open={vehicleFormOpen}
        onClose={() => setVehicleFormOpen(false)}
        onSaved={fetchAll}
        editVehicle={editVehicle}
      />
      <AssignmentFormModal
        open={assignFormOpen}
        onClose={() => setAssignFormOpen(false)}
        onSaved={fetchAll}
        vehicles={vehicles}
        employees={employees}
      />
      <ReturnModal
        open={returnModal.open}
        onClose={() => setReturnModal({ open: false, assignment: null })}
        onSaved={fetchAll}
        assignment={returnModal.assignment}
      />
    </div>
  );
};

export default Vehicles;
