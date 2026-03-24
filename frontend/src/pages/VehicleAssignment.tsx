import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, RotateCcw, ClipboardList, CheckCircle, Clock, FolderOpen, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { vehicleService } from '@/services/vehicleService';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';

type Vehicle = {
  id: string;
  plate_number: string;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  status: string;
};

type Employee = { id: string; name: string };

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
  vehicles?: { plate_number: string; type: string } | null;
  employees?: { name: string } | null;
};

const statusLabels: Record<string, { label: string; icon: string }> = {
  active:      { label: 'نشطة',    icon: '✅' },
  maintenance: { label: 'صيانة',   icon: '🔧' },
  inactive:    { label: 'خربان',   icon: '⚠️' },
  breakdown:   { label: 'خربان',   icon: '⚠️' },
  rental:      { label: 'إيجار',   icon: '🚙' },
  ended:       { label: 'منتهية',  icon: '🔴' },
};

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

// ─── Assignment Form Modal ─────────────────────────────────────────────────────
const AssignmentFormModal = ({
  open, onClose, onSaved, freeVehicles, employees,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  freeVehicles: Vehicle[]; employees: Employee[];
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const nowStr = () => {
    const d = new Date();
    return `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;
  };
  const [form, setForm] = useState({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '', reason: '' });

  useEffect(() => { if (open) setForm({ vehicle_id: '', employee_id: '', start_at: nowStr(), notes: '', reason: '' }); }, [open]);

  const handleSave = async () => {
    if (!form.vehicle_id || !form.employee_id)
      return toast({ title: 'يرجى اختيار المركبة والمندوب', variant: 'destructive' });
    setSaving(true);
    const startAt = new Date(form.start_at);
    const { error } = await vehicleService.createAssignment({
      vehicle_id: form.vehicle_id,
      employee_id: form.employee_id,
      start_date: format(startAt, 'yyyy-MM-dd'),
      start_at: startAt.toISOString(),
      notes: form.notes || null,
      reason: form.reason || null,
    });
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: '✅ تم تسجيل التسليم بنجاح' });
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={18} className="text-primary" />
            تسجيل تسليم مركبة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Vehicle selector — ONLY free (active + no current assignment) vehicles */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              المركبة *
              <span className="text-xs text-muted-foreground font-normal mr-2">
                (المركبات الفاضية فقط — {freeVehicles.length} متاحة)
              </span>
            </label>
            {freeVehicles.length === 0 ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
                <AlertCircle size={16} />
                لا توجد مركبات متاحة — كل المركبات النشطة مرتبطة بمناديب أو في صيانة/إيجار
              </div>
            ) : (
              <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المركبة الفاضية" /></SelectTrigger>
                <SelectContent>
                  {freeVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      <span className="flex items-center gap-2">
                        <span>{v.type === 'motorcycle' ? '🏍️' : '🚗'}</span>
                        <span className="font-mono font-bold">{v.plate_number}</span>
                        {(v.brand || v.model) && (
                          <span className="text-muted-foreground text-xs">— {v.brand} {v.model}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Employee */}
          <div>
            <label className="text-sm font-medium mb-1 block">المندوب *</label>
            <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date/time */}
          <div>
            <label className="text-sm font-medium mb-1 block">تاريخ ووقت الاستلام</label>
            <Input type="datetime-local" value={form.start_at} onChange={e => setForm(p => ({ ...p, start_at: e.target.value }))} />
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-medium mb-1 block">سبب التسليم</label>
            <Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="مثال: توصيل شيفت صباحي..." />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium mb-1 block">ملاحظات</label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || freeVehicles.length === 0}>
            {saving ? 'جاري الحفظ...' : 'تسجيل التسليم'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Return Modal ─────────────────────────────────────────────────────────────
const ReturnModal = ({
  open, onClose, onSaved, assignment,
}: {
  open: boolean; onClose: () => void; onSaved: () => void; assignment: Assignment | null;
}) => {
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
    const { error } = await vehicleService.updateAssignment(assignment.id, {
      returned_at: rt.toISOString(),
      end_date: format(rt, 'yyyy-MM-dd'),
    });
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: '✅ تم تسجيل الإعادة بنجاح' });
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw size={18} className="text-success" />
            تسجيل إعادة المركبة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-lg p-3 text-sm">
            <div><span className="text-muted-foreground">المركبة: </span><span className="font-bold">{assignment?.vehicles?.plate_number}</span></div>
            <div><span className="text-muted-foreground">المندوب: </span><span className="font-bold">{assignment?.employees?.name}</span></div>
            <div><span className="text-muted-foreground">مدة الاستخدام: </span><span className="font-bold text-primary">{calcDuration(assignment?.start_at || null, null)}</span></div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">تاريخ ووقت الإعادة</label>
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

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border/30">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const VehicleAssignment = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('vehicle_assignment');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showActive, setShowActive] = useState<'all' | 'active' | 'returned'>('all');
  const isShowActiveKey = (v: string): v is 'all' | 'active' | 'returned' =>
    v === 'all' || v === 'active' || v === 'returned';
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [returnAssignment, setReturnAssignment] = useState<Assignment | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assignRes, vehicleRes, empRes] = await Promise.all([
      vehicleService.getAssignmentsWithRelations(200),
      vehicleService.getAll(),
      vehicleService.getActiveEmployees(),
    ]);
    if (!assignRes.error && assignRes.data) setAssignments(assignRes.data as Assignment[]);
    if (!vehicleRes.error && vehicleRes.data) setVehicles(vehicleRes.data as Vehicle[]);
    if (!empRes.error && empRes.data) setEmployees(empRes.data as Employee[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Vehicles that are TRULY free:
  // 1. Status must be 'active'
  // 2. Must NOT have any active (non-returned) assignment
  const assignedVehicleIds = new Set(
    assignments.filter(a => !a.returned_at).map(a => a.vehicle_id)
  );

  const freeVehicles = vehicles.filter(
    v => v.status === 'active' && !assignedVehicleIds.has(v.id)
  );

  // All vehicles grouped by availability for the stats
  const stats = {
    total: assignments.length,
    active: assignments.filter(a => !a.returned_at).length,
    returned: assignments.filter(a => !!a.returned_at).length,
    free: freeVehicles.length,
  };

  const filtered = assignments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (a.vehicles?.plate_number || '').toLowerCase().includes(q)
      || (a.employees?.name || '').toLowerCase().includes(q);
    const isReturned = !!a.returned_at;
    const matchStatus = showActive === 'all' || (showActive === 'active' && !isReturned) || (showActive === 'returned' && isReturned);
    return matchSearch && matchStatus;
  });

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>سجل تسليم المركبات</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px;white-space:nowrap}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>سجل تسليم المركبات</h2><p class="sub">المجموع: ${filtered.length} سجل — ${new Date().toLocaleDateString('ar-SA')}</p>`);
    if (!printWindow.document.body) return;
    // Append the live DOM table node to avoid string-interpolating table HTML.
    printWindow.document.body.appendChild(table.cloneNode(true));
    printWindow.document.write(`<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script></body></html>`);
    printWindow.document.close();
  };

  const handleTemplate = () => {
    const headers = [['رقم اللوحة', 'نوع المركبة', 'اسم المندوب', 'تاريخ الاستلام', 'تاريخ الإعادة', 'السبب', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_vehicle_assignment.xlsx');
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">سجل تسليم المركبات</span>
          </nav>
          <h1 className="page-title">سجل تسليم المركبات</h1>
        </div>
        <div className="flex gap-2">
          {permissions.can_edit && (
            <Button className="gap-2" onClick={() => setShowAssignModal(true)}>
              <Plus size={16} /> تسجيل تسليم جديد
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                const rows = filtered.map(a => ({
                  'المركبة': a.vehicles?.plate_number || '',
                  'النوع': a.vehicles?.type === 'motorcycle' ? 'موتوسيكل' : 'سيارة',
                  'المندوب': a.employees?.name || '',
                  'تاريخ الاستلام': a.start_at ? format(new Date(a.start_at), 'yyyy-MM-dd HH:mm') : '',
                  'تاريخ الإعادة': a.returned_at ? format(new Date(a.returned_at), 'yyyy-MM-dd HH:mm') : '',
                  'الحالة': a.returned_at ? 'تم الإعادة' : 'قيد الاستخدام',
                  'السبب': a.reason || '',
                  'ملاحظات': a.notes || '',
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'سجل تسليم المركبات');
                XLSX.writeFile(wb, `سجل_تسليم_المركبات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              }}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي السجلات',    value: stats.total,    icon: '📋', cls: 'text-foreground' },
          { label: 'قيد الاستخدام',     value: stats.active,   icon: '🔑', cls: 'text-primary'    },
          { label: 'تم الإعادة',        value: stats.returned, icon: '✅', cls: 'text-success'    },
          { label: 'مركبات فاضية',      value: stats.free,     icon: '🏍️', cls: 'text-success'    },
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

      {/* Free vehicles rule banner */}
      <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm">
        <CheckCircle size={16} className="text-primary flex-shrink-0" />
        <span className="text-muted-foreground">
          يُسمح بالتسليم فقط للمركبات <span className="font-bold text-success">الفاضية</span> — 
          المركبات في صيانة أو إيجار أو خربان أو مع مندوب آخر <span className="font-bold text-destructive">لا تظهر</span>. يجب تسجيل الإعادة أولاً لتصبح متاحة.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث برقم اللوحة أو اسم المندوب..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {[
            { key: 'all',      label: 'الكل' },
            { key: 'active',   label: 'قيد الاستخدام' },
            { key: 'returned', label: 'تم الإعادة' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { if (isShowActiveKey(opt.key)) setShowActive(opt.key); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${showActive === opt.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full min-w-[800px]">
            <thead className="ta-thead">
              <tr>
                <th className="ta-th">المركبة</th>
                <th className="ta-th">المندوب</th>
                <th className="ta-th">تاريخ الاستلام</th>
                <th className="ta-th">تاريخ الإعادة</th>
                <th className="ta-th">مدة الاستخدام</th>
                <th className="ta-th">الحالة</th>
                <th className="ta-th">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ClipboardList size={40} className="opacity-30" />
                      <p className="font-medium">لا توجد سجلات</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(a => {
                const isActive = !a.returned_at;
                return (
                  <tr key={a.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isActive ? 'bg-primary/2' : ''}`}>
                    <td className="px-3 py-2.5">
                      <span className="font-bold font-mono text-foreground whitespace-nowrap">
                        {a.vehicles?.type === 'motorcycle' ? '🏍️' : '🚗'} {a.vehicles?.plate_number || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">{a.employees?.name || '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {a.start_at ? (
                        <div>
                          <div>{format(new Date(a.start_at), 'yyyy/MM/dd')}</div>
                          <div className="text-muted-foreground/60">{format(new Date(a.start_at), 'HH:mm')}</div>
                        </div>
                      ) : (a.start_date || '—')}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {a.returned_at ? (
                        <div>
                          <div>{format(new Date(a.returned_at), 'yyyy/MM/dd')}</div>
                          <div className="text-muted-foreground/60">{format(new Date(a.returned_at), 'HH:mm')}</div>
                        </div>
                      ) : <span className="text-primary font-medium flex items-center gap-1"><Clock size={11} /> جارٍ</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {calcDuration(a.start_at, a.returned_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive
                        ? <span className="badge-warning">قيد الاستخدام</span>
                        : <span className="badge-success">تم الإعادة</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      {isActive && permissions.can_edit && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={() => setReturnAssignment(a)}
                        >
                          <RotateCcw size={12} /> تسجيل إعادة
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AssignmentFormModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        onSaved={fetchData}
        freeVehicles={freeVehicles}
        employees={employees}
      />
      <ReturnModal
        open={!!returnAssignment}
        onClose={() => setReturnAssignment(null)}
        onSaved={fetchData}
        assignment={returnAssignment}
      />
    </div>
  );
};

export default VehicleAssignment;
