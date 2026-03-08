import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search, Plus, Upload, Download, Eye, Edit,
  ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Check, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { differenceInDays, parseISO, format } from 'date-fns';
import EmployeeProfile from '@/components/employees/EmployeeProfile';
import AddEmployeeModal from '@/components/employees/AddEmployeeModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ───────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  bank_account_number?: string | null;
  city?: string | null;
  join_date?: string | null;
  residency_expiry?: string | null;
  license_status?: string | null;
  sponsorship_status?: string | null;
  id_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
};

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
  const { t } = useTranslation();
  if (!city) return <span className="text-muted-foreground/40">—</span>;
  return city === 'makkah'
    ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground">{t('makkah')}</span>
    : <span className="badge-info">{t('jeddah')}</span>;
};

const LicenseBadge = ({ status }: { status?: string | null }) => {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { labelKey: string; cls: string }> = {
    has_license: { labelKey: 'hasLicense', cls: 'badge-success' },
    no_license: { labelKey: 'noLicense', cls: 'badge-urgent' },
    applied: { labelKey: 'applied', cls: 'badge-warning' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{t(m.labelKey)}</span> : null;
};

const SponsorBadge = ({ status }: { status?: string | null }) => {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { labelKey: string; cls: string }> = {
    sponsored: { labelKey: 'sponsored', cls: 'badge-info' },
    not_sponsored: { labelKey: 'notSponsored', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
    absconded: { labelKey: 'absconded', cls: 'badge-urgent' },
    terminated: { labelKey: 'terminated', cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{t(m.labelKey)}</span> : null;
};

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  const map: Record<string, { labelKey: string; cls: string }> = {
    active: { labelKey: 'active', cls: 'badge-success' },
    inactive: { labelKey: 'inactive', cls: 'badge-warning' },
    ended: { labelKey: 'ended', cls: 'badge-urgent' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{t(m.labelKey)}</span> : null;
};

const DocIcons = ({ idUrl, licUrl, photoUrl }: { idUrl?: string | null; licUrl?: string | null; photoUrl?: string | null }) => {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1.5">
      <span title={t('nationalId')} className={idUrl ? 'text-success' : 'text-muted-foreground/30'}>🪪</span>
      <span title={t('licenseStatus')} className={licUrl ? 'text-success' : 'text-muted-foreground/30'}>🚗</span>
      <span title={t('photo')} className={photoUrl ? 'text-success' : 'text-muted-foreground/30'}>📷</span>
    </div>
  );
};

// ─── Inline Editable Cell ─────────────────────────────────────────────────────
interface InlineSelectProps {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => Promise<void>;
  renderDisplay: () => React.ReactNode;
}
const InlineSelect = ({ value, options, onSave, renderDisplay }: InlineSelectProps) => {
  const { t } = useTranslation();
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

  if (saved) return <span className="text-success text-xs flex items-center gap-1"><Check size={12} /> {t('saved')}</span>;
  if (saving) return <span className="text-muted-foreground text-xs">{t('saving')}</span>;

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
      title={t('clickToEdit')}
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

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="border-b border-border/30">
    {Array.from({ length: 17 }).map((_, i) => (
      <td key={i} className="px-3 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Employees = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { permissions } = usePermissions('employees');
  const [data, setData] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salaryTypeFilter, setSalaryTypeFilter] = useState('all');
  const [residencyFilter, setResidencyFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField | null>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── Fetch from Supabase ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });
    if (!error && rows) setData(rows as Employee[]);
    else if (error) toast({ title: t('errorLoading'), description: error.message, variant: 'destructive' });
    setLoading(false);
  }, [toast, t]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ── Sort handler ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Inline save with optimistic update ──
  const saveField = useCallback(async (id: string, field: string, value: string) => {
    const prev = data.find(e => e.id === id);
    setData(prev2 => prev2.map(e => e.id === id ? { ...e, [field]: value } : e));
    const { error } = await supabase.from('employees').update({ [field]: value }).eq('id', id);
    if (error) {
      setData(prev2 => prev2.map(e => e.id === id ? { ...e, [field]: (prev as any)?.[field] } : e));
      toast({ title: t('errorSaving'), description: error.message, variant: 'destructive' });
    }
  }, [data, toast, t]);

  // ── Filter + sort ──
  const filtered = data.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.phone || '').includes(q) || (e.national_id || '').includes(q);
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSalary = salaryTypeFilter === 'all' || e.salary_type === salaryTypeFilter;
    let matchRes = true;
    if (residencyFilter !== 'all' && e.residency_expiry) {
      const days = differenceInDays(parseISO(e.residency_expiry), new Date());
      if (residencyFilter === 'urgent') matchRes = days < 30;
      else if (residencyFilter === 'warning') matchRes = days >= 30 && days < 60;
      else if (residencyFilter === 'safe') matchRes = days >= 60;
    }
    return matchSearch && matchStatus && matchSalary && matchRes;
  }).sort((a, b) => {
    if (!sortField || !sortDir) return 0;
    let va: any, vb: any;
    switch (sortField) {
      case 'name': va = a.name; vb = b.name; break;
      case 'national_id': va = a.national_id || ''; vb = b.national_id || ''; break;
      case 'phone': va = a.phone || ''; vb = b.phone || ''; break;
      case 'job_title': va = a.job_title || ''; vb = b.job_title || ''; break;
      case 'email': va = a.email || ''; vb = b.email || ''; break;
      case 'join_date': va = a.join_date || ''; vb = b.join_date || ''; break;
      case 'residency_expiry': va = a.residency_expiry || ''; vb = b.residency_expiry || ''; break;
      case 'days_residency': {
        va = a.residency_expiry ? differenceInDays(parseISO(a.residency_expiry), new Date()) : -9999;
        vb = b.residency_expiry ? differenceInDays(parseISO(b.residency_expiry), new Date()) : -9999;
        break;
      }
      case 'status': va = a.status; vb = b.status; break;
      case 'license_status': va = a.license_status || ''; vb = b.license_status || ''; break;
      case 'sponsorship_status': va = a.sponsorship_status || ''; vb = b.sponsorship_status || ''; break;
      case 'city': va = a.city || ''; vb = b.city || ''; break;
      case 'bank_account_number': va = a.bank_account_number || ''; vb = b.bank_account_number || ''; break;
      default: va = (a as any)[sortField] || ''; vb = (b as any)[sortField] || '';
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // ── Export ──
  const handleExport = () => {
    const rows = filtered.map(e => {
      const { days, status } = calcResidency(e.residency_expiry);
      return {
        [t('name')]: e.name,
        [t('jobTitle')]: e.job_title || '',
        [t('nationalId')]: e.national_id || '',
        [t('phone')]: e.phone || '',
        [t('email')]: e.email || '',
        [t('city')]: e.city === 'makkah' ? t('makkah') : e.city === 'jeddah' ? t('jeddah') : '',
        [t('joinDate')]: e.join_date || '',
        [t('residencyExpiry')]: e.residency_expiry || '',
        [t('residencyDays')]: days ?? '',
        [t('residencyStatus')]: status === 'valid' ? t('residencyValid') : status === 'expired' ? t('residencyExpired') : '',
        [t('licenseStatus')]: { has_license: t('hasLicense'), no_license: t('noLicense'), applied: t('applied') }[e.license_status || ''] || '',
        [t('sponsorshipStatus')]: { sponsored: t('sponsored'), not_sponsored: t('notSponsored'), absconded: t('absconded'), terminated: t('terminated') }[e.sponsorship_status || ''] || '',
        [t('bankAccount')]: e.bank_account_number || '',
        [t('salaryType')]: e.salary_type === 'orders' ? t('byOrders') : t('shift'),
        [t('status')]: { active: t('active'), inactive: t('inactive'), ended: t('ended') }[e.status] || e.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('employees'));
    XLSX.writeFile(wb, `employees_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleTemplate = () => {
    const headers = [[t('name'), t('jobTitle'), t('nationalId'), t('phone'), t('email'),
      'city (makkah/jeddah)', t('joinDate'), t('residencyExpiry'),
      'license_status (has_license/no_license/applied)',
      'sponsorship_status (sponsored/not_sponsored/absconded/terminated)',
      t('bankAccount'), 'salary_type (orders/shift)', 'status (active/inactive/ended)']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('template'));
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  // ── Th helper ──
  const Th = ({ field, label, sortable = true }: { field?: SortField; label: string; sortable?: boolean }) => (
    <th
      className={`ta-th select-none ${sortable && field ? 'cursor-pointer hover:text-foreground' : ''}`}
      onClick={sortable && field ? () => handleSort(field) : undefined}
    >
      {label}
      {sortable && field && <SortIcon field={field} sortField={sortField} sortDir={sortDir} />}
    </th>
  );

  // ── Profile view ──
  if (selectedEmployee) {
    const emp = data.find(e => e.id === selectedEmployee);
    if (emp) return <EmployeeProfile employee={emp as any} onBack={() => setSelectedEmployee(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="page-header mb-0">
          <div className="page-breadcrumb">
            <span>{t('hr')}</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">{t('employees')}</span>
          </div>
          <h1 className="page-title">{t('employees')}</h1>
          <p className="page-subtitle">{filtered.length} {t('results')} / {data.length} {t('registeredEmployees')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => { setEditEmployee(null); setShowAddModal(true); }} className="gap-2">
            <Plus size={16} /> {t('addEmployee')}
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => importRef.current?.click()}>
            <Upload size={15} /> {t('importExcel')}
          </Button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2"><Download size={15} /> 📥 {t('downloadReport')} ▾</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 {t('exportExcel')}</DropdownMenuItem>
              <DropdownMenuItem onClick={handleTemplate}>📋 {t('downloadTemplate')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="ps-9 h-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder={t('status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="inactive">{t('inactive')}</SelectItem>
            <SelectItem value="ended">{t('ended')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={salaryTypeFilter} onValueChange={setSalaryTypeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder={t('salaryType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="orders">{t('byOrders')}</SelectItem>
            <SelectItem value="shift">{t('shift')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={residencyFilter} onValueChange={setResidencyFilter}>
          <SelectTrigger className="w-40 h-9"><SelectValue placeholder={t('residencyStatus')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allResidencies')}</SelectItem>
            <SelectItem value="urgent">{t('residencyUrgent')}</SelectItem>
            <SelectItem value="warning">{t('residencyWarning')}</SelectItem>
            <SelectItem value="safe">{t('residencySafe')}</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || salaryTypeFilter !== 'all' || residencyFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setSalaryTypeFilter('all'); setResidencyFilter('all'); }}>
            {t('clearAll')}
          </Button>
        )}
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} {t('results')}</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-scroll">
          <table className="w-full min-w-[1400px]">
            <thead className="ta-thead">
              <tr>
                <Th label={t('photo')} sortable={false} />
                <Th field="name" label={t('name')} />
                <Th field="national_id" label={t('nationalId')} />
                <Th field="phone" label={t('phone')} />
                <Th field="job_title" label={t('jobTitle')} />
                <Th field="email" label={t('email')} />
                <Th field="city" label={t('city')} />
                <Th field="join_date" label={t('joinDate')} />
                <Th field="residency_expiry" label={t('residencyExpiry')} />
                <Th field="days_residency" label={t('residencyDays')} />
                <Th field="residency_status" label={t('residencyStatus')} />
                <Th field="license_status" label={t('licenseStatus')} />
                <Th field="sponsorship_status" label={t('sponsorshipStatus')} />
                <Th field="bank_account_number" label={t('bankAccount')} />
                <Th label={t('documents')} sortable={false} />
                <Th field="status" label={t('status')} />
                <Th label={t('actions')} sortable={false} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={17} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <span className="text-4xl">👥</span>
                      <p className="font-medium">{t('noEmployees')}</p>
                      <p className="text-xs">{t('noEmployeesHint')}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(emp => {
                const res = calcResidency(emp.residency_expiry);
                const daysColor = res.days === null ? '' : res.days > 60 ? 'text-success' : res.days > 0 ? 'text-warning' : 'text-destructive font-bold';
                const daysLabel = res.days === null ? '—' : `${res.days} ${t('residencyDays').split('(')[0].trim()}`;
                const initial = emp.name.charAt(0);

                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      {emp.personal_photo_url
                        ? <img src={emp.personal_photo_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                        : <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">{initial}</div>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setSelectedEmployee(emp.id)} className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-start">
                        {emp.name}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground font-mono" dir="ltr">{emp.national_id || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground" dir="ltr">{emp.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{emp.job_title || '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground" dir="ltr">{emp.email || '—'}</td>
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={emp.city || ''}
                        options={[{ value: 'makkah', label: t('makkah') }, { value: 'jeddah', label: t('jeddah') }]}
                        onSave={v => saveField(emp.id, 'city', v)}
                        renderDisplay={() => <CityBadge city={emp.city} />}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{emp.join_date ? format(parseISO(emp.join_date), 'yyyy/MM/dd') : '—'}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{emp.residency_expiry ? format(parseISO(emp.residency_expiry), 'yyyy/MM/dd') : '—'}</td>
                    <td className={`px-3 py-2.5 text-sm font-medium ${daysColor}`}>{res.days === null ? '—' : `${res.days}`}</td>
                    <td className="px-3 py-2.5">
                      {res.status === 'valid'
                        ? <span className="badge-success">{t('residencyValid')}</span>
                        : res.status === 'expired'
                        ? <span className="badge-urgent">{t('residencyExpired')}</span>
                        : <span className="text-muted-foreground/40">—</span>
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={emp.license_status || 'no_license'}
                        options={[
                          { value: 'has_license', label: t('hasLicense') },
                          { value: 'no_license', label: t('noLicense') },
                          { value: 'applied', label: t('applied') },
                        ]}
                        onSave={v => saveField(emp.id, 'license_status', v)}
                        renderDisplay={() => <LicenseBadge status={emp.license_status} />}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={emp.sponsorship_status || 'not_sponsored'}
                        options={[
                          { value: 'sponsored', label: t('sponsored') },
                          { value: 'not_sponsored', label: t('notSponsored') },
                          { value: 'absconded', label: t('absconded') },
                          { value: 'terminated', label: t('terminated') },
                        ]}
                        onSave={v => saveField(emp.id, 'sponsorship_status', v)}
                        renderDisplay={() => <SponsorBadge status={emp.sponsorship_status} />}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground font-mono" dir="ltr">{emp.bank_account_number || '—'}</td>
                    <td className="px-3 py-2.5">
                      <DocIcons idUrl={emp.id_photo_url} licUrl={emp.license_photo_url} photoUrl={emp.personal_photo_url} />
                    </td>
                    <td className="px-3 py-2.5">
                      <InlineSelect
                        value={emp.status}
                        options={[
                          { value: 'active', label: t('active') },
                          { value: 'inactive', label: t('inactive') },
                          { value: 'ended', label: t('ended') },
                        ]}
                        onSave={v => saveField(emp.id, 'status', v)}
                        renderDisplay={() => <StatusBadge status={emp.status} />}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => setSelectedEmployee(emp.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={t('view')}>
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => { setEditEmployee(emp); setShowAddModal(true); }}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title={t('edit')}
                        >
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

      {showAddModal && (
        <AddEmployeeModal
          onClose={() => { setShowAddModal(false); setEditEmployee(null); }}
          editEmployee={editEmployee}
          onSuccess={() => {
            fetchEmployees();
            setShowAddModal(false);
            setEditEmployee(null);
          }}
        />
      )}
    </div>
  );
};

export default Employees;
