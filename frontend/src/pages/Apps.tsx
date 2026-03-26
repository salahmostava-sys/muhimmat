import { useState, useEffect } from 'react';
import { Smartphone, Search, Plus, Edit2, Power, PowerOff, X, Check, Trash2, PlusCircle, Columns } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { invalidateAppColorsCache } from '@/hooks/useAppColors';
import { useAppsData } from '@/hooks/useAppsData';
import { usePermissions } from '@/hooks/usePermissions';
import { appService } from '@services/appService';

interface CustomColumn {
  key: string;
  label: string;
}

interface AppData {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  employeeCount?: number;
  custom_columns?: CustomColumn[];
}

interface EmployeeInApp {
  id: string;
  name: string;
  monthOrders: number;
}

type EmployeeAppRow = {
  employee_id: string;
  employees: {
    id: string;
    name: string;
    status: string;
    sponsorship_status: string | null;
  } | null;
};

// ─── App Modal ────────────────────────────────────────────────────────────────
interface AppModalProps {
  app?: AppData | null;
  onClose: () => void;
  onSaved: () => void;
}

const AppModal = ({ app, onClose, onSaved }: AppModalProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!app;

  const [form, setForm] = useState({
    name: app?.name || '',
    name_en: app?.name_en || '',
    brand_color: app?.brand_color || '#6366f1',
    text_color: app?.text_color || '#ffffff',
    is_active: app?.is_active ?? true,
  });

  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(
    app?.custom_columns || []
  );
  const [newColLabel, setNewColLabel] = useState('');

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const key = `col_${Date.now()}`;
    setCustomColumns(prev => [...prev, { key, label }]);
    setNewColLabel('');
  };

  const removeColumn = (key: string) => {
    setCustomColumns(prev => prev.filter(c => c.key !== key));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || null,
      brand_color: form.brand_color,
      text_color: form.text_color,
      is_active: form.is_active,
      custom_columns: customColumns as unknown as import('@/integrations/supabase/types').Json,
    };

    let error;
    if (isEdit && app) {
      ({ error } = await appService.update(app.id, payload));
    } else {
      ({ error } = await appService.create(payload));
    }

    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    invalidateAppColorsCache();
    toast({ title: isEdit ? 'تم تحديث التطبيق ✅' : 'تم إضافة التطبيق ✅' });
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border/50 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? 'تعديل التطبيق' : 'إضافة تطبيق جديد'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-sm mb-1.5 block">اسم التطبيق (عربي) <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: هنقرستيشن" />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">اسم التطبيق (إنجليزي)</Label>
            <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. HungerStation" dir="ltr" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">لون التطبيق</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.brand_color} onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={form.brand_color} onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))} className="flex-1 font-mono text-sm" dir="ltr" maxLength={7} />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">لون النص</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.text_color} onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={form.text_color} onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))} className="flex-1 font-mono text-sm" dir="ltr" maxLength={7} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-1.5 block">معاينة</Label>
            <div className="rounded-xl px-5 py-3 text-center font-bold text-base" style={{ backgroundColor: form.brand_color, color: form.text_color }}>
              {form.name || 'اسم التطبيق'}
            </div>
          </div>

          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
            <Label className="text-sm font-medium">حالة التطبيق</Label>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${form.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                {form.is_active ? 'مفعّل' : 'معطّل'}
              </span>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
            </div>
          </div>

          {/* ── Custom deduction columns ── */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
              <Columns size={14} className="text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">أعمدة الاستقطاع المخصصة</span>
              <span className="text-xs text-muted-foreground mr-auto">ستظهر كأعمدة قابلة للتحرير في جدول الرواتب</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {customColumns.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">لا توجد أعمدة مضافة بعد</p>
              )}
              {customColumns.map(col => (
                <div key={col.key} className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
                  <span className="flex-1 text-sm text-foreground">{col.label}</span>
                  <button
                    onClick={() => removeColumn(col.key)}
                    className="text-destructive hover:text-destructive/70 transition-colors p-1"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <Input
                  value={newColLabel}
                  onChange={e => setNewColLabel(e.target.value)}
                  placeholder="مثال: محفظة التطبيق، تلف طعام..."
                  className="flex-1 h-8 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); } }}
                />
                <Button size="sm" variant="outline" onClick={addColumn} className="gap-1 h-8 text-xs">
                  <PlusCircle size={13} /> إضافة
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? 'جاري الحفظ...' : <><Check size={15} /> {isEdit ? 'حفظ التعديلات' : 'إضافة التطبيق'}</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Apps Page ───────────────────────────────────────────────────────────
const Apps = () => {
  const { toast } = useToast();
  const { permissions } = usePermissions('apps');
  const [apps, setApps] = useState<AppData[]>([]);
  const {
    data: appsData = [],
    isLoading: loadingApps,
    error: appsError,
    refetch: refetchApps,
  } = useAppsData();
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null);
  const [appEmployees, setAppEmployees] = useState<EmployeeInApp[]>([]);
  const [search, setSearch] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [modalApp, setModalApp] = useState<AppData | null | undefined>(undefined);
  const [deleteApp, setDeleteApp] = useState<AppData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setApps(appsData as AppData[]);
  }, [appsData]);

  useEffect(() => {
    if (!appsError) return;
    const message =
      appsError instanceof Error
        ? appsError.message
        : 'حدث خطأ غير متوقع أثناء تحميل التطبيقات';
    toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
  }, [appsError, toast]);

  const handleSelectApp = async (app: AppData) => {
    if (selectedApp?.id === app.id) { setSelectedApp(null); setAppEmployees([]); return; }
    setSelectedApp(app);
    setLoadingEmployees(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${new Date(Number.parseInt(currentMonth.split('-')[0]), Number.parseInt(currentMonth.split('-')[1]), 0).getDate()}`;

    const { data: empApps } = await appService.getActiveEmployeeAppsWithEmployees(app.id);

    if (!empApps) { setLoadingEmployees(false); return; }

    const employees = (empApps as EmployeeAppRow[])
      .map(ea => ea.employees)
      .filter(Boolean)
      .filter((e) =>
        e.status === 'active' &&
        e.sponsorship_status !== 'absconded' &&
        e.sponsorship_status !== 'terminated'
      );

    const employeesWithOrders = await Promise.all(
      employees.map(async (emp) => {
        const { data: orders } = await appService.getEmployeeMonthlyOrders(emp.id, app.id, startDate, endDate);
        const total = orders?.reduce((s: number, o) => s + o.orders_count, 0) || 0;
        return { id: emp.id, name: emp.name, monthOrders: total };
      })
    );
    setAppEmployees(employeesWithOrders);
    setLoadingEmployees(false);
  };

  const handleToggleActive = async (app: AppData, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await appService.toggleActive(app.id, !app.is_active);
    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    invalidateAppColorsCache();
    toast({ title: app.is_active ? 'تم تعطيل التطبيق' : 'تم تفعيل التطبيق' });
    void refetchApps();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteApp) return;
    setDeleting(true);
    const { error } = await appService.delete(deleteApp.id);
    if (error) {
      toast({ title: 'حدث خطأ أثناء الحذف', description: error.message, variant: 'destructive' });
      setDeleting(false);
      return;
    }
    invalidateAppColorsCache();
    toast({ title: `تم حذف تطبيق "${deleteApp.name}" ✅` });
    if (selectedApp?.id === deleteApp.id) { setSelectedApp(null); setAppEmployees([]); }
    setDeleteApp(null);
    setDeleting(false);
    void refetchApps();
  };

  const filteredEmployees = appEmployees.filter(e => e.name.includes(search));

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>التطبيقات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><Smartphone size={20} /> التطبيقات</h1>
            <p className="page-subtitle">إدارة التطبيقات ومناديب كل تطبيق</p>
          </div>
          {permissions.can_edit && (
            <Button onClick={() => setModalApp(null)} className="gap-2">
              <Plus size={16} /> إضافة تطبيق
            </Button>
          )}
        </div>
      </div>

      {/* Apps grid */}
      {loadingApps ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {apps.map(app => {
            const isSelected = selectedApp?.id === app.id;
            return (
              <div
                key={app.id}
                onClick={() => app.is_active && handleSelectApp(app)}
                className={`relative rounded-xl text-center transition-all cursor-pointer group overflow-hidden
                  ${!app.is_active ? 'opacity-60 cursor-not-allowed' : ''}
                  ${isSelected ? 'ring-4 shadow-xl scale-[1.02]' : 'hover:shadow-lg hover:scale-[1.01]'}`}
                style={isSelected ? { outline: `3px solid ${app.brand_color}`, outlineOffset: '2px' } : {}}
              >
                <div className="p-5 h-full" style={{ backgroundColor: app.brand_color }}>
                  {/* Action buttons */}
                  {permissions.can_edit && (
                    <div
                      className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); setModalApp(app); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                        style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: app.text_color }}
                        title="تعديل"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        onClick={e => handleToggleActive(app, e)}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-black/40"
                        style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: app.text_color }}
                        title={app.is_active ? 'تعطيل' : 'تفعيل'}
                      >
                        {app.is_active ? <Power size={11} /> : <PowerOff size={11} />}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteApp(app); }}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-red-600/80"
                        style={{ backgroundColor: 'rgba(0,0,0,0.25)', color: app.text_color }}
                        title="حذف"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}

                  {/* Letter avatar */}
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold shadow-md"
                    style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: app.text_color }}
                  >
                    {app.name.charAt(0)}
                  </div>

                  <h3 className="font-bold text-sm" style={{ color: app.text_color }}>{app.name}</h3>
                  {app.name_en && (
                    <p className="text-xs mt-0.5" style={{ color: app.text_color, opacity: 0.75 }}>{app.name_en}</p>
                  )}
                  <p className="text-3xl font-bold mt-2" style={{ color: app.text_color }}>
                    {app.employeeCount}
                  </p>
                  <p className="text-xs" style={{ color: app.text_color, opacity: 0.75 }}>مندوب</p>

                  {/* Show custom columns count */}
                  {app.custom_columns && app.custom_columns.length > 0 && (
                    <div className="mt-1.5">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: app.text_color }}
                      >
                        <Columns size={9} /> {app.custom_columns.length} أعمدة
                      </span>
                    </div>
                  )}

                  {!app.is_active && (
                    <div className="mt-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(0,0,0,0.2)', color: app.text_color }}
                      >
                        معطّل
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add new card */}
          {permissions.can_edit && (
            <button
              onClick={() => setModalApp(null)}
              className="p-5 rounded-xl border-2 border-dashed border-border text-center transition-all hover:border-primary/50 hover:bg-primary/5 group min-h-[140px] flex flex-col items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Plus size={20} className="text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="text-sm text-muted-foreground group-hover:text-primary font-medium">إضافة تطبيق</p>
            </button>
          )}
        </div>
      )}

      {/* Selected app employees */}
      {selectedApp && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: selectedApp.brand_color }} />
            <h3 className="font-semibold text-foreground">مناديب {selectedApp.name}</h3>
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="ta-table-wrap">
            {loadingEmployees ? (
              <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد مناديب لهذا التطبيق</div>
            ) : (
              <table className="w-full">
                <thead className="ta-thead">
                  <tr>
                    <th className="ta-th text-center">المندوب</th>
                    <th className="ta-th text-center">الحالة</th>
                    <th className="ta-th text-center">طلبات الشهر</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="ta-tr">
                      <td className="ta-td font-medium text-foreground">{emp.name}</td>
                      <td className="ta-td text-center"><span className="badge-success">نشط</span></td>
                      <td className="ta-td text-center font-semibold" style={{ color: selectedApp.brand_color }}>
                        {emp.monthOrders.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {modalApp !== undefined && (
        <AppModal
          app={modalApp}
          onClose={() => setModalApp(undefined)}
          onSaved={() => {
            void refetchApps();
            if (selectedApp) void handleSelectApp(selectedApp);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteApp} onOpenChange={open => { if (!open) setDeleteApp(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التطبيق</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف تطبيق <strong>"{deleteApp?.name}"</strong>؟
              سيتم حذف جميع البيانات المرتبطة به. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'جاري الحذف...' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Apps;
