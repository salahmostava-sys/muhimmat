import { useState, useCallback, useRef } from 'react';
import { employees as mockEmployees, salarySchemes } from '@/data/mock';
import {
  Search, Plus, Upload, Download, FileDown, Eye, Edit, UserX, UserCheck,
  ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Check, X as XIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { differenceInDays, parseISO, format } from 'date-fns';
import EmployeeProfile from '@/components/employees/EmployeeProfile';
import AddEmployeeModal from '@/components/employees/AddEmployeeModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────
type SortField =
  | 'name' | 'national_id' | 'phone' | 'job_title' | 'email' | 'city'
  | 'join_date' | 'residency_expiry' | 'days_residency' | 'residency_status'
  | 'license_status' | 'sponsorship_status' | 'bank_account_number' | 'status';
type SortDir = 'asc' | 'desc' | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const calcResidency = (expiry?: string | null) => {
  if (!expiry) return { days: null, status: 'unknown' as const };
  const days = differenceInDays(parseISO(expiry), new Date());
  return { days, status: days >= 0 ? 'valid' : 'expired' };
};

const CityBadge = ({ city }: { city?: string | null }) => {
  if (!city) return <span className="text-muted-foreground/40">—</span>;
  return city === 'makkah'
    ? <span className="badge-info" style={{ background: 'hsl(var(--primary)/0.15)', color: 'hsl(270 60% 50%)' }}>مكة</span>
    : <span className="badge-info">جدة</span>;
};

const LicenseBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    has_license: { label: 'لديه رخصة', cls: 'badge-success' },
    no_license: { label: 'ليس لديه رخصة', cls: 'badge-urgent' },
    applied: { label: 'تم التقديم', cls: 'badge-warning' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

const SponsorBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    sponsored: { label: 'على الكفالة', cls: 'badge-info' },
    not_sponsored: { label: 'ليس على الكفالة', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
    absconded: { label: 'هروب', cls: 'badge-urgent' },
    terminated: { label: 'انتهاء الخدمة', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'نشط', cls: 'badge-success' },
    inactive: { label: 'موقوف', cls: 'badge-warning' },
    suspended: { label: 'موقوف', cls: 'badge-warning' },
    ended: { label: 'منتهي', cls: 'badge-urgent' },
    terminated: { label: 'منتهي', cls: 'badge-urgent' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

const DocIcons = ({ idUrl, licUrl, photoUrl }: { idUrl?: string | null; licUrl?: string | null; photoUrl?: string | null }) => (
  <div className="flex gap-1.5">
    <span title="صورة الهوية" className={idUrl ? 'text-success' : 'text-muted-foreground/30'}>🪪</span>
    <span title="صورة الرخصة" className={licUrl ? 'text-success' : 'text-muted-foreground/30'}>🚗</span>
    <span title="الصورة الشخصية" className={photoUrl ? 'text-success' : 'text-muted-foreground/30'}>📷</span>
  </div>
);

// ─── Inline Editable Cell ─────────────────────────────────────────────────────
interface InlineSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  renderDisplay: () => React.ReactNode;
}
const InlineSelect = ({ value, options, onSave, renderDisplay }: InlineSelectProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = async (v: string) => {
    setSaving(true);
    await onSave(v);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 1500);
  };

  if (saved) return <span className="text-success text-xs flex items-center gap-1"><Check size={12} /> تم</span>;
  if (saving) return <span className="text-muted-foreground text-xs">حفظ...</span>;

  if (editing) {
    return (
      <div className="relative" onClick={e => e.stopPropagation()}>
        <Select value={value} onValueChange={handleChange} open onOpenChange={o => !o && setEditing(false)}>
          <SelectTrigger className="h-7 text-xs w-36 bg-card border-primary/50 shadow-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer"
      onClick={() => setEditing(true)}
      title="انقر للتعديل"
    >
      {renderDisplay()}
      <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-opacity flex-shrink-0" />
    </div>
  );
};

// ─── Sort Icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={12} className="text-muted-foreground/40 inline ml-1" />;
  if (sortDir === 'asc') return <ChevronUp size={12} className="text-primary inline ml-1" />;
  return <ChevronDown size={12} className="text-primary inline ml-1" />;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Employees = () => {
  const { toast } = useToast();
  const [data, setData] = useState(mockEmployees);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salaryTypeFilter, setSalaryTypeFilter] = useState('all');
  const [residencyFilter, setResidencyFilter] = useState('all');
  const [appFilter, setAppFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField | null>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Sort handler ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else { setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Inline save ──
  const saveField = useCallback(async (id: string, field: string, value: string) => {
    setData(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
    try {
      await supabase.from('employees').update({ [field]: value }).eq('id', id);
    } catch {
      toast({ title: 'خطأ في الحفظ', variant: 'destructive' });
    }
  }, [toast]);

  // ── Filter + sort ──
  const appsList = ['هنقرستيشن', 'جاهز', 'كيتا', 'توبو', 'نينجا'];

  const filtered = data.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.phone || '').includes(q) || (e.nationalId || '').includes(q);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSalary = salaryTypeFilter === 'all' || e.salaryType === salaryTypeFilter;
    const matchApp = appFilter === 'all' || (e.apps || []).includes(appFilter);
    let matchRes = true;
    if (residencyFilter !== 'all' && e.residencyExpiry) {
      const days = differenceInDays(parseISO(e.residencyExpiry), new Date());
      if (residencyFilter === 'urgent') matchRes = days < 30;
      else if (residencyFilter === 'warning') matchRes = days >= 30 && days < 60;
      else if (residencyFilter === 'safe') matchRes = days >= 60;
    }
    return matchSearch && matchStatus && matchSalary && matchApp && matchRes;
  }).sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let va: any, vb: any;
    switch (sortField) {
      case 'name': va = a.name; vb = b.name; break;
      case 'national_id': va = a.nationalId || ''; vb = b.nationalId || ''; break;
      case 'phone': va = a.phone || ''; vb = b.phone || ''; break;
      case 'join_date': va = (a as any).join_date || ''; vb = (b as any).join_date || ''; break;
      case 'residency_expiry': va = a.residencyExpiry || ''; vb = b.residencyExpiry || ''; break;
      case 'days_residency': {
        va = a.residencyExpiry ? differenceInDays(parseISO(a.residencyExpiry), new Date()) : -9999;
        vb = b.residencyExpiry ? differenceInDays(parseISO(b.residencyExpiry), new Date()) : -9999;
        break;
      }
      case 'status': va = a.status; vb = b.status; break;
      case 'license_status': va = (a as any).license_status || ''; vb = (b as any).license_status || ''; break;
      case 'sponsorship_status': va = (a as any).sponsorship_status || ''; vb = (b as any).sponsorship_status || ''; break;
      case 'city': va = (a as any).city || ''; vb = (b as any).city || ''; break;
      default: va = (a as any)[sortField] || ''; vb = (b as any)[sortField] || '';
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Export ──
  const handleExport = () => {
    const rows = filtered.map(e => {
      const { days, status } = calcResidency(e.residencyExpiry);
      return {
        'الاسم': e.name,
        'المسمى الوظيفي': (e as any).job_title || '',
        'رقم الهوية': e.nationalId || '',
        'رقم الهاتف': e.phone || '',
        'البريد الإلكتروني': e.email || '',
        'المدينة': (e as any).city === 'makkah' ? 'مكة' : (e as any).city === 'jeddah' ? 'جدة' : '',
        'تاريخ الانضمام': (e as any).join_date || '',
        'تاريخ انتهاء الإقامة': e.residencyExpiry || '',
        'المتبقي (يوم)': days ?? '',
        'حالة الإقامة': status === 'valid' ? 'صالحة' : status === 'expired' ? 'منتهية' : '',
        'حالة الرخصة': { has_license: 'لديه رخصة', no_license: 'ليس لديه رخصة', applied: 'تم التقديم' }[(e as any).license_status] || '',
        'حالة الكفالة': { sponsored: 'على الكفالة', not_sponsored: 'ليس على الكفالة', absconded: 'هروب', terminated: 'انتهاء الخدمة' }[(e as any).sponsorship_status] || '',
        'رقم الحساب البنكي': (e as any).bank_account_number || '',
        'نوع الراتب': e.salaryType === 'orders' ? 'طلبات' : 'ثابت',
        'الحالة': { active: 'نشط', inactive: 'موقوف', suspended: 'موقوف', ended: 'منتهي', terminated: 'منتهي' }[e.status] || e.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المناديب');
    XLSX.writeFile(wb, `بيانات_المناديب_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // ── Download template ──
  const handleTemplate = () => {
    const headers = [['الاسم', 'المسمى الوظيفي', 'رقم الهوية', 'رقم الهاتف', 'البريد الإلكتروني',
      'المدينة (makkah/jeddah)', 'تاريخ الانضمام', 'تاريخ انتهاء الإقامة',
      'حالة الرخصة (has_license/no_license/applied)',
      'حالة الكفالة (sponsored/not_sponsored/absconded/terminated)',
      'رقم الحساب البنكي', 'نوع الراتب (orders/shift)', 'الحالة (active/inactive/ended)']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'قالب_استيراد_المناديب.xlsx');
  };

  // ── Th helper ──
  const Th = ({ field, label, sortable = true }: { field?: SortField; label: string; sortable?: boolean }) => (
    <th
      className={`text-right px-3 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap select-none ${sortable && field ? 'cursor-pointer hover:text-foreground' : ''}`}
      onClick={sortable && field ? () => handleSort(field) : undefined}
    >
      {label}
      {sortable && field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
    </th>
  );

  if (selectedEmployee) {
    const emp = mockEmployees.find(e => e.id === selectedEmployee);
    if (emp) return <EmployeeProfile employee={emp} onBack={() => setSelectedEmployee(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الموظفون</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} من {data.length} مندوب مسجل</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <Plus size={16} /> إضافة مندوب
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()}>
            <Upload size={15} /> استيراد Excel
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" />
          <Button variant="outline" className="gap-2" onClick={handleTemplate}>
            <FileDown size={15} /> تحميل قالب
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download size={15} /> تصدير Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم، الهاتف، الهوية..." className="pr-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">موقوف</SelectItem>
            <SelectItem value="ended">منتهي</SelectItem>
          </SelectContent>
        </Select>
        <Select value={salaryTypeFilter} onValueChange={setSalaryTypeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="نوع الراتب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="orders">طلبات</SelectItem>
            <SelectItem value="shift">دوام</SelectItem>
          </SelectContent>
        </Select>
        <Select value={residencyFilter} onValueChange={setResidencyFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="الإقامة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الإقامات</SelectItem>
            <SelectItem value="urgent">🔴 عاجل &lt;30 يوم</SelectItem>
            <SelectItem value="warning">🟠 تحذير &lt;60 يوم</SelectItem>
            <SelectItem value="safe">🟢 آمن</SelectItem>
          </SelectContent>
        </Select>
        <Select value={appFilter} onValueChange={setAppFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="التطبيق" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل التطبيقات</SelectItem>
            {appsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || salaryTypeFilter !== 'all' || residencyFilter !== 'all' || appFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSalaryTypeFilter('all'); setResidencyFilter('all'); setAppFilter('all'); }}>
            مسح الكل
          </Button>
        )}
        <span className="text-xs text-muted-foreground mr-auto">{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-scroll">
          <table className="w-full min-w-[1400px]">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <Th label="الصورة" sortable={false} />
                <Th field="name" label="الاسم" />
                <Th field="national_id" label="رقم الهوية" />
                <Th field="phone" label="رقم الهاتف" />
                <Th field="job_title" label="المسمى الوظيفي" />
                <Th field="email" label="البريد الإلكتروني" />
                <Th field="city" label="المدينة" />
                <Th field="join_date" label="تاريخ الانضمام" />
                <Th field="residency_expiry" label="انتهاء الإقامة" />
                <Th field="days_residency" label="المتبقي (أيام)" />
                <Th field="residency_status" label="حالة الإقامة" />
                <Th field="license_status" label="الرخصة" />
                <Th field="sponsorship_status" label="الكفالة" />
                <Th field="bank_account_number" label="رقم الحساب" />
                <Th label="المستندات" sortable={false} />
                <Th field="status" label="الحالة" />
                <Th label="إجراءات" sortable={false} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={17} className="text-center py-12 text-muted-foreground">لا يوجد موظفون مطابقون</td></tr>
              ) : filtered.map(emp => {
                const res = calcResidency(emp.residencyExpiry);
                const daysColor = res.days === null ? '' : res.days > 60 ? 'text-success' : res.days > 0 ? 'text-warning' : 'text-destructive font-bold';
                const daysLabel = res.days === null ? '—' : res.days < 0 ? `${res.days} يوم` : `${res.days} يوم`;
                const initial = emp.name.charAt(0);
                const photoUrl = (emp as any).personal_photo_url;

                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    {/* صورة */}
                    <td className="px-3 py-2.5">
                      {photoUrl
                        ? <img src={photoUrl} className="w-9 h-9 rounded-full object-cover" alt="" />
                        : <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{initial}</div>
                      }
                    </td>
                    {/* الاسم */}
                    <td className="px-3 py-2.5">
                      <button onClick={() => setSelectedEmployee(emp.id)} className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-right">
                        {emp.name}
                      </button>
                    </td>
                    {/* رقم الهوية */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground font-mono" dir="ltr">{emp.nationalId || '—'}</td>
                    {/* الهاتف */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground" dir="ltr">{emp.phone || '—'}</td>
                    {/* المسمى */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{(emp as any).job_title || '—'}</td>
                    {/* البريد */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground" dir="ltr">{emp.email || '—'}</td>
                    {/* المدينة - inline */}
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={(emp as any).city || ''}
                        options={[{ value: 'makkah', label: 'مكة' }, { value: 'jeddah', label: 'جدة' }]}
                        onSave={v => saveField(emp.id, 'city', v)}
                        renderDisplay={() => <CityBadge city={(emp as any).city} />}
                      />
                    </td>
                    {/* تاريخ الانضمام */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{(emp as any).join_date ? format(parseISO((emp as any).join_date), 'yyyy/MM/dd') : '—'}</td>
                    {/* انتهاء الإقامة */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{emp.residencyExpiry ? format(parseISO(emp.residencyExpiry), 'yyyy/MM/dd') : '—'}</td>
                    {/* المتبقي */}
                    <td className={`px-3 py-2.5 text-sm font-medium ${daysColor}`}>{daysLabel}</td>
                    {/* حالة الإقامة */}
                    <td className="px-3 py-2.5">
                      {res.status === 'valid'
                        ? <span className="badge-success">صالحة</span>
                        : res.status === 'expired'
                        ? <span className="badge-urgent">منتهية</span>
                        : <span className="text-muted-foreground/40">—</span>
                      }
                    </td>
                    {/* الرخصة - inline */}
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={(emp as any).license_status || 'no_license'}
                        options={[
                          { value: 'has_license', label: 'لديه رخصة' },
                          { value: 'no_license', label: 'ليس لديه رخصة' },
                          { value: 'applied', label: 'تم التقديم عليها' },
                        ]}
                        onSave={v => saveField(emp.id, 'license_status', v)}
                        renderDisplay={() => <LicenseBadge status={(emp as any).license_status} />}
                      />
                    </td>
                    {/* الكفالة - inline */}
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={(emp as any).sponsorship_status || 'not_sponsored'}
                        options={[
                          { value: 'sponsored', label: 'على الكفالة' },
                          { value: 'not_sponsored', label: 'ليس على الكفالة' },
                          { value: 'absconded', label: 'هروب' },
                          { value: 'terminated', label: 'انتهاء الخدمة' },
                        ]}
                        onSave={v => saveField(emp.id, 'sponsorship_status', v)}
                        renderDisplay={() => <SponsorBadge status={(emp as any).sponsorship_status} />}
                      />
                    </td>
                    {/* رقم الحساب */}
                    <td className="px-3 py-2.5 text-sm text-muted-foreground font-mono" dir="ltr">{(emp as any).bank_account_number || '—'}</td>
                    {/* المستندات */}
                    <td className="px-3 py-2.5">
                      <DocIcons idUrl={(emp as any).id_photo_url} licUrl={(emp as any).license_photo_url} photoUrl={(emp as any).personal_photo_url} />
                    </td>
                    {/* الحالة - inline */}
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={emp.status}
                        options={[
                          { value: 'active', label: 'نشط' },
                          { value: 'inactive', label: 'موقوف' },
                          { value: 'ended', label: 'منتهي' },
                        ]}
                        onSave={v => saveField(emp.id, 'status', v)}
                        renderDisplay={() => <StatusBadge status={emp.status} />}
                      />
                    </td>
                    {/* إجراءات */}
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="عرض">
                          <Eye size={15} />
                        </button>
                        <button onClick={() => setShowAddModal(true)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="تعديل">
                          <Edit size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && <AddEmployeeModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
};

export default Employees;
