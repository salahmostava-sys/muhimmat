import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, FolderOpen, Upload, Edit, Trash2, Bike, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { vehicleService } from '@/services/vehicleService';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format, differenceInDays, parseISO } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────
type VehicleStatus = 'active' | 'maintenance' | 'breakdown' | 'rental' | 'ended' | 'inactive';

type Vehicle = {
  id: string;
  plate_number: string;
  plate_number_en?: string | null;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  year: number | null;
  status: VehicleStatus;
  has_fuel_chip: boolean;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  authorization_expiry: string | null;
  chassis_number?: string | null;
  serial_number?: string | null;
  notes: string | null;
  current_rider?: string | null; // name from active vehicle_assignment
};

const statusLabels: Record<string, string> = {
  active: 'نشطة',
  maintenance: 'صيانة',
  breakdown: 'خربان',
  rental: 'إيجار',
  ended: 'منتهي',
  inactive: 'غير نشطة',
};

// Smart status badge — considers current_rider for active vehicles
const SmartStatusBadge = ({ status, rider }: { status: VehicleStatus; rider?: string | null }) => {
  if (status === 'active') {
    return rider
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">🔑 متاح مع مندوب</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">✅ متاح بدون مندوب</span>;
  }
  if (status === 'maintenance') return <span className="badge-warning">🔧 صيانة</span>;
  if (status === 'breakdown') return <span className="badge-urgent">⚠️ خربان</span>;
  if (status === 'rental') return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">🚙 إيجار</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">{statusLabels[status] || status}</span>;
};

const typeLabels: Record<string, string> = { motorcycle: 'موتوسيكل', car: 'سيارة' };

const ALL_STATUSES: VehicleStatus[] = ['active', 'maintenance', 'breakdown', 'rental', 'inactive', 'ended'];

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
const VehicleFormModal = ({
  open, onClose, onSaved, editVehicle,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; editVehicle?: Vehicle | null;
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plate_number: '', plate_number_en: '', type: 'motorcycle' as 'motorcycle' | 'car',
    brand: '', model: '', year: '', status: 'active' as VehicleStatus,
    has_fuel_chip: false,
    insurance_expiry: '', registration_expiry: '', authorization_expiry: '',
    chassis_number: '', serial_number: '', notes: '',
  });

  useEffect(() => {
    if (editVehicle) {
      setForm({
        plate_number: editVehicle.plate_number,
        plate_number_en: editVehicle.plate_number_en || '',
        type: editVehicle.type,
        brand: editVehicle.brand || '', model: editVehicle.model || '',
        year: editVehicle.year?.toString() || '', status: editVehicle.status,
        has_fuel_chip: editVehicle.has_fuel_chip ?? false,
        insurance_expiry: editVehicle.insurance_expiry || '',
        registration_expiry: editVehicle.registration_expiry || '',
        authorization_expiry: editVehicle.authorization_expiry || '',
        chassis_number: editVehicle.chassis_number || '',
        serial_number: editVehicle.serial_number || '',
        notes: editVehicle.notes || '',
      });
    } else {
      setForm({ plate_number: '', plate_number_en: '', type: 'motorcycle', brand: '', model: '', year: '', status: 'active', has_fuel_chip: false, insurance_expiry: '', registration_expiry: '', authorization_expiry: '', chassis_number: '', serial_number: '', notes: '' });
    }
  }, [editVehicle, open]);

  const handleSave = async () => {
    if (!form.plate_number.trim()) return toast({ title: 'يرجى إدخال رقم اللوحة', variant: 'destructive' });
    setSaving(true);
    const payload = {
      plate_number: form.plate_number.trim(),
      plate_number_en: form.plate_number_en.trim() || null,
      type: form.type,
      brand: form.brand || null, model: form.model || null,
      year: form.year ? parseInt(form.year) : null, status: form.status,
      has_fuel_chip: form.has_fuel_chip,
      insurance_expiry: form.insurance_expiry || null,
      registration_expiry: form.registration_expiry || null,
      authorization_expiry: form.authorization_expiry || null,
      chassis_number: form.chassis_number.trim() || null,
      serial_number: form.serial_number.trim() || null,
      notes: form.notes || null,
    };
    const { error } = editVehicle
      ? await vehicleService.update(editVehicle.id, payload)
      : await vehicleService.create(payload);
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: editVehicle ? 'تم تحديث المركبة' : 'تم إضافة المركبة بنجاح' });
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editVehicle ? 'تعديل بيانات المركبة' : 'إضافة مركبة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="text-sm font-medium mb-1 block">رقم اللوحة (عربي) *</label>
            <Input value={form.plate_number} onChange={e => setForm(p => ({ ...p, plate_number: e.target.value }))} placeholder="مثال: أ ب ج 1234" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">رقم اللوحة (إنجليزي)</label>
            <Input value={form.plate_number_en} onChange={e => setForm(p => ({ ...p, plate_number_en: e.target.value }))} placeholder="AD 2469" dir="ltr" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">النوع</label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as 'motorcycle' | 'car' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">موتوسيكل</SelectItem>
                <SelectItem value="car">سيارة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as VehicleStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الماركة</label>
            <Input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="Honda, Yamaha..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الموديل</label>
            <Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="CG125, R15..." />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">سنة الصنع</label>
            <Input type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="2022" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الرقم التسلسلي</label>
            <Input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} placeholder="333974020" dir="ltr" />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">رقم الهيكل</label>
            <Input value={form.chassis_number} onChange={e => setForm(p => ({ ...p, chassis_number: e.target.value }))} placeholder="ME4KC20F1NA014818" dir="ltr" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">انتهاء التأمين</label>
            <Input type="date" value={form.insurance_expiry} onChange={e => setForm(p => ({ ...p, insurance_expiry: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">انتهاء التسجيل</label>
            <Input type="date" value={form.registration_expiry} onChange={e => setForm(p => ({ ...p, registration_expiry: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">انتهاء التفويض</label>
            <Input type="date" value={form.authorization_expiry} onChange={e => setForm(p => ({ ...p, authorization_expiry: e.target.value }))} />
          </div>
          <div className="col-span-2 flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5">
            <span className="text-lg">⛽</span>
            <label className="text-sm font-medium flex-1">شريحة البنزين</label>
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, has_fuel_chip: !p.has_fuel_chip }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.has_fuel_chip ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.has_fuel_chip ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <span className={`text-xs font-semibold ${form.has_fuel_chip ? 'text-primary' : 'text-muted-foreground'}`}>
              {form.has_fuel_chip ? 'يوجد' : 'لا يوجد'}
            </span>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">ملاحظات</label>
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

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border/30">
    {Array.from({ length: 17 }).map((_, i) => (
      <td key={i} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

/** Matches public.vehicles columns (types.ts) for import/export */
const VEHICLE_TEMPLATE_HEADERS = [
  'plate_number',
  'plate_number_en',
  'type',
  'brand',
  'model',
  'year',
  'status',
  'has_fuel_chip',
  'insurance_expiry',
  'registration_expiry',
  'authorization_expiry',
  'chassis_number',
  'serial_number',
  'notes',
] as const;

const parseBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'نعم' || s === 'y';
};

const parseVehicleType = (v: unknown): 'motorcycle' | 'car' => {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'car' || s === 'سيارة') return 'car';
  return 'motorcycle';
};

const parseVehicleStatus = (v: unknown): VehicleStatus => {
  const raw = String(v ?? '').trim();
  const s = raw.toLowerCase();
  const map: Record<string, VehicleStatus> = {
    active: 'active', نشطة: 'active', نشط: 'active',
    maintenance: 'maintenance', صيانة: 'maintenance',
    breakdown: 'breakdown', خربان: 'breakdown',
    rental: 'rental', إيجار: 'rental',
    ended: 'ended', منتهي: 'ended',
    inactive: 'inactive', 'غير نشطة': 'inactive',
  };
  if (map[s]) return map[s];
  if (ALL_STATUSES.includes(raw as VehicleStatus)) return raw as VehicleStatus;
  return 'active';
};

const cell = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Motorcycles = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('vehicles');
  const [data, setData] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);

  const importRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (!rows.length) return toast({ title: 'الملف فارغ', variant: 'destructive' });
      let success = 0;
      for (const row of rows) {
        const plate = cell(row, 'plate_number', 'رقم اللوحة');
        if (!plate) continue;
        const y = cell(row, 'year', 'سنة الصنع');
        const yearNum = y !== undefined ? parseInt(String(y), 10) : NaN;
        const plateEn = cell(row, 'plate_number_en', 'رقم اللوحة en');
        await vehicleService.upsert({
          plate_number: String(plate).trim(),
          plate_number_en: plateEn !== undefined ? String(plateEn).trim() || null : null,
          type: parseVehicleType(cell(row, 'type', 'النوع')),
          brand: cell(row, 'brand', 'الماركة') != null ? String(cell(row, 'brand', 'الماركة')) : null,
          model: cell(row, 'model', 'الموديل') != null ? String(cell(row, 'model', 'الموديل')) : null,
          year: Number.isFinite(yearNum) ? yearNum : null,
          status: parseVehicleStatus(cell(row, 'status', 'الحالة')),
          has_fuel_chip: parseBool(cell(row, 'has_fuel_chip', 'شريحة البنزين', 'fuel_chip')),
          insurance_expiry: cell(row, 'insurance_expiry', 'انتهاء التأمين') != null ? String(cell(row, 'insurance_expiry', 'انتهاء التأمين')) : null,
          registration_expiry: cell(row, 'registration_expiry', 'انتهاء التسجيل') != null ? String(cell(row, 'registration_expiry', 'انتهاء التسجيل')) : null,
          authorization_expiry: cell(row, 'authorization_expiry', 'انتهاء التفويض') != null ? String(cell(row, 'authorization_expiry', 'انتهاء التفويض')) : null,
          chassis_number: cell(row, 'chassis_number', 'رقم الهيكل') != null ? String(cell(row, 'chassis_number', 'رقم الهيكل')).trim() || null : null,
          serial_number: cell(row, 'serial_number', 'الرقم التسلسلي') != null ? String(cell(row, 'serial_number', 'الرقم التسلسلي')).trim() || null : null,
          notes: cell(row, 'notes', 'ملاحظات') != null ? String(cell(row, 'notes', 'ملاحظات')) : null,
        });
        success++;
      }
      toast({ title: `تم استيراد ${success} مركبة ✅` });
      fetchVehicles();
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleTemplate = () => {
    const headers = [VEHICLE_TEMPLATE_HEADERS.slice()];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'vehicles');
    XLSX.writeFile(wb, 'template_vehicles.xlsx');
  };

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await vehicleService.getAllWithCurrentRider();
    if (error) { toast({ title: 'خطأ في التحميل', description: error.message, variant: 'destructive' }); setLoading(false); return; }
    if (rows) setData(rows as Vehicle[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const filtered = data.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.plate_number.toLowerCase().includes(q) || (v.brand || '').toLowerCase().includes(q) || (v.model || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchType = typeFilter === 'all' || v.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Summary stats
  const stats = {
    total: data.length,
    active: data.filter(v => v.status === 'active').length,
    maintenance: data.filter(v => v.status === 'maintenance').length,
    breakdown: data.filter(v => v.status === 'breakdown').length,
  };

  const handleExport = () => {
    const rows = filtered.map((v, idx) => ({
      '#': idx + 1,
      'رقم اللوحة': v.plate_number,
      'رقم اللوحة en': v.plate_number_en || '',
      'النوع': typeLabels[v.type],
      'الماركة': v.brand || '',
      'الموديل': v.model || '',
      'سنة الصنع': v.year ?? '',
      'الرقم التسلسلي': v.serial_number || '',
      'رقم الهيكل': v.chassis_number || '',
      'ملاحظات': v.notes || '',
      'المندوب الحالي': v.current_rider || '',
      'الحالة': statusLabels[v.status] ?? v.status,
      'شريحة البنزين': v.has_fuel_chip ? 'نعم' : 'لا',
      'انتهاء التأمين': v.insurance_expiry || '',
      'انتهاء التسجيل': v.registration_expiry || '',
      'انتهاء التفويض': v.authorization_expiry || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المركبات');
    XLSX.writeFile(wb, `motorcycles_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>بيانات الموتوسيكلات</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px;white-space:nowrap}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>بيانات الموتوسيكلات</h2><p class="sub">المجموع: ${filtered.length} مركبة — ${new Date().toLocaleDateString('ar-SA')}</p>`);
    if (!printWindow.document.body) return;
    // Append the live DOM table node to avoid string-interpolating table HTML.
    printWindow.document.body.appendChild(table.cloneNode(true));
    printWindow.document.write(`<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  const handleDelete = async (v: Vehicle) => {
    if (!confirm(`هل تريد حذف المركبة ${v.plate_number}؟`)) return;
    const { error } = await vehicleService.delete(v.id);
    if (error) return toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    toast({ title: 'تم حذف المركبة' });
    fetchVehicles();
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">بيانات الموتوسيكلات</span>
          </nav>
          <h1 className="page-title">بيانات الموتوسيكلات</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              {permissions.can_edit && (
                <DropdownMenuItem onClick={() => importRef.current?.click()}>
                  <Upload size={14} className="ml-2" /> استيراد Excel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {permissions.can_edit && (
            <Button className="gap-2" onClick={() => { setEditVehicle(null); setShowForm(true); }}>
              <Plus size={16} /> إضافة مركبة
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المركبات', value: stats.total, icon: '🏍️', cls: 'text-foreground' },
          { label: 'نشطة', value: stats.active, icon: '✅', cls: 'text-success' },
          { label: 'في الصيانة', value: stats.maintenance, icon: '🔧', cls: 'text-yellow-600' },
          { label: 'أعطال', value: stats.breakdown, icon: '⚠️', cls: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-2xl font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث برقم اللوحة، الماركة..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-28 h-9"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="motorcycle">موتوسيكل</SelectItem>
            <SelectItem value="car">سيارة</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} مركبة</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
           <table ref={tableRef} className="w-full min-w-[1400px]">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th">#</th>
                <th className="ta-th">رقم اللوحة ar</th>
                <th className="ta-th">رقم اللوحة en</th>
                <th className="ta-th">النوع</th>
                <th className="ta-th">الماركة</th>
                <th className="ta-th">الموديل</th>
                <th className="ta-th">سنة الصنع</th>
                <th className="ta-th">الرقم التسلسلي</th>
                <th className="ta-th">رقم الهيكل</th>
                <th className="ta-th">ملاحظات</th>
                <th className="ta-th">المندوب الحالي</th>
                <th className="ta-th">الحالة</th>
                <th className="ta-th">⛽ شريحة البنزين</th>
                <th className="ta-th">انتهاء التأمين</th>
                <th className="ta-th">انتهاء التسجيل</th>
                <th className="ta-th">انتهاء التفويض</th>
                <th className="ta-th">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={17} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Bike size={40} className="opacity-30" />
                      <p className="font-medium">لا توجد مركبات</p>
                      <p className="text-xs">أضف مركبة جديدة للبدء</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((v, idx) => {
                const authDays = getDaysLeft(v.authorization_expiry);
                const insDays = getDaysLeft(v.insurance_expiry);
                const regDays = getDaysLeft(v.registration_expiry);
                return (
                  <tr key={v.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold text-foreground font-mono whitespace-nowrap">{v.plate_number}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-muted-foreground font-mono whitespace-nowrap" dir="ltr">{v.plate_number_en || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">{v.type === 'motorcycle' ? '🏍️' : '🚗'} {typeLabels[v.type]}</span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">{v.brand || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">{v.model || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{v.year ?? '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap" dir="ltr">{v.serial_number || '—'}</td>
                     <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap" dir="ltr">{v.chassis_number || '—'}</td>
                     <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate" title={v.notes || ''}>{v.notes || '—'}</td>
                     {/* Current assigned rider */}
                     <td className="px-3 py-2.5 whitespace-nowrap">
                        {v.current_rider ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-foreground">{v.current_rider}</span>
                         </div>
                       ) : (
                         <span className="text-muted-foreground/40 text-xs">—</span>
                       )}
                     </td>
                     <td className="px-3 py-2.5">
                       <SmartStatusBadge status={v.status} rider={v.current_rider} />
                     </td>
                     {/* Fuel chip */}
                     <td className="px-3 py-2.5 text-center">
                       {v.has_fuel_chip
                         ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success">⛽ يوجد</span>
                         : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">لا يوجد</span>
                       }
                     </td>
                    <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${daysStyle(insDays)}`}>
                      {v.insurance_expiry ? (
                        <div>
                          <div>{format(parseISO(v.insurance_expiry), 'yyyy/MM/dd')}</div>
                          <div className="text-[10px]">{daysLabel(insDays)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${daysStyle(regDays)}`}>
                      {v.registration_expiry ? (
                        <div>
                          <div>{format(parseISO(v.registration_expiry), 'yyyy/MM/dd')}</div>
                          <div className="text-[10px]">{daysLabel(regDays)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-xs whitespace-nowrap ${daysStyle(authDays)}`}>
                      {v.authorization_expiry ? (
                        <div>
                          <div>{format(parseISO(v.authorization_expiry), 'yyyy/MM/dd')}</div>
                          <div className="text-[10px]">{daysLabel(authDays)}</div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        {permissions.can_edit && (
                          <button
                            onClick={() => { setEditVehicle(v); setShowForm(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="تعديل"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {permissions.can_delete && (
                          <button
                            onClick={() => handleDelete(v)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            title="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <VehicleFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditVehicle(null); }}
        onSaved={fetchVehicles}
        editVehicle={editVehicle}
      />
    </div>
  );
};

export default Motorcycles;
