import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Edit, Trash2, Wrench, FolderOpen, Loader2, Upload } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { vehicleService } from '@/services/vehicleService';

// ─── Types ────────────────────────────────────────────────────────────────────
type MaintenanceType = 'routine' | 'breakdown' | 'accident';
type PaidBy = 'company' | 'driver' | 'insurance';

type MaintenanceLog = {
  id: string;
  vehicle_id: string;
  type: MaintenanceType;
  description: string | null;
  cost: number | null;
  paid_by: string | null;
  date: string;
  status: string | null;
  created_at: string;
  vehicles?: { id: string; plate_number: string; brand: string | null } | null;
};

type Vehicle = { id: string; plate_number: string; brand: string | null };

const typeLabels: Record<MaintenanceType, string> = { routine: 'دورية', breakdown: 'أعطال', accident: 'حوادث' };
const typeStyles: Record<MaintenanceType, string> = { routine: 'badge-info', breakdown: 'badge-warning', accident: 'badge-urgent' };
const paidByLabels: Record<string, string> = { company: 'الشركة', driver: 'السائق', insurance: 'التأمين' };

const emptyForm = {
  vehicle_id: '',
  type: 'routine' as MaintenanceType,
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  cost: '',
  paid_by: 'company' as PaidBy,
  status: 'completed',
};

// ─── Form Modal ───────────────────────────────────────────────────────────────
const MaintenanceFormModal = ({ open, onClose, onSaved, editLog, vehicles }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  editLog?: MaintenanceLog | null; vehicles: Vehicle[];
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editLog) {
      setForm({
        vehicle_id: editLog.vehicle_id,
        type: editLog.type,
        date: editLog.date,
        description: editLog.description || '',
        cost: editLog.cost?.toString() || '',
        paid_by: (editLog.paid_by || 'company') as PaidBy,
        status: editLog.status || 'completed',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editLog, open]);

  const handleSave = async () => {
    if (!form.vehicle_id) return toast({ title: 'يرجى اختيار المركبة', variant: 'destructive' });
    setSaving(true);
    const payload = {
      vehicle_id: form.vehicle_id,
      type: form.type,
      date: form.date,
      description: form.description || null,
      cost: form.cost ? parseFloat(form.cost) : null,
      paid_by: form.paid_by,
      status: form.status,
    };
    let error;
    if (editLog) {
      ({ error } = await vehicleService.updateMaintenanceLog(editLog.id, payload));
    } else {
      ({ error } = await vehicleService.createMaintenanceLog(payload));
    }
    setSaving(false);
    if (error) return toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
    toast({ title: editLog ? 'تم تحديث سجل الصيانة' : 'تم تسجيل الصيانة بنجاح' });
    onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editLog ? 'تعديل سجل الصيانة' : 'تسجيل صيانة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">المركبة *</label>
            <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
              <SelectTrigger><SelectValue placeholder="اختر المركبة" /></SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.plate_number}{v.brand ? ` — ${v.brand}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">نوع الصيانة</label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as MaintenanceType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">دورية</SelectItem>
                <SelectItem value="breakdown">أعطال</SelectItem>
                <SelectItem value="accident">حوادث</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">التاريخ</label>
            <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">التكلفة (ر.س)</label>
            <Input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">على حساب</label>
            <Select value={form.paid_by} onValueChange={v => setForm(p => ({ ...p, paid_by: v as PaidBy }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="company">الشركة</SelectItem>
                <SelectItem value="driver">السائق</SelectItem>
                <SelectItem value="insurance">التأمين</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">الحالة</label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">مكتملة</SelectItem>
                <SelectItem value="pending">معلّقة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium mb-1 block">الوصف</label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="وصف مختصر للصيانة..." />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editLog ? 'حفظ التعديلات' : 'تسجيل الصيانة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border/30">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const MaintenanceLogs = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('vehicles');
  const canEdit = permissions.can_edit;
  const canDelete = permissions.can_delete;

  const tableRef = useRef<HTMLTableElement>(null);

  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paidByFilter, setPaidByFilter] = useState('all');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editLog, setEditLog] = useState<MaintenanceLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [logsRes, vehiclesRes] = await Promise.all([
      vehicleService.getMaintenanceLogs(),
      vehicleService.getForSelect(),
    ]);
    if (logsRes.data) setLogs(logsRes.data as MaintenanceLog[]);
    else if (logsRes.error) toast({ title: 'خطأ في تحميل البيانات', description: logsRes.error.message, variant: 'destructive' });
    if (vehiclesRes.data) setVehicles(vehiclesRes.data);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Summary stats
  const currentMonth = format(new Date(), 'yyyy-MM');
  const totalCount = logs.length;
  const totalCost = logs.reduce((s, l) => s + (l.cost || 0), 0);
  const monthCount = logs.filter(l => l.date.startsWith(currentMonth)).length;
  const monthCost = logs.filter(l => l.date.startsWith(currentMonth)).reduce((s, l) => s + (l.cost || 0), 0);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const plate = l.vehicles?.plate_number || '';
    const desc = l.description || '';
    const matchSearch = !q || plate.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || l.type === typeFilter;
    const matchPaidBy = paidByFilter === 'all' || l.paid_by === paidByFilter;
    const matchVehicle = vehicleFilter === 'all' || l.vehicle_id === vehicleFilter;
    return matchSearch && matchType && matchPaidBy && matchVehicle;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await vehicleService.deleteMaintenanceLog(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم حذف سجل الصيانة' });
    fetchData();
  };

  const handleExport = () => {
    const rows = filtered.map(l => ({
      'المركبة': l.vehicles?.plate_number || '',
      'الماركة': l.vehicles?.brand || '',
      'النوع': typeLabels[l.type as MaintenanceType] || l.type,
      'الوصف': l.description || '',
      'التكلفة (ر.س)': l.cost || 0,
      'على حساب': paidByLabels[l.paid_by || ''] || l.paid_by || '',
      'التاريخ': l.date,
      'الحالة': l.status === 'completed' ? 'مكتملة' : 'معلّقة',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الصيانة');
    XLSX.writeFile(wb, `maintenance_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleTemplate = () => {
    const headers = [['رقم المركبة', 'نوع الصيانة', 'التكلفة (ر.س)', 'تاريخ الصيانة (YYYY-MM-DD)', 'الدفع بواسطة', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب الصيانة');
    XLSX.writeFile(wb, 'template_maintenance.xlsx');
  };

  const importRef = useRef<HTMLInputElement>(null);

  const handlePrint = () => {
    const table = tableRef.current;
    if (!table) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>سجل الصيانة</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px;white-space:nowrap}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right;white-space:nowrap}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>سجل الصيانة</h2><p class="sub">المجموع: ${filtered.length} سجل — ${new Date().toLocaleDateString('ar-SA')}</p>`);
    if (!printWindow.document.body) return;
    // Append the live DOM table node to avoid string-interpolating table HTML.
    printWindow.document.body.appendChild(table.cloneNode(true));
    printWindow.document.write(`<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">سجل الصيانة</span>
          </nav>
          <h1 className="page-title">سجل الصيانة</h1>
        </div>
        <div className="flex gap-2">
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><FolderOpen size={14} /> ملفات</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button onClick={() => { setEditLog(null); setShowForm(true); }} className="gap-2 shadow-brand-sm">
              <Plus size={15} /> تسجيل صيانة
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الصيانات', value: totalCount, icon: '🔧', cls: 'text-foreground' },
          { label: 'إجمالي التكاليف', value: `${totalCost.toLocaleString()} ر.س`, icon: '💰', cls: 'text-destructive' },
          { label: 'صيانة هذا الشهر', value: monthCount, icon: '📅', cls: 'text-primary' },
          { label: 'تكلفة هذا الشهر', value: `${monthCost.toLocaleString()} ر.س`, icon: '📊', cls: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{s.icon}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none right-3" />
          <Input
            placeholder="بحث برقم اللوحة أو الوصف..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-8 h-9 text-sm w-56"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="نوع الصيانة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="routine">دورية</SelectItem>
            <SelectItem value="breakdown">أعطال</SelectItem>
            <SelectItem value="accident">حوادث</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paidByFilter} onValueChange={setPaidByFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="على حساب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="company">الشركة</SelectItem>
            <SelectItem value="driver">السائق</SelectItem>
            <SelectItem value="insurance">التأمين</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
          <SelectTrigger className="h-9 w-44 text-sm"><SelectValue placeholder="كل المركبات" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المركبات</SelectItem>
            {vehicles.map(v => (
              <SelectItem key={v.id} value={v.id}>{v.plate_number}{v.brand ? ` — ${v.brand}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="ta-th w-10">#</th>
                <th className="ta-th">المركبة</th>
                <th className="ta-th">النوع</th>
                <th className="ta-th">الوصف</th>
                <th className="ta-th text-center">التكلفة</th>
                <th className="ta-th text-center">على حساب</th>
                <th className="ta-th text-center">التاريخ</th>
                <th className="ta-th text-center w-20">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Wrench size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد سجلات صيانة</p>
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => (
                  <tr key={log.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-3 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs font-semibold text-foreground">{log.vehicles?.plate_number || '—'}</span>
                      {log.vehicles?.brand && <span className="text-xs text-muted-foreground mr-1.5">{log.vehicles.brand}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={typeStyles[log.type as MaintenanceType] || 'badge-info'}>
                        {typeLabels[log.type as MaintenanceType] || log.type}
                      </span>
                    </td>
                    <td className="px-3 py-3 max-w-[200px]">
                      <p className="truncate text-xs text-foreground">{log.description || '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-destructive text-xs">
                      {log.cost ? `${log.cost.toLocaleString()} ر.س` : '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-muted-foreground">{paidByLabels[log.paid_by || ''] || log.paid_by || '—'}</span>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-muted-foreground">{log.date}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canEdit && (
                          <button
                            onClick={() => { setEditLog(log); setShowForm(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Edit size={13} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(log)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t border-border/30 text-xs text-muted-foreground">
            إجمالي النتائج: {filtered.length} سجل — التكاليف: {filtered.reduce((s, l) => s + (l.cost || 0), 0).toLocaleString()} ر.س
          </div>
        )}
      </div>

      {/* Form Modal */}
      <MaintenanceFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={fetchData}
        editLog={editLog}
        vehicles={vehicles}
      />

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف سجل الصيانة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90 gap-2">
              {deleting && <Loader2 size={13} className="animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MaintenanceLogs;
