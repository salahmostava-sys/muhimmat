import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, Search, Loader2, AlertTriangle, CheckCircle2,
  Calendar, Layers, ChevronUp, ChevronDown, ChevronsUpDown, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, parseISO } from 'date-fns';

/* ─── Types ─── */
type Employee = { id: string; name: string; sponsorship_status: string | null; };
type AppRow   = { id: string; name: string; brand_color: string; text_color: string; };
type TierRow  = {
  id: string;
  sim_number: string | null;
  employee_id: string;
  package_type: string;
  renewal_date: string;
  delivery_status: string;
  app_ids: string[];
  notes: string | null;
  created_at: string;
};

type SortDir = 'asc' | 'desc' | null;

/* ─── Status helpers ─── */
const STATUS_DELIVERED   = 'delivered';
const STATUS_NOT_DELIVERED = 'not_delivered';

const statusLabel = (s: string) =>
  s === STATUS_DELIVERED ? 'مسلّمة' : 'غير مسلّمة';

const statusCls = (s: string) =>
  s === STATUS_DELIVERED
    ? 'bg-success/10 text-success border border-success/20'
    : 'bg-muted text-muted-foreground border border-border';

/* ─── Renewal badge ─── */
const RenewalBadge = ({ date }: { date: string }) => {
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0)  return <span className="text-xs text-destructive font-medium">{date} <span className="text-[10px]">(منتهية)</span></span>;
  if (days <= 7)  return <span className="text-xs text-destructive font-medium">{date} <span className="text-[10px]">({days}د)</span></span>;
  if (days <= 30) return <span className="text-xs text-warning font-medium">{date} <span className="text-[10px]">({days}د)</span></span>;
  return <span className="text-xs text-foreground">{date}</span>;
};

/* ─── Multi-select apps component ─── */
const AppMultiSelect = ({
  apps, selected, onChange,
}: { apps: AppRow[]; selected: string[]; onChange: (ids: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const chosen = apps.filter(a => selected.includes(a.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[32px] w-full flex flex-wrap gap-1 items-center px-2 py-1 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors text-start">
          {chosen.length === 0
            ? <span className="text-xs text-muted-foreground">اختر منصة...</span>
            : chosen.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                style={{ background: a.brand_color, color: a.text_color }}>
                {a.name}
              </span>
            ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {apps.map(a => (
          <button key={a.id} onClick={() => toggle(a.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm">
            <Check size={13} className={selected.includes(a.id) ? 'text-primary' : 'opacity-0'} />
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.brand_color }} />
            {a.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

/* ─── Employee dropdown ─── */
const EmployeeSelect = ({
  employees, value, onChange,
}: { employees: Employee[]; value: string; onChange: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const chosen = employees.find(e => e.id === value);
  const filtered = employees.filter(e => e.name.includes(q));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full min-w-[160px] flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors text-sm">
        <span className={chosen ? 'text-foreground' : 'text-muted-foreground'}>
          {chosen ? chosen.name : 'اختر...'}
        </span>
        <ChevronsUpDown size={12} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." className="h-7 text-xs" autoFocus />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(e => (
              <button key={e.id} onClick={() => { onChange(e.id); setOpen(false); setQ(''); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted transition-colors text-sm text-start">
                <Check size={13} className={e.id === value ? 'text-primary' : 'opacity-0'} />
                <span>{e.name}</span>
                {e.sponsorship_status === 'absconded' && (
                  <span className="mr-auto text-[10px] text-destructive">هروب</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">لا نتائج</p>}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Sort icon ─── */
const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 inline ms-1" />;
  if (sortDir === 'asc') return <ChevronUp size={11} className="text-primary inline ms-1" />;
  return <ChevronDown size={11} className="text-primary inline ms-1" />;
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const EmployeeTiers = () => {
  const { toast } = useToast();

  const [tiers, setTiers]       = useState<TierRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [apps, setApps]         = useState<AppRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir]   = useState<SortDir>(null);

  // Inline editing state — keyed by tier id
  const [editRows, setEditRows] = useState<Record<string, Partial<TierRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Add new row
  const [addingRow, setAddingRow] = useState(false);
  const [newRow, setNewRow] = useState<Partial<TierRow>>({
    sim_number: '', employee_id: '', package_type: '', renewal_date: '', delivery_status: STATUS_DELIVERED, app_ids: [],
  });
  const [savingNew, setSavingNew] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Absconded alert
  const [abscondedAlert, setAbscondedAlert] = useState<{ name: string; simNumber: string; vehiclePlate: string } | null>(null);

  /* ── Fetch ── */
  const fetchAll = async () => {
    setLoading(true);
    const [{ data: tiersData }, { data: empsData }, { data: appsData }] = await Promise.all([
      (supabase as any).from('employee_tiers').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name, sponsorship_status').order('name'),
      supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name'),
    ]);
    setEmployees((empsData || []) as Employee[]);
    setApps((appsData || []) as AppRow[]);
    if (tiersData) {
      setTiers((tiersData as any[]).map(t => ({
        ...t,
        app_ids: Array.isArray(t.app_ids) ? t.app_ids : (t.app_ids ? JSON.parse(t.app_ids) : []),
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── Watch for absconded employees and trigger alert ── */
  useEffect(() => {
    const checkAbsconded = async () => {
      const abscondedEmpIds = employees
        .filter(e => e.sponsorship_status === 'absconded')
        .map(e => e.id);

      if (abscondedEmpIds.length === 0) return;

      // Find tiers linked to absconded employees that are still "delivered"
      const affectedTiers = tiers.filter(
        t => abscondedEmpIds.includes(t.employee_id) && t.delivery_status === STATUS_DELIVERED
      );

      if (affectedTiers.length === 0) return;

      for (const tier of affectedTiers) {
        // Auto-update status to not_delivered
        await (supabase as any).from('employee_tiers')
          .update({ delivery_status: STATUS_NOT_DELIVERED })
          .eq('id', tier.id);

        // Get vehicle plate
        const emp = employees.find(e => e.id === tier.employee_id);
        const { data: assignments } = await supabase
          .from('vehicle_assignments')
          .select('vehicle_id, vehicles(plate_number)')
          .eq('employee_id', tier.employee_id)
          .is('end_date', null)
          .limit(1);

        const plate = (assignments?.[0] as any)?.vehicles?.plate_number || 'غير مسجلة';

        setAbscondedAlert({
          name: emp?.name || '—',
          simNumber: tier.sim_number || '—',
          vehiclePlate: plate,
        });
      }

      fetchAll();
    };

    if (employees.length > 0 && tiers.length > 0) checkAbsconded();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, tiers.length]);

  /* ── Inline edit helpers ── */
  const getRow = (tier: TierRow) => editRows[tier.id] ? { ...tier, ...editRows[tier.id] } : tier;

  const patchRow = (id: string, patch: Partial<TierRow>) =>
    setEditRows(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const isDirty = (tier: TierRow) => !!editRows[tier.id];

  const saveRow = async (tier: TierRow) => {
    const merged = { ...tier, ...editRows[tier.id] };
    if (!merged.employee_id) { toast({ title: 'خطأ', description: 'اختر مندوباً', variant: 'destructive' }); return; }
    setSavingId(tier.id);
    const { error } = await (supabase as any).from('employee_tiers').update({
      sim_number: merged.sim_number || null,
      employee_id: merged.employee_id,
      package_type: merged.package_type,
      renewal_date: merged.renewal_date,
      delivery_status: merged.delivery_status,
      app_ids: merged.app_ids,
    }).eq('id', tier.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: '✅ تم الحفظ' });
      setEditRows(prev => { const n = { ...prev }; delete n[tier.id]; return n; });
    }
    setSavingId(null);
    fetchAll();
  };

  const cancelRow = (id: string) =>
    setEditRows(prev => { const n = { ...prev }; delete n[id]; return n; });

  /* ── Add new row ── */
  const saveNew = async () => {
    if (!newRow.employee_id) { toast({ title: 'خطأ', description: 'اختر مندوباً', variant: 'destructive' }); return; }
    if (!newRow.renewal_date) { toast({ title: 'خطأ', description: 'أدخل تاريخ التجديد', variant: 'destructive' }); return; }
    setSavingNew(true);
    const { error } = await (supabase as any).from('employee_tiers').insert({
      sim_number: newRow.sim_number || null,
      employee_id: newRow.employee_id,
      package_type: newRow.package_type || '',
      renewal_date: newRow.renewal_date,
      delivery_status: newRow.delivery_status || STATUS_DELIVERED,
      app_ids: newRow.app_ids || [],
      start_date: new Date().toISOString().slice(0, 10),
    });
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); }
    else {
      toast({ title: '✅ تمت الإضافة' });
      setAddingRow(false);
      setNewRow({ sim_number: '', employee_id: '', package_type: '', renewal_date: '', delivery_status: STATUS_DELIVERED, app_ids: [] });
    }
    setSavingNew(false);
    fetchAll();
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!deleteId) return;
    await (supabase as any).from('employee_tiers').delete().eq('id', deleteId);
    toast({ title: 'تم الحذف' });
    setDeleteId(null);
    fetchAll();
  };

  /* ── Sort ── */
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else { setSortField(field); setSortDir('asc'); }
  };

  /* ── Filter + sort ── */
  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    employees.forEach(e => { m[e.id] = e; });
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    let list = tiers.filter(r => {
      const name = empMap[r.employee_id]?.name || '';
      const matchSearch = !search || (r.sim_number || '').includes(search) || name.includes(search);
      const matchStatus = statusFilter === 'all' || r.delivery_status === statusFilter;
      return matchSearch && matchStatus;
    });
    if (sortField && sortDir) {
      list = [...list].sort((a, b) => {
        let va = sortField === 'employee_name' ? (empMap[a.employee_id]?.name || '') : (a as any)[sortField] || '';
        let vb = sortField === 'employee_name' ? (empMap[b.employee_id]?.name || '') : (b as any)[sortField] || '';
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [tiers, search, statusFilter, sortField, sortDir, empMap]);

  /* ── Stats ── */
  const total      = tiers.length;
  const delivered  = tiers.filter(r => r.delivery_status === STATUS_DELIVERED).length;
  const notDelivered = tiers.filter(r => r.delivery_status === STATUS_NOT_DELIVERED).length;
  const renewingSoon = tiers.filter(r => {
    const days = differenceInDays(parseISO(r.renewal_date), new Date());
    return days >= 0 && days <= 30;
  }).length;

  const ThSort = ({ field, label }: { field: string; label: string }) => (
    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors border-b border-border/50 text-right"
      onClick={() => handleSort(field)}>
      {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  );

  /* ══════════════ RENDER ══════════════ */
  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>شرائح الشركة</span>
          </nav>
          <h1 className="page-title flex items-center gap-2"><Layers size={20} /> شرائح الشركة</h1>
        </div>
        <Button className="gap-2" onClick={() => setAddingRow(true)} disabled={addingRow}>
          <Plus size={15} /> إضافة شريحة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الشرائح', val: total, icon: <Layers size={17} className="text-primary" />, bg: 'bg-primary/10', color: 'text-foreground' },
          { label: 'مسلّمة', val: delivered, icon: <CheckCircle2 size={17} className="text-success" />, bg: 'bg-success/10', color: 'text-success' },
          { label: 'غير مسلّمة', val: notDelivered, icon: <AlertTriangle size={17} className="text-muted-foreground" />, bg: 'bg-muted', color: 'text-muted-foreground' },
          { label: 'تجديد قريب (≤30 يوم)', val: renewingSoon, icon: <Calendar size={17} className="text-warning" />, bg: 'bg-warning/10', color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border/50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.val}</p>
            </div>
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو رقم الشريحة..." className="pr-9 h-9 w-64" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {[{ v: 'all', l: 'الكل' }, { v: STATUS_DELIVERED, l: 'مسلّمة' }, { v: STATUS_NOT_DELIVERED, l: 'غير مسلّمة' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {s.l}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground mr-auto">{filtered.length} سجل</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" /> جارٍ التحميل...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <ThSort field="sim_number" label="رقم الشريحة" />
                  <ThSort field="employee_name" label="المندوب" />
                  <ThSort field="package_type" label="نوع الباقة" />
                  <ThSort field="renewal_date" label="تاريخ التجديد" />
                  <ThSort field="delivery_status" label="الحالة" />
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 text-right">المنصات</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-border/50 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {/* ── Add new row ── */}
                {addingRow && (
                  <tr className="border-b border-border/30 bg-primary/5">
                    {/* sim_number */}
                    <td className="px-2 py-2">
                      <Input
                        value={newRow.sim_number || ''}
                        onChange={e => setNewRow(p => ({ ...p, sim_number: e.target.value }))}
                        placeholder="رقم الشريحة"
                        className="h-8 text-xs w-32"
                        dir="ltr"
                      />
                    </td>
                    {/* employee */}
                    <td className="px-2 py-2">
                      <EmployeeSelect employees={employees} value={newRow.employee_id || ''} onChange={id => setNewRow(p => ({ ...p, employee_id: id }))} />
                    </td>
                    {/* package */}
                    <td className="px-2 py-2">
                      <Input
                        value={newRow.package_type || ''}
                        onChange={e => setNewRow(p => ({ ...p, package_type: e.target.value }))}
                        placeholder="نوع الباقة"
                        className="h-8 text-xs w-32"
                      />
                    </td>
                    {/* renewal_date */}
                    <td className="px-2 py-2">
                      <Input
                        type="date"
                        value={newRow.renewal_date || ''}
                        onChange={e => setNewRow(p => ({ ...p, renewal_date: e.target.value }))}
                        className="h-8 text-xs w-36"
                      />
                    </td>
                    {/* status */}
                    <td className="px-2 py-2">
                      <select
                        value={newRow.delivery_status || STATUS_DELIVERED}
                        onChange={e => setNewRow(p => ({ ...p, delivery_status: e.target.value }))}
                        className="h-8 text-xs rounded-lg border border-border/50 bg-background px-2 w-28"
                      >
                        <option value={STATUS_DELIVERED}>مسلّمة</option>
                        <option value={STATUS_NOT_DELIVERED}>غير مسلّمة</option>
                      </select>
                    </td>
                    {/* apps */}
                    <td className="px-2 py-2 min-w-[160px]">
                      <AppMultiSelect apps={apps} selected={newRow.app_ids || []} onChange={ids => setNewRow(p => ({ ...p, app_ids: ids }))} />
                    </td>
                    {/* actions */}
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" onClick={saveNew} disabled={savingNew} className="h-7 px-2 text-xs gap-1">
                          {savingNew ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          حفظ
                        </Button>
                        <button onClick={() => setAddingRow(false)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* ── Data rows ── */}
                {filtered.length === 0 && !addingRow ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Layers size={32} className="mx-auto opacity-20 mb-2" />
                      <p className="text-sm text-muted-foreground">لا توجد شرائح — أضف شريحة جديدة</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(tier => {
                    const row   = getRow(tier);
                    const dirty = isDirty(tier);
                    const emp   = empMap[row.employee_id];
                    const linkedApps = apps.filter(a => (row.app_ids || []).includes(a.id));

                    return (
                      <tr key={tier.id} className={`border-b border-border/30 hover:bg-muted/10 transition-colors ${dirty ? 'bg-primary/5' : ''}`}>
                        {/* sim_number */}
                        <td className="px-2 py-2">
                          <Input
                            value={row.sim_number || ''}
                            onChange={e => patchRow(tier.id, { sim_number: e.target.value })}
                            className="h-8 text-xs w-32 font-mono"
                            dir="ltr"
                            placeholder="—"
                          />
                        </td>

                        {/* employee */}
                        <td className="px-2 py-2">
                          <EmployeeSelect
                            employees={employees}
                            value={row.employee_id}
                            onChange={id => {
                              const e = employees.find(x => x.id === id);
                              const newStatus = e?.sponsorship_status === 'absconded' ? STATUS_NOT_DELIVERED : row.delivery_status;
                              patchRow(tier.id, { employee_id: id, delivery_status: newStatus });
                            }}
                          />
                        </td>

                        {/* package_type */}
                        <td className="px-2 py-2">
                          <Input
                            value={row.package_type || ''}
                            onChange={e => patchRow(tier.id, { package_type: e.target.value })}
                            className="h-8 text-xs w-32"
                            placeholder="نوع الباقة"
                          />
                        </td>

                        {/* renewal_date */}
                        <td className="px-2 py-2">
                          <div className="flex flex-col gap-0.5">
                            <Input
                              type="date"
                              value={row.renewal_date || ''}
                              onChange={e => patchRow(tier.id, { renewal_date: e.target.value })}
                              className="h-8 text-xs w-36"
                            />
                            {row.renewal_date && <RenewalBadge date={row.renewal_date} />}
                          </div>
                        </td>

                        {/* status */}
                        <td className="px-2 py-2">
                          <select
                            value={row.delivery_status}
                            onChange={e => patchRow(tier.id, { delivery_status: e.target.value })}
                            className={`h-8 text-xs rounded-lg border px-2 w-28 font-medium ${row.delivery_status === STATUS_DELIVERED ? 'border-success/30 bg-success/5 text-success' : 'border-border bg-muted text-muted-foreground'}`}
                          >
                            <option value={STATUS_DELIVERED}>مسلّمة</option>
                            <option value={STATUS_NOT_DELIVERED}>غير مسلّمة</option>
                          </select>
                        </td>

                        {/* apps */}
                        <td className="px-2 py-2 min-w-[160px]">
                          <AppMultiSelect
                            apps={apps}
                            selected={row.app_ids || []}
                            onChange={ids => patchRow(tier.id, { app_ids: ids })}
                          />
                        </td>

                        {/* actions */}
                        <td className="px-2 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {dirty ? (
                              <>
                                <Button size="sm" onClick={() => saveRow(tier)} disabled={savingId === tier.id} className="h-7 px-2 text-xs gap-1">
                                  {savingId === tier.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                  حفظ
                                </Button>
                                <button onClick={() => cancelRow(tier.id)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteId(tier.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="حذف">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Absconded alert ── */}
      <AlertDialog open={!!abscondedAlert} onOpenChange={() => setAbscondedAlert(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle size={18} /> تنبيه — مندوب هروب
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-1.5">
              <p>المندوب <strong>{abscondedAlert?.name}</strong> تم تسجيله كـ <strong>هروب</strong>.</p>
              <div className="bg-muted rounded-lg p-3 mt-2 space-y-1 text-foreground">
                <p>🔢 رقم الشريحة: <span className="font-mono font-semibold">{abscondedAlert?.simNumber}</span></p>
                <p>🚗 رقم المركبة الأخيرة: <span className="font-semibold">{abscondedAlert?.vehiclePlate}</span></p>
              </div>
              <p className="text-muted-foreground text-xs mt-2">تم تغيير حالة الشريحة تلقائياً إلى <strong>غير مسلّمة</strong>.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAbscondedAlert(null)}>حسناً، تم الاطلاع</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الشريحة</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا السجل؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeTiers;
