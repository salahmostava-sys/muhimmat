import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Plus, Pencil, Trash2, Check, X, Pin, Loader2, Lock, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { appService } from '@/services/appService';
import { salarySchemeService } from '@/services/salarySchemeService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

type TierType = 'total_multiplier' | 'fixed_amount' | 'base_plus_incremental';

type Tier = {
  from: number;
  to: number;
  pricePerOrder: number;
  tierType: TierType;
  incrementalThreshold?: number;
  incrementalPrice?: number;
};

type SchemeType = 'order_based' | 'fixed_monthly';

type Scheme = {
  id: string;
  name: string;
  name_en?: string;
  status: 'active' | 'archived';
  scheme_type: SchemeType;
  monthly_amount?: number | null;
  target_orders?: number;
  target_bonus?: number;
  tiers?: Tier[];
};
type Snapshot = { month_year: string };
type AppItem = { id: string; name: string; scheme_id: string | null };
type SalarySchemeTierRow = {
  scheme_id: string;
  from_orders: number;
  to_orders: number | null;
  price_per_order: number;
  tier_type?: TierType;
  incremental_threshold?: number | null;
  incremental_price?: number | null;
};

const arabicMonths: Record<string, string> = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};
const monthLabel = (my: string) => {
  const [yr, mo] = my.split('-');
  return `${arabicMonths[mo] || mo} ${yr}`;
};

const monthNameOnly = (my: string) => {
  const mo = my.split('-')[1];
  return arabicMonths[mo] || my;
};

const buildMonthsOfYear = (year: number) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

/** نطاق السنوات الثابت في واجهة تثبيت الشهور */
const SNAPSHOT_YEAR_MIN = 2025;
const SNAPSHOT_YEAR_MAX = 2030;

const snapshotYearOptions = (): number[] =>
  Array.from({ length: SNAPSHOT_YEAR_MAX - SNAPSHOT_YEAR_MIN + 1 }, (_, i) => SNAPSHOT_YEAR_MIN + i);

const clampSnapshotYear = (y: number) =>
  Math.min(SNAPSHOT_YEAR_MAX, Math.max(SNAPSHOT_YEAR_MIN, y));

const tierTypeLabels: Record<TierType, string> = {
  total_multiplier: 'إجمالي × سعر',
  fixed_amount: 'مبلغ ثابت',
  base_plus_incremental: 'أساس + زيادي',
};

const currentMonth = format(new Date(), 'yyyy-MM');

interface SalarySchemesProps {
  embedded?: boolean;
}

const SalarySchemes = ({ embedded = false }: SalarySchemesProps) => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [tiers, setTiersMap] = useState<Record<string, Tier[]>>({});
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [apps, setApps] = useState<AppItem[]>([]);
  const {
    data: schemeData,
    isLoading: loading,
    error: schemeDataError,
    refetch: refetchSchemeData,
  } = useQuery({
    queryKey: ['salary-schemes', 'page-data'],
    enabled: !!session,
    queryFn: async () => {
      const [{ data: sData, error: sErr }, { data: tData, error: tErr }, { data: snData, error: snErr }, { data: aData, error: aErr }] = await Promise.all([
        salarySchemeService.getSchemes(),
        salarySchemeService.getTiers(),
        salarySchemeService.getSnapshots(),
        appService.getActiveWithScheme(),
      ]);

      if (sErr) throw sErr;
      if (tErr) throw tErr;
      if (snErr) throw snErr;
      if (aErr) throw aErr;

      const tiersMap: Record<string, Tier[]> = {};
      for (const t of (tData || []) as SalarySchemeTierRow[]) {
        if (!tiersMap[t.scheme_id]) tiersMap[t.scheme_id] = [];
        tiersMap[t.scheme_id].push({
          from: t.from_orders,
          to: t.to_orders ?? 9999,
          pricePerOrder: t.price_per_order,
          tierType: (t.tier_type as TierType) || 'total_multiplier',
          incrementalThreshold: t.incremental_threshold ?? undefined,
          incrementalPrice: t.incremental_price ?? undefined,
        });
      }

      const snapshotsMap: Record<string, Snapshot[]> = {};
      for (const s of (snData || []) as { scheme_id: string; month_year: string }[]) {
        if (!snapshotsMap[s.scheme_id]) snapshotsMap[s.scheme_id] = [];
        snapshotsMap[s.scheme_id].push({ month_year: s.month_year });
      }

      return {
        schemes: (sData || []) as Scheme[],
        apps: (aData || []) as AppItem[],
        tiersMap,
        snapshotsMap,
      };
    },
    retry: 2,
    staleTime: 60_000,
  });
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);
  /** سنة عرض شبكة الأشهر لكل سكيمة */
  const [snapshotYearByScheme, setSnapshotYearByScheme] = useState<Record<string, number>>({});
  /** أشهر محددة للتثبيت (غير المثبتة بعد) ضمن السنة المعروضة */
  const [pinSelectionByScheme, setPinSelectionByScheme] = useState<Record<string, string[]>>({});

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Scheme | null>(null);
  const [name, setName] = useState('');
  const [schemeType, setSchemeType] = useState<SchemeType>('order_based');
  const [monthlyAmount, setMonthlyAmount] = useState(2000);
  const [formTiers, setFormTiers] = useState<Tier[]>([{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]);
  const [hasTarget, setHasTarget] = useState(false);
  const [targetOrders, setTargetOrders] = useState(700);
  const [targetBonus, setTargetBonusVal] = useState(400);
  const [saving, setSaving] = useState(false);

  // Assign scheme to app modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSchemeId, setAssignSchemeId] = useState('');
  const [assignAppId, setAssignAppId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!schemeData) return;
    setSchemes(schemeData.schemes);
    setApps(schemeData.apps);
    setTiersMap(schemeData.tiersMap);
    setSnapshots(schemeData.snapshotsMap);
  }, [schemeData]);

  useEffect(() => {
    if (!schemeDataError) return;
    const message = schemeDataError instanceof Error ? schemeDataError.message : 'تعذر تحميل بيانات السكيّمات';
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [schemeDataError, toast]);

  const getAssignedApps = (schemeId: string) => apps.filter(a => a.scheme_id === schemeId);

  const openAdd = () => {
    setEditing(null);
    setName('');
    setSchemeType('order_based');
    setMonthlyAmount(2000);
    setFormTiers([{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]);
    setHasTarget(false); setTargetOrders(700); setTargetBonusVal(400);
    setShowModal(true);
  };

  const openEdit = (s: Scheme) => {
    setEditing(s);
    setName(s.name);
    setSchemeType(s.scheme_type || 'order_based');
    setMonthlyAmount(s.monthly_amount || 2000);
    setFormTiers(tiers[s.id]?.length ? [...tiers[s.id]] : [{ from: 1, to: 500, pricePerOrder: 5, tierType: 'total_multiplier' }]);
    setHasTarget(!!(s.target_bonus && s.target_orders));
    setTargetOrders(s.target_orders || 700);
    setTargetBonusVal(s.target_bonus || 400);
    setShowModal(true);
  };

  const openAssign = (schemeId: string) => {
    setAssignSchemeId(schemeId);
    setAssignAppId('');
    setShowAssignModal(true);
  };

  const addTier = () => setFormTiers(prev => [
    ...prev,
    { from: (prev[prev.length - 1]?.to || 0) + 1, to: (prev[prev.length - 1]?.to || 0) + 500, pricePerOrder: 6, tierType: 'total_multiplier' as TierType }
  ]);
  const removeTier = (i: number) => setFormTiers(prev => prev.filter((_, idx) => idx !== i));
  const updateTier = (i: number, field: string, val: number | string) =>
    setFormTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

  const handleSave = async () => {
    if (!name) { toast({ title: 'خطأ', description: 'اسم السكيمة مطلوب', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      let schemeId = editing?.id;
      const schemePayload = {
        name,
        scheme_type: schemeType,
        monthly_amount: schemeType === 'fixed_monthly' ? monthlyAmount : null,
        target_orders: schemeType === 'order_based' && hasTarget ? targetOrders : null,
        target_bonus: schemeType === 'order_based' && hasTarget ? targetBonus : null,
      };

      if (editing) {
        await salarySchemeService.updateScheme(editing.id, schemePayload);
        await salarySchemeService.deleteSchemeTiers(editing.id);
      } else {
        const { data } = await salarySchemeService.createScheme(schemePayload);
        schemeId = data?.id;
      }

      if (schemeId && schemeType === 'order_based') {
        await salarySchemeService.insertSchemeTiers(
          formTiers.map((t, i) => ({
            scheme_id: schemeId!,
            from_orders: t.from,
            to_orders: t.to >= 9999 ? null : t.to,
            price_per_order: t.pricePerOrder,
            tier_order: i + 1,
            tier_type: t.tierType,
            incremental_threshold: t.tierType === 'base_plus_incremental' ? t.incrementalThreshold ?? t.from : null,
            incremental_price: t.tierType === 'base_plus_incremental' ? t.incrementalPrice ?? 0 : null,
          }))
        );
      }

      toast({ title: editing ? 'تم التعديل' : 'تمت الإضافة', description: editing ? 'تم تعديل السكيمة بنجاح' : 'تمت إضافة السكيمة بنجاح' });
      setShowModal(false);
      void refetchSchemeData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleAssign = async () => {
    if (!assignAppId) { toast({ title: 'خطأ', description: 'اختر منصة أولاً', variant: 'destructive' }); return; }
    setAssigning(true);
    try {
      const { error } = await appService.assignScheme(assignAppId, assignSchemeId);
      if (error) throw error;
      toast({ title: '✅ تم الربط', description: `تم ربط السكيمة بالمنصة بنجاح` });
      setShowAssignModal(false);
      void refetchSchemeData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setAssigning(false);
  };

  const handleUnassignApp = async (appId: string) => {
    await appService.assignScheme(appId, null);
    toast({ title: 'تم إلغاء الربط' });
    void refetchSchemeData();
  };

  const handleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    await salarySchemeService.updateSchemeStatus(id, newStatus as 'active' | 'archived');
    setSchemes(prev => prev.map(s => s.id === id ? { ...s, status: newStatus as 'active' | 'archived' } : s));
    toast({ title: 'تم التحديث' });
  };

  const handleSnapshot = async (schemeId: string, monthsToPin?: string[]) => {
    setSnapshotLoading(schemeId);
    try {
      const schemeTiers = tiers[schemeId] || [];
      const months = monthsToPin && monthsToPin.length > 0 ? monthsToPin : [currentMonth];
      for (const m of months) {
        const { error } = await salarySchemeService.upsertSnapshot(
          schemeId,
          m,
          schemeTiers as unknown as import('@/integrations/supabase/types').Json
        );
        if (error) throw error;
      }
      toast({ title: '📌 تم التثبيت', description: `تم تثبيت السكيمة لعدد ${months.length} شهر` });
      setSnapshots(prev => ({
        ...prev,
        [schemeId]: [
          ...(prev[schemeId] || []).filter(s => !months.includes(s.month_year)),
          ...months.map((m) => ({ month_year: m })),
        ],
      }));
      setPinSelectionByScheme(prev => ({
        ...prev,
        [schemeId]: (prev[schemeId] || []).filter(m => !months.includes(m)),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSnapshotLoading(null);
  };

  const handleUnpinSnapshot = async (schemeId: string, monthYear: string) => {
    setSnapshotLoading(schemeId);
    try {
      const { error } = await salarySchemeService.deleteSnapshot(schemeId, monthYear);
      if (error) throw error;
      setSnapshots(prev => ({
        ...prev,
        [schemeId]: (prev[schemeId] || []).filter(s => s.month_year !== monthYear),
      }));
      toast({ title: 'تم إلغاء التثبيت', description: monthLabel(monthYear) });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSnapshotLoading(null);
  };

  const togglePinMonthSelect = (schemeId: string, monthYear: string) => {
    setPinSelectionByScheme(prev => {
      const cur = prev[schemeId] || [];
      const next = cur.includes(monthYear) ? cur.filter(m => m !== monthYear) : [...cur, monthYear];
      return { ...prev, [schemeId]: next };
    });
  };

  const setSchemeSnapshotYear = (schemeId: string, year: number) => {
    setSnapshotYearByScheme(prev => ({ ...prev, [schemeId]: year }));
    setPinSelectionByScheme(prev => {
      const next = { ...prev };
      delete next[schemeId];
      return next;
    });
  };

  const availableApps = (schemeId: string) => apps.filter(a => !a.scheme_id || a.scheme_id === schemeId);

  const renderTierDescription = (t: Tier) => {
    if (t.tierType === 'fixed_amount') {
      return <span className="mr-auto font-semibold text-primary">{t.pricePerOrder} ر.س ثابت</span>;
    }
    if (t.tierType === 'base_plus_incremental') {
      return (
        <span className="mr-auto font-semibold text-primary">
          {t.pricePerOrder} + ({'>'}  {t.incrementalThreshold ?? t.from}) × {t.incrementalPrice ?? 0} ر.س
        </span>
      );
    }
    return <span className="mr-auto font-semibold text-primary">{t.pricePerOrder} ر.س/طلب</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Settings size={24} /> إدارة السكيمات
            </h1>
            <p className="text-sm text-muted-foreground mt-1">شرائح الرواتب والمكافآت — السكيمة مرتبطة بالمنصة</p>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-foreground">مخططات الرواتب</h2>
            <p className="text-xs text-muted-foreground mt-1">إدارة الشرائح وربطها بالمنصات</p>
          </div>
        )}
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
          {schemes.map(s => {
            const assignedApps = getAssignedApps(s.id);
            const isFixed = s.scheme_type === 'fixed_monthly';
            return (
              <div key={s.id} className={`bg-card rounded-xl border shadow-card p-5 ${s.status === 'active' ? 'border-border/50' : 'border-border/30 opacity-70'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isFixed ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                      {isFixed ? '📅 راتب شهري ثابت' : '📦 بالطلبات'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={s.status === 'active' ? 'badge-success' : 'badge-warning'}>{s.status === 'active' ? 'نشطة' : 'مؤرشفة'}</span>
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleArchive(s.id, s.status)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={s.status === 'active' ? 'أرشفة' : 'تفعيل'}>
                      {s.status === 'active' ? <Trash2 size={14} /> : <Check size={14} />}
                    </button>
                  </div>
                </div>

                {/* Assigned Apps */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">المنصات المرتبطة:</p>
                    <button onClick={() => openAssign(s.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Link2 size={11} /> ربط منصة
                    </button>
                  </div>
                  {assignedApps.length === 0 ? (
                    <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-1.5">⚠️ لا توجد منصة مرتبطة — الرواتب ستكون صفر</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedApps.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                          {a.name}
                          <button onClick={() => handleUnassignApp(a.id)} className="hover:text-destructive ml-0.5"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fixed Monthly */}
                {isFixed ? (
                  <div className="bg-accent rounded-lg px-3 py-2 text-sm mb-3">
                    <span className="text-accent-foreground font-medium">📅 الراتب الشهري الكامل:</span>
                    <span className="font-bold mr-2">{(s.monthly_amount || 0).toLocaleString()} ر.س</span>
                    <p className="text-xs text-muted-foreground mt-0.5">(monthly_amount ÷ 30) × أيام الحضور</p>
                  </div>
                ) : (
                  <>
                    {/* Tiers */}
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">الشرائح:</p>
                      {(tiers[s.id] || []).map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{tierTypeLabels[t.tierType] || t.tierType}</span>
                          <span className="text-muted-foreground">من {t.from} إلى {t.to >= 9999 ? '∞' : t.to}</span>
                          {renderTierDescription(t)}
                        </div>
                      ))}
                    </div>

                    {s.target_bonus && s.target_orders && (
                      <div className="bg-success/10 rounded-lg px-3 py-2 text-sm mb-3">
                        <span className="text-success font-medium">🎯 Target Bonus:</span> عند {s.target_orders} طلب → +{s.target_bonus} ر.س
                      </div>
                    )}
                  </>
                )}

                {/* Snapshot section — شبكة أشهر أفقية + سنة + تثبيت / إلغاء تثبيت */}
                {(() => {
                  const y = clampSnapshotYear(snapshotYearByScheme[s.id] ?? new Date().getFullYear());
                  const yearMonths = buildMonthsOfYear(y);
                  const sel = pinSelectionByScheme[s.id] || [];
                  const pinnedSet = new Set((snapshots[s.id] || []).map(sn => sn.month_year));
                  const busy = snapshotLoading === s.id;
                  return (
                    <div className="border-t border-border/30 pt-3 mt-2 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          تثبيت شرائح الراتب للشهور (للرواتب حسب الطلبات)
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">السنة</span>
                          <Select
                            value={String(y)}
                            onValueChange={v => setSchemeSnapshotYear(s.id, parseInt(v, 10))}
                          >
                            <SelectTrigger className="h-8 w-[88px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {snapshotYearOptions().map(yr => (
                                <SelectItem key={yr} value={String(yr)}>{yr}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {yearMonths.map(my => {
                          const pinned = pinnedSet.has(my);
                          const selected = sel.includes(my);
                          return (
                            <button
                              key={my}
                              type="button"
                              disabled={busy}
                              title={
                                pinned
                                  ? 'مثبت — انقر لإزالة التثبيت'
                                  : selected
                                    ? 'محدد للتثبيت — انقر لإلغاء التحديد'
                                    : 'انقر لتحديده ثم اضغط «تثبيت المحدد»'
                              }
                              onClick={() => {
                                if (pinned) handleUnpinSnapshot(s.id, my);
                                else togglePinMonthSelect(s.id, my);
                              }}
                              className={cn(
                                'inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-colors min-w-[4.25rem]',
                                pinned &&
                                  'bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90',
                                !pinned &&
                                  selected &&
                                  'bg-primary/15 text-primary border-primary/40 ring-1 ring-primary/30',
                                !pinned &&
                                  !selected &&
                                  'bg-background text-muted-foreground border-border/70 hover:border-primary/40 hover:text-foreground'
                              )}
                            >
                              {pinned ? <Lock size={11} className="shrink-0" /> : selected ? <Pin size={11} className="shrink-0" /> : null}
                              <span className="whitespace-nowrap">{monthNameOnly(my)}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1 h-8 text-xs"
                          onClick={() => handleSnapshot(s.id, sel)}
                          disabled={busy || sel.length === 0}
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Pin size={12} />}
                          تثبيت المحدد{sel.length > 0 ? ` (${sel.length})` : ''}
                        </Button>
                        {sel.length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() =>
                              setPinSelectionByScheme(prev => {
                                const next = { ...prev };
                                delete next[s.id];
                                return next;
                              })
                            }
                          >
                            مسح التحديد
                          </button>
                        )}
                        {(snapshots[s.id] || []).length > 0 && (
                          <span className="text-[10px] text-muted-foreground mr-auto">
                            إجمالي {snapshots[s.id]!.length} شهر مثبت عبر السنوات
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* Scheme Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'تعديل السكيمة' : 'إضافة سكيمة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Name */}
            <div className="space-y-2">
              <Label>اسم السكيمة *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="سكيمة هنقر Q2 2025" />
            </div>

            {/* Scheme Type */}
            <div className="space-y-2">
              <Label>نوع السكيمة</Label>
              <Select value={schemeType} onValueChange={v => setSchemeType(v as SchemeType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order_based">📦 بالطلبات (Order-Based)</SelectItem>
                  <SelectItem value="fixed_monthly">📅 راتب ثابت شهري (Fixed Monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fixed Monthly Amount */}
            {schemeType === 'fixed_monthly' && (
              <div className="space-y-2 border border-border rounded-lg p-3 bg-muted/30">
                <Label>الراتب الشهري الكامل (ر.س)</Label>
                <Input
                  type="number"
                  value={monthlyAmount}
                  onChange={e => setMonthlyAmount(+e.target.value)}
                  placeholder="2100"
                />
                <p className="text-xs text-muted-foreground">
                  سيُحسب الراتب الفعلي: (الراتب ÷ 30) × أيام الحضور (present أو late)
                </p>
              </div>
            )}

            {/* Order-Based Tiers */}
            {schemeType === 'order_based' && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>شرائح الأسعار</Label>
                    <Button size="sm" variant="outline" onClick={addTier} className="gap-1 h-7 text-xs"><Plus size={12} /> إضافة شريحة</Button>
                  </div>
                  {formTiers.map((t, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-2">
                      {/* Tier type selector */}
                      <div className="flex items-center gap-2">
                        <Select value={t.tierType} onValueChange={v => updateTier(i, 'tierType', v)}>
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total_multiplier">إجمالي × سعر</SelectItem>
                            <SelectItem value="fixed_amount">مبلغ ثابت للنطاق</SelectItem>
                            <SelectItem value="base_plus_incremental">أساس + زيادي</SelectItem>
                          </SelectContent>
                        </Select>
                        {formTiers.length > 1 && (
                          <button onClick={() => removeTier(i)} className="text-destructive hover:text-destructive/80 p-1"><X size={14} /></button>
                        )}
                      </div>

                      {/* From / To */}
                      <div className="grid grid-cols-2 gap-2">
                        <div><p className="text-xs text-muted-foreground mb-1">من (طلب)</p><Input type="number" value={t.from} onChange={e => updateTier(i, 'from', +e.target.value)} className="h-8 text-sm" /></div>
                        <div><p className="text-xs text-muted-foreground mb-1">إلى (طلب)</p><Input type="number" value={t.to} onChange={e => updateTier(i, 'to', +e.target.value)} className="h-8 text-sm" /></div>
                      </div>

                      {/* Price fields based on tier type */}
                      {t.tierType === 'total_multiplier' && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">السعر لكل طلب (ر.س)</p>
                          <Input type="number" step="0.5" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                          <p className="text-xs text-muted-foreground mt-1">مثال: 440 × 4.5 = 1980 ر.س</p>
                        </div>
                      )}

                      {t.tierType === 'fixed_amount' && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">المبلغ الثابت (ر.س)</p>
                          <Input type="number" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                          <p className="text-xs text-muted-foreground mt-1">مثال: من 441 إلى 460 = 2500 ر.س ثابت</p>
                        </div>
                      )}

                      {t.tierType === 'base_plus_incremental' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">المبلغ الأساسي (ر.س)</p>
                            <Input type="number" value={t.pricePerOrder} onChange={e => updateTier(i, 'pricePerOrder', +e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">حد البداية الزيادي</p>
                            <Input type="number" value={t.incrementalThreshold ?? t.from} onChange={e => updateTier(i, 'incrementalThreshold', +e.target.value)} className="h-8 text-sm" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">سعر الطلب الزيادي (ر.س)</p>
                            <Input type="number" step="0.5" value={t.incrementalPrice ?? 0} onChange={e => updateTier(i, 'incrementalPrice', +e.target.value)} className="h-8 text-sm" />
                          </div>
                          <p className="col-span-3 text-xs text-muted-foreground">مثال: 461 = 2500 + (461-460) × 5 ر.س</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Target Bonus */}
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
              </>
            )}
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

      {/* Assign App Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ربط السكيمة بمنصة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختر المنصة التي ستستخدم هذه السكيمة لحساب رواتب جميع مناديبها</p>
            <div className="space-y-2">
              <Label>المنصة *</Label>
              <Select value={assignAppId} onValueChange={setAssignAppId}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة" /></SelectTrigger>
                <SelectContent>
                  {availableApps(assignSchemeId).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {a.scheme_id === assignSchemeId ? '(مرتبطة حالياً)' : a.scheme_id ? '(مرتبطة بسكيمة أخرى)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={assigning || !assignAppId}>
              {assigning && <Loader2 size={14} className="animate-spin ml-1" />}
              ربط المنصة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalarySchemes;
