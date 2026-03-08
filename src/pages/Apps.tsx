import { useState, useEffect } from 'react';
import { Smartphone, Search, Plus, Edit2, Power, PowerOff, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { invalidateAppColorsCache } from '@/hooks/useAppColors';

interface AppData {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  employeeCount?: number;
}

interface EmployeeInApp {
  id: string;
  name: string;
  monthOrders: number;
}

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
    };

    let error;
    if (isEdit && app) {
      ({ error } = await supabase.from('apps').update(payload).eq('id', app.id));
    } else {
      ({ error } = await supabase.from('apps').insert(payload));
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
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md border border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? 'تعديل التطبيق' : 'إضافة تطبيق جديد'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-sm mb-1.5 block">اسم التطبيق (عربي) <span className="text-destructive">*</span></Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: هنقرستيشن" />
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">اسم التطبيق (إنجليزي)</Label>
            <Input value={form.name_en} onChange={e => setForm(p => ({ ...p, name_en: e.target.value }))} placeholder="e.g. HungerStation" dir="ltr" />
          </div>

          {/* Color pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm mb-1.5 block">لون التطبيق</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={form.brand_color}
                  onChange={e => setForm(p => ({ ...p, brand_color: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>
            <div>
              <Label className="text-sm mb-1.5 block">لون النص</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.text_color}
                  onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={form.text_color}
                  onChange={e => setForm(p => ({ ...p, text_color: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <Label className="text-sm mb-1.5 block">معاينة</Label>
            <div
              className="rounded-xl px-5 py-3 text-center font-bold text-base"
              style={{ backgroundColor: form.brand_color, color: form.text_color }}
            >
              {form.name || 'اسم التطبيق'}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
            <Label className="text-sm font-medium">حالة التطبيق</Label>
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${form.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                {form.is_active ? 'مفعّل' : 'معطّل'}
              </span>
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
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
  const [apps, setApps] = useState<AppData[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null);
  const [appEmployees, setAppEmployees] = useState<EmployeeInApp[]>([]);
  const [search, setSearch] = useState('');
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [modalApp, setModalApp] = useState<AppData | null | undefined>(undefined); // undefined = closed, null = new

  const fetchApps = async () => {
    setLoadingApps(true);
    const { data } = await supabase
      .from('apps')
      .select('id, name, name_en, brand_color, text_color, is_active')
      .order('name');
    if (!data) { setLoadingApps(false); return; }

    // Get employee count per app
    const appsWithCounts = await Promise.all(
      data.map(async (app: any) => {
        const { count } = await supabase
          .from('employee_apps')
          .select('id', { count: 'exact', head: true })
          .eq('app_id', app.id)
          .eq('status', 'active');
        return {
          id: app.id,
          name: app.name,
          name_en: app.name_en,
          brand_color: app.brand_color || '#6366f1',
          text_color: app.text_color || '#ffffff',
          is_active: app.is_active,
          employeeCount: count || 0,
        };
      })
    );
    setApps(appsWithCounts);
    setLoadingApps(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const handleSelectApp = async (app: AppData) => {
    if (selectedApp?.id === app.id) { setSelectedApp(null); setAppEmployees([]); return; }
    setSelectedApp(app);
    setLoadingEmployees(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]), 0).getDate()}`;

    // Fetch active employees only (not absconded/terminated)
    const { data: empApps } = await supabase
      .from('employee_apps')
      .select('employee_id, employees!inner(id, name, status, sponsorship_status)')
      .eq('app_id', app.id)
      .eq('status', 'active');

    if (!empApps) { setLoadingEmployees(false); return; }

    const employees = empApps
      .map(ea => (ea.employees as any))
      .filter(Boolean)
      .filter((e: any) =>
        e.status === 'active' &&
        e.sponsorship_status !== 'absconded' &&
        e.sponsorship_status !== 'terminated'
      );

    const employeesWithOrders = await Promise.all(
      employees.map(async (emp: any) => {
        const { data: orders } = await supabase
          .from('daily_orders')
          .select('orders_count')
          .eq('employee_id', emp.id)
          .eq('app_id', app.id)
          .gte('date', startDate)
          .lte('date', endDate);
        const total = orders?.reduce((s: number, o: any) => s + o.orders_count, 0) || 0;
        return { id: emp.id, name: emp.name, monthOrders: total };
      })
    );
    setAppEmployees(employeesWithOrders);
    setLoadingEmployees(false);
  };

  const handleToggleActive = async (app: AppData, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('apps').update({ is_active: !app.is_active }).eq('id', app.id);
    if (error) {
      toast({ title: 'حدث خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    invalidateAppColorsCache();
    toast({ title: app.is_active ? 'تم تعطيل التطبيق' : 'تم تفعيل التطبيق' });
    fetchApps();
  };

  const filteredEmployees = appEmployees.filter(e => e.name.includes(search));

  return (
    <div className="space-y-6">
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
          <Button onClick={() => setModalApp(null)} className="gap-2">
            <Plus size={16} /> إضافة تطبيق
          </Button>
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
                className={`relative p-5 rounded-xl border-2 text-center transition-all cursor-pointer group
                  ${!app.is_active ? 'opacity-50 cursor-not-allowed' : ''}
                  ${isSelected ? 'ring-2 ring-primary border-primary shadow-md' : 'border-border hover:shadow-md'}`}
              >
                {/* Action buttons */}
                <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => { e.stopPropagation(); setModalApp(app); }}
                    className="w-6 h-6 rounded-md bg-background/90 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    title="تعديل"
                  >
                    <Edit2 size={11} />
                  </button>
                  <button
                    onClick={e => handleToggleActive(app, e)}
                    className={`w-6 h-6 rounded-md bg-background/90 border border-border flex items-center justify-center transition-colors ${app.is_active ? 'text-success hover:text-destructive hover:border-destructive' : 'text-muted-foreground hover:text-success hover:border-success'}`}
                    title={app.is_active ? 'تعطيل' : 'تفعيل'}
                  >
                    {app.is_active ? <Power size={11} /> : <PowerOff size={11} />}
                  </button>
                </div>

                {/* Color indicator dot */}
                <div
                  className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center text-lg font-bold"
                  style={{ backgroundColor: app.brand_color, color: app.text_color }}
                >
                  {app.name.charAt(0)}
                </div>

                <h3 className="font-bold text-sm text-foreground">{app.name}</h3>
                {app.name_en && <p className="text-xs text-muted-foreground mt-0.5">{app.name_en}</p>}
                <p className="text-2xl font-bold mt-2" style={{ color: app.brand_color }}>{app.employeeCount}</p>
                <p className="text-xs text-muted-foreground">مندوب</p>

                {!app.is_active && (
                  <div className="mt-2">
                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">معطّل</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new card */}
          <button
            onClick={() => setModalApp(null)}
            className="p-5 rounded-xl border-2 border-dashed border-border text-center transition-all hover:border-primary/50 hover:bg-primary/5 group"
          >
            <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <Plus size={18} className="text-muted-foreground group-hover:text-primary" />
            </div>
            <p className="text-sm text-muted-foreground group-hover:text-primary font-medium">إضافة تطبيق</p>
          </button>
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
                    <th className="ta-th text-right">المندوب</th>
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

      {/* Modal */}
      {modalApp !== undefined && (
        <AppModal
          app={modalApp}
          onClose={() => setModalApp(undefined)}
          onSaved={() => { fetchApps(); if (selectedApp) handleSelectApp(selectedApp); }}
        />
      )}
    </div>
  );
};

export default Apps;
