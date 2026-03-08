import { useState, useEffect } from 'react';
import { Settings, Plus, Pencil, Trash2, Check, X, Pin, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

type Tier = { from: number; to: number; pricePerOrder: number };
type Scheme = {
  id: string;
  name: string;
  name_en?: string;
  status: 'active' | 'archived';
  target_orders?: number;
  target_bonus?: number;
  tiers?: Tier[];
  assignedCount?: number;
};
type Snapshot = { month_year: string };

const appsList = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا', 'تويو', 'أمازون'];

const arabicMonths: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};
const monthLabel = (my: string) => {
  const [yr, mo] = my.split('-');
  return `${arabicMonths[mo] || mo} ${yr}`;
};

const currentMonth = format(new Date(), 'yyyy-MM');

const SalarySchemes = () => {
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [tiers, setTiersMap] = useState<Record<string, Tier[]>>({});
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Scheme | null>(null);
  const [name, setName] = useState('');
  const [app, setApp] = useState('');
  const [formTiers, setFormTiers] = useState<Tier[]>([{ from: 1, to: 500, pricePerOrder: 5 }]);
  const [hasTarget, setHasTarget] = useState(false);
  const [targetOrders, setTargetOrders] = useState(700);
  const [targetBonus, setTargetBonusVal] = useState(400);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: sData }, { data: tData }, { data: snData }] = await Promise.all([
      supabase.from('salary_schemes').select('*').order('created_at', { ascending: false }),
      supabase.from('salary_scheme_tiers').select('*').order('tier_order'),
      supabase.from('scheme_month_snapshots').select('scheme_id, month_year'),
    ]);

    if (sData) setSchemes(sData as Scheme[]);
    if (tData) {
      const map: Record<string, Tier[]> = {};
      for (const t of tData as any[]) {
        if (!map[t.scheme_id]) map[t.scheme_id] = [];
        map[t.scheme_id].push({ from: t.from_orders, to: t.to_orders ?? 9999, pricePerOrder: t.price_per_order });
      }
      setTiersMap(map);
    }
    if (snData) {
      const map: Record<string, Snapshot[]> = {};
      for (const s of snData as any[]) {
        if (!map[s.scheme_id]) map[s.scheme_id] = [];
        map[s.scheme_id].push({ month_year: s.month_year });
      }
      setSnapshots(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setName(''); setApp('');
    setFormTiers([{ from: 1, to: 500, pricePerOrder: 5 }]);
    setHasTarget(false); setTargetOrders(700); setTargetBonusVal(400);
    setShowModal(true);
  };

  const openEdit = (s: Scheme) => {
    setEditing(s);
    setName(s.name); setApp(s.name_en || '');
    setFormTiers(tiers[s.id]?.length ? [...tiers[s.id]] : [{ from: 1, to: 500, pricePerOrder: 5 }]);
    setHasTarget(!!(s.target_bonus && s.target_orders));
    setTargetOrders(s.target_orders || 700);
    setTargetBonusVal(s.target_bonus || 400);
    setShowModal(true);
  };

  const addTier = () => setFormTiers(prev => [...prev, { from: (prev[prev.length - 1]?.to || 0) + 1, to: (prev[prev.length - 1]?.to || 0) + 500, pricePerOrder: 6 }]);
  const removeTier = (i: number) => setFormTiers(prev => prev.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: number) => setFormTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const handleSave = async () => {
    if (!name) { toast({ title: 'خطأ', description: 'اسم السكيمة مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let schemeId = editing?.id;
      if (editing) {
        await supabase.from('salary_schemes').update({
          name, name_en: app || null,
          target_orders: hasTarget ? targetOrders : null,
          target_bonus: hasTarget ? targetBonus : null,
        }).eq('id', editing.id);
        // Delete old tiers
        await supabase.from('salary_scheme_tiers').delete().eq('scheme_id', editing.id);
      } else {
        const { data } = await supabase.from('salary_schemes').insert({
          name, name_en: app || null,
          target_orders: hasTarget ? targetOrders : null,
          target_bonus: hasTarget ? targetBonus : null,
        }).select('id').single();
        schemeId = data?.id;
      }
      if (schemeId) {
        await supabase.from('salary_scheme_tiers').insert(
          formTiers.map((t, i) => ({
            scheme_id: schemeId!,
            from_orders: t.from,
            to_orders: t.to >= 9999 ? null : t.to,
            price_per_order: t.pricePerOrder,
            tier_order: i + 1,
          }))
        );
      }
      toast({ title: editing ? 'تم التعديل' : 'تمت الإضافة', description: editing ? 'تم تعديل السكيمة بنجاح' : 'تمت إضافة السكيمة بنجاح' });
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    await supabase.from('salary_schemes').update({ status: newStatus }).eq('id', id);
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, status: newStatus as 'active' | 'archived' } : s));
    toast({ title: 'تم التحديث' });
  };

  const handleSnapshot = async (schemeId: string) => {
    setSnapshotLoading(schemeId);
    try {
      const schemeTiers = tiers[schemeId] || [];
      const { error } = await supabase.from('scheme_month_snapshots').upsert({
        scheme_id: schemeId,
        month_year: currentMonth,
        snapshot: schemeTiers,
      }, { onConflict: 'scheme_id,month_year' });
      if (error) throw error;
      toast({ title: '📌 تم التثبيت', description: `تم تثبيت السكيمة لشهر ${monthLabel(currentMonth)}` });
      // Update local snapshots
      setSnapshots(prev => ({
        ...prev,
        [schemeId]: [
          ...(prev[schemeId] || []).filter(s => s.month_year !== currentMonth),
          { month_year: currentMonth },
        ],
      }));
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setSnapshotLoading(null);
  };

  const isSnapped = (schemeId: string) => snapshots[schemeId]?.some(s => s.month_year === currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings size={24} /> إدارة السكيمات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">شرائح الرواتب والمكافآت</p>
        </div>
        <Button className="gap-2" onClick={openAdd}><Plus size={16} /> إضافة سكيمة</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="bg-card rounded-xl border border-border/50 p-5 h-48 animate-pulse" />)}
        </div>
      ) : schemes.length === 0 ? (
        <div className="bg-card rounded-xl border border-dashed border-border p-16 text-center">
          <Settings size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">لا توجد سكيمات بعد — أضف سكيمة جديدة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {schemes.map(s => (
            <div key={s.id} className={`bg-card rounded-xl border shadow-sm p-5 ${s.status === 'active' ? 'border-border/50' : 'border-border/30 opacity-70'}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{s.name}</h3>
                  {s.name_en && <p className="text-xs text-muted-foreground">{s.name_en}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={s.status === 'active' ? 'badge-success' : 'badge-warning'}>{s.status === 'active' ? 'نشطة' : 'مؤرشفة'}</span>
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => handleArchive(s.id, s.status)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={s.status === 'active' ? 'أرشفة' : 'تفعيل'}>
                    {s.status === 'active' ? <Trash2 size={14} /> : <Check size={14} />}
                  </button>
                </div>
              </div>

              {/* Tiers */}
              <div className="space-y-1.5 mb-3">
                <p className="text-xs font-medium text-muted-foreground">الشرائح:</p>
                {(tiers[s.id] || []).map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                    <span className="text-muted-foreground">من {t.from} إلى {t.to >= 9999 ? '∞' : t.to}</span>
                    <span className="mr-auto font-semibold text-primary">{t.pricePerOrder} ر.س/طلب</span>
                  </div>
                ))}
              </div>

              {s.target_bonus && s.target_orders && (
                <div className="bg-success/10 rounded-lg px-3 py-2 text-sm mb-3">
                  <span className="text-success font-medium">🎯 Target Bonus:</span> عند {s.target_orders} طلب → +{s.target_bonus} ر.س
                </div>
              )}

              {/* Snapshot section */}
              <div className="border-t border-border/30 pt-3 mt-2 flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-wrap gap-1">
                  {(snapshots[s.id] || []).sort((a, b) => a.month_year.localeCompare(b.month_year)).slice(-6).map(sn => (
                    <span key={sn.month_year} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      <Lock size={9} /> {monthLabel(sn.month_year)} ✓
                    </span>
                  ))}
                  {(snapshots[s.id] || []).length === 0 && (
                    <span className="text-xs text-muted-foreground">لا توجد لقطات شهرية</span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={isSnapped(s.id) ? 'secondary' : 'outline'}
                  className="gap-1 h-7 text-xs"
                  onClick={() => handleSnapshot(s.id)}
                  disabled={snapshotLoading === s.id}
                >
                  {snapshotLoading === s.id ? <Loader2 size={12} className="animate-spin" /> : <Pin size={12} />}
                  {isSnapped(s.id) ? `مثبّت: ${monthLabel(currentMonth)} ✓` : `📌 تثبيت لـ${monthLabel(currentMonth)}`}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل السكيمة' : 'إضافة سكيمة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم السكيمة *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="سكيمة هنقر Q2 2025" />
              </div>
              <div className="space-y-2">
                <Label>التطبيق / الاستخدام</Label>
                <Select value={app} onValueChange={setApp}>
                  <SelectTrigger><SelectValue placeholder="اختر التطبيق" /></SelectTrigger>
                  <SelectContent>{appsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>شرائح الأسعار</Label>
                <Button size="sm" variant="outline" onClick={addTier} className="gap-1 h-7 text-xs"><Plus size={12} /> إضافة شريحة</Button>
              </div>
              {formTiers.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div><p className="text-xs text-muted-foreground mb-1">من</p><Input type="number" value={t.from} onChange={e => updateTier(i, 'from', +e.target.value)} className="h-8 text-sm" /></div>
                    <div><p className="text-xs text-muted-foreground mb-1">إلى</p><Input type="number" value={t.to} onChange={e => updateTier(i, 'to', +e.target.value)} className="h-8 text-sm" /></div>
                    <div><p className="text-xs text-muted-foreground mb-1">ر.س/طلب</p><Input type="number" step="0.5" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" /></div>
                  </div>
                  {formTiers.length > 1 && <button onClick={() => removeTier(i)} className="text-destructive hover:text-destructive/80 p-1"><X size={14} /></button>}
                </div>
              ))}
            </div>
            <div className="space-y-3 border border-border/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label>مكافأة الهدف (Target Bonus)</Label>
                <Switch checked={hasTarget} onCheckedChange={setHasTarget} />
              </div>
              {hasTarget && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">عدد الطلبات المستهدف</Label><Input type="number" value={targetOrders} onChange={e => setTargetOrders(+e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">قيمة المكافأة (ر.س)</Label><Input type="number" value={targetBonus} onChange={e => setTargetBonusVal(+e.target.value)} /></div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin ml-1" />}
              {editing ? 'حفظ التعديلات' : 'إضافة السكيمة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalarySchemes;
