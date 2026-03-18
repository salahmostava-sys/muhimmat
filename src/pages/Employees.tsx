import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Download, Eye, Edit, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Check, Loader2,
  Columns, Filter, X, ChevronDown as FilterIcon, Building2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/context/LanguageContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { differenceInDays, parseISO, format } from 'date-fns';
import EmployeeProfile from '@/components/employees/EmployeeProfile';
import AddEmployeeModal from '@/components/employees/AddEmployeeModal';
import ImportEmployeesModal from '@/components/employees/ImportEmployeesModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────
type Employee = {
  id: string;
  name: string;
  job_title?: string | null;
  phone?: string | null;
  email?: string | null;
  national_id?: string | null;
  employee_code?: string | null;
  bank_account_number?: string | null;
  city?: string | null;
  join_date?: string | null;
  birth_date?: string | null;
  residency_expiry?: string | null;
  probation_end_date?: string | null;
  license_status?: string | null;
  sponsorship_status?: string | null;
  id_photo_url?: string | null;
  license_photo_url?: string | null;
  personal_photo_url?: string | null;
  status: string;
  salary_type: string;
  base_salary: number;
  nationality?: string | null;
  preferred_language?: string | null;
  trade_register?: { id: string; name: string } | null;
};

type SortField = keyof Employee | 'days_residency' | 'residency_status';
type SortDir = 'asc' | 'desc' | null;

// ─── Column definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'seq',                  label: '#',                    sortable: false },
  { key: 'name',                 label: 'الاسم',                sortable: true  },
  { key: 'national_id',          label: 'رقم الهوية',           sortable: true  },
  { key: 'job_title',            label: 'المسمى الوظيفي',       sortable: true  },
  { key: 'city',                 label: 'المدينة',              sortable: true  },
  { key: 'phone',                label: 'رقم الهاتف',           sortable: true  },
  { key: 'nationality',          label: 'الجنسية',              sortable: true  },
  { key: 'sponsorship_status',   label: 'حالة الكفالة',         sortable: true  },
  { key: 'trade_register',       label: 'السجل التجاري',        sortable: true  },
  { key: 'join_date',            label: 'تاريخ الانضمام',       sortable: true  },
  { key: 'birth_date',           label: 'تاريخ الميلاد',        sortable: true  },
  { key: 'probation_end_date',   label: 'انتهاء فترة التجربة',  sortable: true  },
  { key: 'residency_expiry',     label: 'انتهاء الإقامة',       sortable: true  },
  { key: 'days_residency',       label: 'المتبقي (يوم)',        sortable: true  },
  { key: 'residency_status',     label: 'حالة الإقامة',         sortable: false },
  { key: 'license_status',       label: 'حالة الرخصة',          sortable: true  },
  { key: 'bank_account_number',  label: 'رقم الحساب البنكي',   sortable: false },
  { key: 'email',                label: 'البريد الإلكتروني',    sortable: false },
  { key: 'actions',              label: 'الإجراءات',            sortable: false },
] as const;

type ColKey = typeof ALL_COLUMNS[number]['key'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const calcResidency = (expiry?: string | null) => {
  if (!expiry) return { days: null as null | number, status: 'unknown' as const };
  const days = differenceInDays(parseISO(expiry), new Date());
  return { days, status: (days >= 0 ? 'valid' : 'expired') as 'valid' | 'expired' };
};

// ─── Badges ───────────────────────────────────────────────────────────────────
const CityBadge = ({ city }: { city?: string | null }) => {
  if (!city) return <span className="text-muted-foreground/40">—</span>;
  return city === 'makkah'
    ? <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground">مكة</span>
    : <span className="badge-info">جدة</span>;
};

const LicenseBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    has_license: { label: 'لديه رخصة',      cls: 'badge-success' },
    no_license:  { label: 'ليس لديه رخصة',  cls: 'badge-urgent'  },
    applied:     { label: 'تم التقديم',      cls: 'badge-warning' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

const SponsorBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    sponsored:     { label: 'على الكفالة',       cls: 'badge-info'    },
    not_sponsored: { label: 'ليس على الكفالة',   cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
    absconded:     { label: 'هروب',              cls: 'badge-urgent'  },
    terminated:    { label: 'انتهاء الخدمة',     cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

// ─── Inline Select ────────────────────────────────────────────────────────────
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

  if (saved)   return <span className="text-success text-xs flex items-center gap-1"><Check size={12} /> تم</span>;
  if (saving)  return <span className="text-muted-foreground text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> ...</span>;

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
    <div className="group flex items-center gap-1 cursor-pointer" onClick={() => setEditing(true)} title="اضغط للتعديل">
      {renderDisplay()}
      <Pencil size={10} className="text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-opacity flex-shrink-0" />
    </div>
  );
};

// ─── Sort Icon ────────────────────────────────────────────────────────────────
const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 inline ms-1" />;
  if (sortDir === 'asc')   return <ChevronUp size={11} className="text-primary inline ms-1" />;
  return <ChevronDown size={11} className="text-primary inline ms-1" />;
};

// ─── Column Filter Popover ────────────────────────────────────────────────────
interface ColFilterPopoverProps {
  colKey: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  onClear: () => void;
}
const ColFilterPopover = ({ colKey, label, active, children, onClear }: ColFilterPopoverProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-0.5 rounded transition-colors hover:text-primary ${active ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
          title={`فلترة ${label}`}
          onClick={e => e.stopPropagation()}
        >
          <FilterIcon size={10} className={active ? 'text-primary' : ''} />
          {active && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-3 space-y-2"
        align="start"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {active && (
            <button onClick={() => { onClear(); setOpen(false); }} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <X size={10} /> مسح
            </button>
          )}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
};

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-border/30">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Employees = () => {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const { permissions } = usePermissions('employees');

  const [data, setData]       = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string | null>('name');
  const [sortDir, setSortDir]     = useState<SortDir>('asc');

  // visible columns
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(
    new Set(ALL_COLUMNS.map(c => c.key))
  );

  // per-column filters
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // trade registers
  const [tradeRegisters, setTradeRegisters] = useState<{ id: string; name: string; cr_number?: string | null }[]>([]);
  // inline trade register assignment dialog
  const [tradeAssignEmp, setTradeAssignEmp] = useState<Employee | null>(null);
  const [tradeAssignVal, setTradeAssignVal] = useState<string>('');
  const [tradeSaving, setTradeSaving] = useState(false);

  // modals
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAddModal, setShowAddModal]     = useState(false);
  const [editEmployee, setEditEmployee]     = useState<Employee | null>(null);
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
  const [deleting, setDeleting]             = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // ── Fetch trade registers ──
  useEffect(() => {
    supabase.from('trade_registers').select('id, name, cr_number').order('name').then(({ data: tr }) => {
      if (tr) setTradeRegisters(tr);
    });
  }, []);

  // ── Fetch employees ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('employees')
      .select('*, trade_registers(id, name)')
      .order('name', { ascending: true });
    if (!error && rows) {
      setData(rows.map(r => ({
        ...r,
        trade_register: (r as any).trade_registers ?? null,
      })) as Employee[]);
    } else if (error) {
      toast({ title: 'خطأ في تحميل البيانات', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  // ── Assign / unassign trade register ──
  const handleTradeAssign = async () => {
    if (!tradeAssignEmp) return;
    setTradeSaving(true);
    const newVal = tradeAssignVal === '__none__' ? null : tradeAssignVal;
    const { error } = await supabase.from('employees').update({ trade_register_id: newVal }).eq('id', tradeAssignEmp.id);
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
    } else {
      const reg = tradeRegisters.find(r => r.id === newVal) ?? null;
      setData(d => d.map(e => e.id === tradeAssignEmp.id ? { ...e, trade_register: reg ? { id: reg.id, name: reg.name } : null } : e));
      toast({ title: '✅ تم تحديث السجل التجاري' });
      setTradeAssignEmp(null);
    }
    setTradeSaving(false);
  };

  // ── Sort handler ──
  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Inline save ──
  const saveField = useCallback(async (id: string, field: string, value: string) => {
    const prev = data.find(e => e.id === id);
    setData(d => d.map(e => e.id === id ? { ...e, [field]: value } : e));
    const { error } = await supabase.from('employees').update({ [field]: value }).eq('id', id);
    if (error) {
      setData(d => d.map(e => e.id === id ? { ...e, [field]: (prev as any)?.[field] } : e));
      toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    }
  }, [data, toast]);

  // ── Delete ──
  const handleDelete = useCallback(async () => {
    if (!deleteEmployee) return;
    setDeleting(true);
    const { error } = await supabase.from('employees').delete().eq('id', deleteEmployee.id);
    if (error) {
      toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
    } else {
      setData(d => d.filter(e => e.id !== deleteEmployee.id));
      toast({ title: 'تم الحذف', description: deleteEmployee.name });
    }
    setDeleting(false);
    setDeleteEmployee(null);
  }, [deleteEmployee, toast]);

  // ── setColFilter helper ──
  const setColFilter = (key: string, value: string) => {
    setColFilters(prev => {
      const next = { ...prev };
      if (!value || value === 'all') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // ── unique values for select filters ──
  const uniqueVals = useMemo(() => ({
    city:               [...new Set(data.map(e => e.city).filter(Boolean))] as string[],
    nationality:        [...new Set(data.map(e => e.nationality).filter(Boolean))] as string[],
    sponsorship_status: ['sponsored', 'not_sponsored', 'absconded', 'terminated'],
    license_status:     ['has_license', 'no_license', 'applied'],
    job_title:          [...new Set(data.map(e => e.job_title).filter(Boolean))] as string[],
  }), [data]);

  // ── Filter + sort ──
  const filtered = useMemo(() => {
    let rows = data.filter(emp => {
      const res = calcResidency(emp.residency_expiry);

      for (const [key, val] of Object.entries(colFilters)) {
        if (!val) continue;
        switch (key) {
          case 'name':
            if (!emp.name.toLowerCase().includes(val.toLowerCase())) return false;
            break;
          case 'national_id':
            if (!(emp.national_id || '').includes(val)) return false;
            break;
          case 'phone':
            if (!(emp.phone || '').includes(val)) return false;
            break;
          case 'job_title':
            if ((emp.job_title || '') !== val) return false;
            break;
          case 'city':
            if ((emp.city || '') !== val) return false;
            break;
          case 'nationality':
            if ((emp.nationality || '') !== val) return false;
            break;
          case 'sponsorship_status':
            if ((emp.sponsorship_status || '') !== val) return false;
            break;
          case 'license_status':
            if ((emp.license_status || '') !== val) return false;
            break;
          case 'residency_status': {
            if (val === 'valid'   && res.status !== 'valid')   return false;
            if (val === 'expired' && res.status !== 'expired') return false;
            if (val === 'urgent'  && (res.days === null || res.days >= 30)) return false;
            break;
          }
          case 'email':
            if (!(emp.email || '').toLowerCase().includes(val.toLowerCase())) return false;
            break;
          case 'bank_account_number':
            if (!(emp.bank_account_number || '').includes(val)) return false;
            break;
        }
      }
      return true;
    });

    if (sortField && sortDir) {
      rows = [...rows].sort((a, b) => {
        let va: any, vb: any;
        if (sortField === 'days_residency') {
          va = a.residency_expiry ? differenceInDays(parseISO(a.residency_expiry), new Date()) : -9999;
          vb = b.residency_expiry ? differenceInDays(parseISO(b.residency_expiry), new Date()) : -9999;
        } else {
          va = (a as any)[sortField] ?? '';
          vb = (b as any)[sortField] ?? '';
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1  : -1;
        return 0;
      });
    }
    return rows;
  }, [data, colFilters, sortField, sortDir]);

  // ── Export ──
  const handleExport = () => {
    const rows = filtered.map((e, i) => {
      const { days, status } = calcResidency(e.residency_expiry);
      return {
        '#': i + 1,
        'الاسم': e.name,
        'رقم الهوية': e.national_id || '',
        'المسمى الوظيفي': e.job_title || '',
        'المدينة': e.city === 'makkah' ? 'مكة' : e.city === 'jeddah' ? 'جدة' : '',
        'رقم الهاتف': e.phone || '',
        'الجنسية': e.nationality || '',
        'حالة الكفالة': { sponsored: 'على الكفالة', not_sponsored: 'ليس على الكفالة', absconded: 'هروب', terminated: 'انتهاء الخدمة' }[e.sponsorship_status || ''] || '',
        'تاريخ الانضمام': e.join_date || '',
        'تاريخ الميلاد': e.birth_date || '',
        'انتهاء الإقامة': e.residency_expiry || '',
        'المتبقي (يوم)': days ?? '',
        'حالة الإقامة': status === 'valid' ? 'صالحة' : status === 'expired' ? 'منتهية' : '',
        'حالة الرخصة': { has_license: 'لديه رخصة', no_license: 'ليس لديه رخصة', applied: 'تم التقديم' }[e.license_status || ''] || '',
        'رقم الحساب البنكي': e.bank_account_number || '',
        'البريد الإلكتروني': e.email || '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'بيانات الموظفين');
    XLSX.writeFile(wb, `بيانات_المناديب_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleTemplate = () => {
    const headers = [['الاسم', 'رقم الهوية', 'رقم الهاتف', 'البريد الإلكتروني', 'المدينة (makkah/jeddah)',
      'الجنسية', 'المسمى الوظيفي', 'تاريخ الانضمام', 'تاريخ الميلاد', 'انتهاء الإقامة',
      'حالة الرخصة (has_license/no_license/applied)',
      'حالة الكفالة (sponsored/not_sponsored/absconded/terminated)',
      'رقم الحساب البنكي', 'نوع الراتب (orders/shift)', 'الحالة (active/inactive/ended)']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'القالب');
    XLSX.writeFile(wb, 'import_template.xlsx');
  };

  // ── active cols (ordered) ──
  const activeCols = ALL_COLUMNS.filter(c => visibleCols.has(c.key));
  const hasActiveFilters = Object.keys(colFilters).length > 0;

  // ── profile view ──
  if (selectedEmployee) {
    const emp = data.find(e => e.id === selectedEmployee);
    if (emp) return <EmployeeProfile employee={emp as any} onBack={() => setSelectedEmployee(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>الموارد البشرية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">الموظفين</span>
          </nav>
          <h1 className="page-title">الموظفين</h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Hide/show columns */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Columns size={14} /> الأعمدة
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
              <DropdownMenuLabel>إظهار / إخفاء الأعمدة</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {ALL_COLUMNS.filter(c => c.key !== 'seq' && c.key !== 'actions').map(col => (
                <DropdownMenuCheckboxItem
                  key={col.key}
                  checked={visibleCols.has(col.key)}
                  onCheckedChange={checked => {
                    setVisibleCols(prev => {
                      const next = new Set(prev);
                      if (checked) next.add(col.key); else next.delete(col.key);
                      return next;
                    });
                  }}
                >
                  {col.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Data management */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <Download size={14} /> البيانات ▾
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
              {permissions.can_edit && (
                <DropdownMenuItem onClick={() => setShowImportModal(true)}>📥 استيراد Excel</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleTemplate}>📋 تحميل قالب</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => window.print()}>🖨️ طباعة</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {permissions.can_edit && (
            <Button onClick={() => { setEditEmployee(null); setShowAddModal(true); }} className="gap-2 h-9">
              <Plus size={15} /> إضافة موظف
            </Button>
          )}
        </div>
      </div>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter size={12} /> الفلاتر النشطة:</span>
          {Object.entries(colFilters).map(([key, val]) => {
            const colLabel = ALL_COLUMNS.find(c => c.key === key)?.label || key;
            return (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {colLabel}: {val}
                <button onClick={() => setColFilter(key, '')} className="hover:text-destructive"><X size={10} /></button>
              </span>
            );
          })}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setColFilters({})}>
            مسح الكل
          </Button>
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="ta-table-wrap">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Column headers — filter icon embedded beside label */}
              <tr className="ta-thead">
                {activeCols.map(col => {
                  const isFilterable = !['seq', 'actions', 'residency_status', 'days_residency', 'residency_expiry', 'join_date', 'birth_date', 'bank_account_number', 'probation_end_date'].includes(col.key);
                  const isActive = !!colFilters[col.key];

                  const filterContent = (() => {
                    if (!isFilterable) return null;
                    if (col.key === 'city') return (
                      <Select value={colFilters.city || 'all'} onValueChange={v => setColFilter('city', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="makkah">مكة</SelectItem>
                          <SelectItem value="jeddah">جدة</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'sponsorship_status') return (
                      <Select value={colFilters.sponsorship_status || 'all'} onValueChange={v => setColFilter('sponsorship_status', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="sponsored">على الكفالة</SelectItem>
                          <SelectItem value="not_sponsored">ليس على الكفالة</SelectItem>
                          <SelectItem value="absconded">هروب</SelectItem>
                          <SelectItem value="terminated">انتهاء الخدمة</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'license_status') return (
                      <Select value={colFilters.license_status || 'all'} onValueChange={v => setColFilter('license_status', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          <SelectItem value="has_license">لديه رخصة</SelectItem>
                          <SelectItem value="no_license">ليس لديه رخصة</SelectItem>
                          <SelectItem value="applied">تم التقديم</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'nationality') return (
                      <Select value={colFilters.nationality || 'all'} onValueChange={v => setColFilter('nationality', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {uniqueVals.nationality.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    if (col.key === 'job_title') return (
                      <Select value={colFilters.job_title || 'all'} onValueChange={v => setColFilter('job_title', v)}>
                        <SelectTrigger className="h-7 text-xs w-full"><SelectValue placeholder="الكل" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {uniqueVals.job_title.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                    return (
                      <Input
                        className="h-7 text-xs px-2"
                        placeholder="ابحث..."
                        value={colFilters[col.key] || ''}
                        onChange={e => setColFilter(col.key, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    );
                  })();

                  return (
                    <th
                      key={col.key}
                      className={`ta-th select-none whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-foreground' : ''}`}
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                        {isFilterable && filterContent && (
                          <ColFilterPopover
                            colKey={col.key}
                            label={col.label}
                            active={isActive}
                            onClear={() => setColFilter(col.key, '')}
                          >
                            {filterContent}
                          </ColFilterPopover>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={activeCols.length} />)
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={activeCols.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <span className="text-4xl">👥</span>
                      <p className="font-medium">لا توجد نتائج</p>
                      <p className="text-xs">جرّب تغيير الفلاتر أو إضافة موظف جديد</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((emp, idx) => {
                const res = calcResidency(emp.residency_expiry);
                const daysColor = res.days === null ? '' : res.days > 60 ? 'text-success' : res.days > 0 ? 'text-warning' : 'text-destructive font-bold';

                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    {activeCols.map(col => {
                      switch (col.key) {
                        case 'seq':
                          return <td key="seq" className="px-3 py-2.5 text-xs text-muted-foreground text-center">{idx + 1}</td>;

                        case 'name':
                          return (
                            <td key="name" className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-2.5">
                                {emp.personal_photo_url
                                  ? <img src={emp.personal_photo_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                                  : <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">{emp.name.charAt(0)}</div>
                                }
                                <button onClick={() => setSelectedEmployee(emp.id)} className="text-sm font-semibold text-foreground hover:text-primary transition-colors text-start">
                                  {emp.name}
                                </button>
                              </div>
                            </td>
                          );

                        case 'national_id':
                          return <td key="national_id" className="px-3 py-2.5 text-sm text-muted-foreground font-mono whitespace-nowrap" dir="ltr">{emp.national_id || '—'}</td>;

                        case 'job_title':
                          return <td key="job_title" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.job_title || '—'}</td>;

                        case 'city':
                          return (
                            <td key="city" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.city || ''}
                                options={[{ value: 'makkah', label: 'مكة' }, { value: 'jeddah', label: 'جدة' }]}
                                onSave={v => saveField(emp.id, 'city', v)}
                                renderDisplay={() => <CityBadge city={emp.city} />}
                              />
                            </td>
                          );

                        case 'phone':
                          return <td key="phone" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap" dir="ltr">{emp.phone || '—'}</td>;

                        case 'nationality':
                          return <td key="nationality" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.nationality || '—'}</td>;

                        case 'sponsorship_status':
                          return (
                            <td key="sponsorship_status" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.sponsorship_status || 'not_sponsored'}
                                options={[
                                  { value: 'sponsored',     label: 'على الكفالة'      },
                                  { value: 'not_sponsored', label: 'ليس على الكفالة'  },
                                  { value: 'absconded',     label: 'هروب'             },
                                  { value: 'terminated',    label: 'انتهاء الخدمة'    },
                                ]}
                                onSave={v => saveField(emp.id, 'sponsorship_status', v)}
                                renderDisplay={() => <SponsorBadge status={emp.sponsorship_status} />}
                              />
                            </td>
                          );

                        case 'join_date':
                          return <td key="join_date" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.join_date ? format(parseISO(emp.join_date), 'yyyy/MM/dd') : '—'}</td>;

                        case 'birth_date':
                          return <td key="birth_date" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.birth_date ? format(parseISO(emp.birth_date), 'yyyy/MM/dd') : '—'}</td>;

                        case 'probation_end_date': {
                          const probDays = emp.probation_end_date ? differenceInDays(parseISO(emp.probation_end_date), new Date()) : null;
                          return (
                            <td key="probation_end_date" className="px-3 py-2.5 whitespace-nowrap">
                              {emp.probation_end_date ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-muted-foreground">{format(parseISO(emp.probation_end_date), 'yyyy/MM/dd')}</span>
                                  {probDays !== null && (
                                    <span className={`text-xs font-medium ${probDays < 0 ? 'text-muted-foreground' : probDays <= 7 ? 'text-destructive' : probDays <= 30 ? 'text-warning' : 'text-success'}`}>
                                      {probDays < 0 ? 'انتهت' : `${probDays}ي متبقي`}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                          );
                        }

                        case 'residency_expiry':
                          return <td key="residency_expiry" className="px-3 py-2.5 text-sm text-muted-foreground whitespace-nowrap">{emp.residency_expiry ? format(parseISO(emp.residency_expiry), 'yyyy/MM/dd') : '—'}</td>;

                        case 'days_residency':
                          return <td key="days_residency" className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap text-center ${daysColor}`}>{res.days === null ? '—' : res.days}</td>;

                        case 'residency_status':
                          return (
                            <td key="residency_status" className="px-3 py-2.5 whitespace-nowrap">
                              {res.status === 'valid'
                                ? <span className="badge-success">صالحة</span>
                                : res.status === 'expired'
                                ? <span className="badge-urgent">منتهية</span>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                          );

                        case 'license_status':
                          return (
                            <td key="license_status" className="px-3 py-2.5 whitespace-nowrap">
                              <InlineSelect
                                value={emp.license_status || 'no_license'}
                                options={[
                                  { value: 'has_license', label: 'لديه رخصة'     },
                                  { value: 'no_license',  label: 'ليس لديه رخصة' },
                                  { value: 'applied',     label: 'تم التقديم'    },
                                ]}
                                onSave={v => saveField(emp.id, 'license_status', v)}
                                renderDisplay={() => <LicenseBadge status={emp.license_status} />}
                              />
                            </td>
                          );

                        case 'bank_account_number':
                          return <td key="bank_account_number" className="px-3 py-2.5 text-sm text-muted-foreground font-mono whitespace-nowrap" dir="ltr">{emp.bank_account_number || '—'}</td>;

                        case 'email':
                          return (
                            <td key="email" className="px-3 py-2.5 text-sm whitespace-nowrap" dir="ltr">
                              {emp.email
                                ? <a href={`mailto:${emp.email}`} className="text-primary hover:underline">{emp.email}</a>
                                : <span className="text-muted-foreground/40">—</span>
                              }
                            </td>
                          );

                        case 'actions':
                          return (
                            <td key="actions" className="px-3 py-2.5 whitespace-nowrap">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
                                    ⋮
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setSelectedEmployee(emp.id)}>
                                    <Eye size={14} className="me-2" /> عرض الملف
                                  </DropdownMenuItem>
                                  {permissions.can_edit && (
                                    <DropdownMenuItem onClick={() => { setEditEmployee(emp); setShowAddModal(true); }}>
                                      <Edit size={14} className="me-2" /> تعديل البيانات
                                    </DropdownMenuItem>
                                  )}
                                  {permissions.can_delete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteEmployee(emp)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 size={14} className="me-2" /> حذف الموظف
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          );

                        default:
                          return <td key={(col as any).key} className="px-3 py-2.5">—</td>;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddEmployeeModal
          onClose={() => { setShowAddModal(false); setEditEmployee(null); }}
          editEmployee={editEmployee}
          onSuccess={() => { fetchEmployees(); setShowAddModal(false); setEditEmployee(null); }}
        />
      )}

      {showImportModal && (
        <ImportEmployeesModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => { setShowImportModal(false); fetchEmployees(); }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteEmployee} onOpenChange={open => !open && setDeleteEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الموظف <span className="font-semibold text-foreground">{deleteEmployee?.name}</span>؟
              {' '}لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="animate-spin me-1" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Employees;
