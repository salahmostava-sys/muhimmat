import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit, Search, UserPlus, Loader2, X,
  ShieldCheck, History, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface App {
  id: string;
  name: string;
  brand_color: string;
  text_color: string;
}

interface Employee {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  account_id: string;
  employee_id: string;
  employee_name?: string;
  start_date: string;
  end_date: string | null;
  month_year: string;
  notes: string | null;
  created_at: string;
}

interface PlatformAccount {
  id: string;
  app_id: string;
  employee_id?: string | null;
  app_name?: string;
  app_color?: string;
  app_text_color?: string;
  account_username: string;
  account_id_on_platform: string | null;
  iqama_number: string | null;
  iqama_expiry_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  current_employee?: Employee | null;
  assignments?: Assignment[];
}

interface PlatformAccountWritePayload {
  app_id: string;
  account_username: string;
  employee_id: string | null;
  account_id_on_platform: string | null;
  iqama_number: string | null;
  iqama_expiry_date: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const iqamaBadge = (expiry: string | null, alertDays: number) => {
  if (!expiry) return null;
  const days = differenceInDays(parseISO(expiry), new Date());
  if (days < 0)
    return { label: `انتهت منذ ${Math.abs(days)} يوم`, cls: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (days <= 14)
    return { label: `تنتهي خلال ${days} يوم`, cls: 'bg-destructive/15 text-destructive border-destructive/20' };
  if (days <= alertDays)
    return { label: `تنتهي خلال ${days} يوم`, cls: 'bg-warning/15 text-warning border-warning/20' };
  return { label: `تنتهي ${format(parseISO(expiry), 'dd/MM/yyyy')}`, cls: 'bg-success/10 text-success border-success/20' };
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PlatformAccounts = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { permissions: perms } = usePermissions('platform_accounts');
  const { settings } = useSystemSettings();
  const alertDays = settings?.iqama_alert_days ?? 90;

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [groupAppTab, setGroupAppTab] = useState<string>('all');

  type SortKey = 'account_username' | 'account_id_on_platform' | 'iqama_number' | 'iqama_expiry_date' | 'current_employee' | 'status';
  const [sortKey, setSortKey] = useState<SortKey>('iqama_expiry_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Account dialog
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PlatformAccount | null>(null);
  const [accountForm, setAccountForm] = useState<Partial<PlatformAccount>>({});
  const [savingAccount, setSavingAccount] = useState(false);

  // Assign dialog
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PlatformAccount | null>(null);
  const [assignForm, setAssignForm] = useState({ employee_id: '', start_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [savingAssign, setSavingAssign] = useState(false);

  // History dialog
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyAccount, setHistoryAccount] = useState<PlatformAccount | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);

      const [appsRes, empRes, accRes, assignRes] = await Promise.all([
        supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name'),
        supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
        supabase.from('platform_accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('account_assignments').select('*').is('end_date', null),
      ]);

    const appsData: App[] = (appsRes.data ?? []) as App[];
    const empData: Employee[] = (empRes.data ?? []) as Employee[];
    const rawAccounts = (accRes.data ?? []) as PlatformAccount[];
    const activeAssignments = (assignRes.data ?? []) as Assignment[];

    const appMap = Object.fromEntries(appsData.map(a => [a.id, a]));
    const empMap = Object.fromEntries(empData.map(e => [e.id, e]));

    const enriched: PlatformAccount[] = rawAccounts.map(a => {
      const active = activeAssignments.find(x => x.account_id === a.id);
      return {
        ...a,
        app_name: appMap[a.app_id]?.name ?? '—',
        app_color: appMap[a.app_id]?.brand_color ?? '#6366f1',
        app_text_color: appMap[a.app_id]?.text_color ?? '#ffffff',
        current_employee: active ? empMap[active.employee_id] ?? null : null,
      };
    });

    setApps(appsData);
    setEmployees(empData);
    setAccounts(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Account CRUD ───────────────────────────────────────────────────────────

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm({ employee_id: null, app_id: '', account_username: '', account_id_on_platform: '', iqama_number: '', iqama_expiry_date: '', status: 'active', notes: '' });
    setAccountDialog(true);
  };

  const openEditAccount = (a: PlatformAccount) => {
    setEditingAccount(a);
    setAccountForm({ ...a });
    setAccountDialog(true);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortAccounts = (list: PlatformAccount[]) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const getVal = (x: PlatformAccount) => {
        switch (sortKey) {
          case 'account_username':
            return x.account_username ?? '';
          case 'account_id_on_platform':
            return x.account_id_on_platform ?? '';
          case 'iqama_number':
            return x.iqama_number ?? '';
          case 'iqama_expiry_date':
            return x.iqama_expiry_date ? new Date(x.iqama_expiry_date).getTime() : null;
          case 'current_employee':
            return x.current_employee?.name ?? '';
          case 'status':
            return x.status ?? '';
          default:
            return '';
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1 * dir;
      if (vb === null) return -1 * dir;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'ar') * dir;
    });
  };

  const saveAccount = async () => {
    if (!accountForm.app_id || !accountForm.account_username?.trim()) {
      toast({ title: 'خطأ', description: 'اختر المنصة وأدخل اسم الحساب', variant: 'destructive' });
      return;
    }
    setSavingAccount(true);

    const payload: PlatformAccountWritePayload = {
      app_id: accountForm.app_id,
      account_username: accountForm.account_username!.trim(),
      employee_id: accountForm.employee_id || null,
      account_id_on_platform: accountForm.account_id_on_platform?.trim() || null,
      iqama_number: accountForm.iqama_number?.trim() || null,
      iqama_expiry_date: accountForm.iqama_expiry_date || null,
      status: accountForm.status ?? 'active',
      notes: accountForm.notes?.trim() || null,
    };

    let error;
    if (editingAccount) {
      ({ error } = await supabase.from('platform_accounts').update(payload).eq('id', editingAccount.id));
    } else {
      ({ error } = await supabase.from('platform_accounts').insert(payload));
    }

    setSavingAccount(false);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingAccount ? 'تم التعديل' : 'تم الإضافة', description: `حساب "${payload.account_username}"` });
    setAccountDialog(false);
    fetchData();
  };

  // ── Assign rider ───────────────────────────────────────────────────────────

  const openAssign = (account: PlatformAccount) => {
    setAssignTarget(account);
    setAssignForm({ employee_id: '', start_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setAssignDialog(true);
  };

  const saveAssign = async () => {
    if (!assignForm.employee_id || !assignForm.start_date) {
      toast({ title: 'خطأ', description: 'اختر المندوب وتاريخ البداية', variant: 'destructive' });
      return;
    }
    setSavingAssign(true);

    const today = format(new Date(), 'yyyy-MM-dd');
    const monthYear = assignForm.start_date.slice(0, 7);

    // 1. Close any open assignment for this account
    const { data: open } = await supabase
      .from('account_assignments')
      .select('id')
      .eq('account_id', assignTarget!.id)
      .is('end_date', null);

    if (open && open.length > 0) {
      const openRows = open as Array<{ id: string }>;
      await supabase
        .from('account_assignments')
        .update({ end_date: today })
        .in('id', openRows.map((x) => x.id));
    }

    // 2. Insert new assignment
    const { error } = await supabase.from('account_assignments').insert({
      account_id: assignTarget!.id,
      employee_id: assignForm.employee_id,
      start_date: assignForm.start_date,
      end_date: null,
      month_year: monthYear,
      notes: assignForm.notes?.trim() || null,
      created_by: user?.id ?? null,
    });

    if (error) {
      setSavingAssign(false);
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }

    // Keep `platform_accounts.employee_id` in sync for alert automation
    const { error: linkErr } = await supabase
      .from('platform_accounts')
      .update({ employee_id: assignForm.employee_id })
      .eq('id', assignTarget!.id);

    if (linkErr) {
      setSavingAssign(false);
      toast({ title: 'خطأ', description: linkErr.message, variant: 'destructive' });
      return;
    }

    setSavingAssign(false);
    toast({ title: 'تم التعيين', description: 'تم تعيين المندوب بنجاح' });
    setAssignDialog(false);
    fetchData();
  };

  // ── History ────────────────────────────────────────────────────────────────

  const openHistory = async (account: PlatformAccount) => {
    setHistoryAccount(account);
    setHistoryDialog(true);
    setHistoryLoading(true);

    const { data } = await supabase
      .from('account_assignments')
      .select('*')
      .eq('account_id', account.id)
      .order('start_date', { ascending: false });

    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    const assignments: Assignment[] = ((data ?? []) as unknown as Assignment[]).map(r => ({
      ...r,
      employee_name: empMap[r.employee_id] ?? 'مندوب غير معروف',
    }));

    setHistoryAccount(prev => prev ? { ...prev, assignments } : null);
    setHistoryLoading(false);
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = accounts.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || a.account_username.toLowerCase().includes(q)
      || (a.account_id_on_platform ?? '').toLowerCase().includes(q)
      || (a.iqama_number ?? '').includes(search)
      || (a.current_employee?.name ?? '').includes(q);
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const warnCount = accounts.filter(a => {
    if (!a.iqama_expiry_date) return false;
    return differenceInDays(parseISO(a.iqama_expiry_date), new Date()) <= alertDays;
  }).length;

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>حسابات المنصات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <ShieldCheck size={20} /> حسابات المنصات
            </h1>
            <p className="page-subtitle">
              {loading ? 'جارٍ التحميل...' : `${accounts.length} حساب — ${activeCount} نشط`}
              {warnCount > 0 && <span className="text-destructive mr-2 font-semibold">· {warnCount} إقامة تحتاج متابعة</span>}
            </p>
          </div>
          {perms.can_edit && (
            <Button size="sm" className="gap-2" onClick={openAddAccount}>
              <Plus size={15} /> إضافة حساب
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">إجمالي الحسابات</p>
          <p className="text-3xl font-bold mt-1">{accounts.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">نشطة</p>
          <p className="text-3xl font-bold text-success mt-1">{activeCount}</p>
        </div>
        <div className="stat-card border-r-4 border-r-warning">
          <p className="text-sm text-muted-foreground">إقامات قريبة الانتهاء</p>
          <p className="text-3xl font-bold text-warning mt-1">{warnCount}</p>
          <p className="text-xs text-muted-foreground mt-1">خلال {alertDays} يوم</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-muted-foreground">عدد المنصات</p>
          <p className="text-3xl font-bold mt-1">{apps.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="ds-card p-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث باسم الحساب، رقم الإقامة، أو المندوب..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
          </SelectContent>
        </Select>
        {(search || groupAppTab !== 'all' || filterStatus !== 'all') && (
          <Button variant="ghost" size="sm" className="gap-1 h-9 text-muted-foreground"
            onClick={() => { setSearch(''); setFilterStatus('all'); setGroupAppTab('all'); }}>
            <X size={13} /> مسح
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ds-card p-12 text-center text-muted-foreground">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد حسابات</p>
          <p className="text-sm mt-1">أضف حسابات المنصات من زر "إضافة حساب"</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <Tabs value={groupAppTab} onValueChange={setGroupAppTab} dir="rtl">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="all">الكل</TabsTrigger>
              {apps.map(a => (
                <TabsTrigger key={a.id} value={a.id}>
                  {a.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {(['all', ...apps.map(a => a.id)] as string[]).map(tabId => {
              const list = tabId === 'all' ? filtered : filtered.filter(a => a.app_id === tabId);
              const sorted = sortAccounts(list);
              return (
                <TabsContent key={tabId} value={tabId}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('account_username')}>
                            اسم الحساب {sortKey === 'account_username' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('account_id_on_platform')}>
                            رقم الحساب {sortKey === 'account_id_on_platform' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('iqama_number')}>
                            رقم الإقامة {sortKey === 'iqama_number' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('iqama_expiry_date')}>
                            انتهاء الإقامة {sortKey === 'iqama_expiry_date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('current_employee')}>
                            المندوب الحالي {sortKey === 'current_employee' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-right font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                            الحالة {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sorted.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-muted-foreground">
                              لا توجد نتائج لهذا المنصّة
                            </td>
                          </tr>
                        ) : (
                          sorted.map(acc => {
                            const badge = iqamaBadge(acc.iqama_expiry_date, alertDays);
                            return (
                              <tr key={acc.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-semibold">{acc.account_username}</td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{acc.account_id_on_platform ?? '—'}</td>
                                <td className="px-4 py-3 font-mono text-xs">{acc.iqama_number ?? '—'}</td>
                                <td className="px-4 py-3">
                                  {badge ? (
                                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {acc.current_employee ? (
                                    <span className="text-xs font-medium text-foreground">{acc.current_employee.name}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">لا يوجد</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${acc.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}>
                                    {acc.status === 'active' ? 'نشط' : 'غير نشط'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1 justify-end">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 gap-1 text-xs text-primary"
                                      onClick={() => openHistory(acc)}
                                      title="السجل التاريخي"
                                    >
                                      <History size={13} /> السجل
                                    </Button>
                                    {perms.can_edit && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 gap-1 text-xs"
                                          onClick={() => openAssign(acc)}
                                          title="تعيين مندوب"
                                        >
                                          <UserPlus size={13} /> تعيين
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2 gap-1 text-xs"
                                          onClick={() => openEditAccount(acc)}
                                        >
                                          <Edit size={13} /> تعديل
                                        </Button>
                                      </>
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
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      )}

      {/* ── Add/Edit Account Dialog ──────────────────────────────────────────── */}
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'تعديل الحساب' : 'إضافة حساب جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>المنصة</Label>
              <Select value={accountForm.app_id ?? ''} onValueChange={v => setAccountForm(p => ({ ...p, app_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة" /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المندوب المرتبط (اختياري)</Label>
              <Select
                value={(accountForm.employee_id ?? null) ? String(accountForm.employee_id) : '__none__'}
                onValueChange={v => setAccountForm(p => ({ ...p, employee_id: v === '__none__' ? null : v }))}
              >
                <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون ربط —</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم الحساب على المنصة</Label>
                <Input value={accountForm.account_username ?? ''} onChange={e => setAccountForm(p => ({ ...p, account_username: e.target.value }))} placeholder="اسم المستخدم" />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الحساب (ID)</Label>
                <Input value={accountForm.account_id_on_platform ?? ''} onChange={e => setAccountForm(p => ({ ...p, account_id_on_platform: e.target.value }))} placeholder="رقم الحساب" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>رقم الإقامة</Label>
                <Input value={accountForm.iqama_number ?? ''} onChange={e => setAccountForm(p => ({ ...p, iqama_number: e.target.value }))} placeholder="1xxxxxxxxx" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>تاريخ انتهاء الإقامة</Label>
                <Input type="date" value={accountForm.iqama_expiry_date ?? ''} onChange={e => setAccountForm(p => ({ ...p, iqama_expiry_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={accountForm.status ?? 'active'} onValueChange={v => setAccountForm(p => ({ ...p, status: v as 'active' | 'inactive' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={accountForm.notes ?? ''} onChange={e => setAccountForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات اختيارية..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialog(false)}>إلغاء</Button>
            <Button onClick={saveAccount} disabled={savingAccount} className="gap-2">
              {savingAccount && <Loader2 size={14} className="animate-spin" />}
              {editingAccount ? 'حفظ التعديلات' : 'إضافة الحساب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Rider Dialog ──────────────────────────────────────────────── */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين مندوب — {assignTarget?.account_username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {assignTarget?.current_employee && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg p-3 text-sm">
                <span className="font-medium">المندوب الحالي:</span>
                <span>{assignTarget.current_employee.name}</span>
                <span className="text-amber-600 text-xs mr-auto">سيتم إغلاق تعيينه تلقائياً</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>المندوب الجديد</Label>
              <Select value={assignForm.employee_id} onValueChange={v => setAssignForm(p => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>تاريخ البداية</Label>
              <Input type="date" value={assignForm.start_date} onChange={e => setAssignForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات اختيارية..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>إلغاء</Button>
            <Button onClick={saveAssign} disabled={savingAssign} className="gap-2">
              {savingAssign && <Loader2 size={14} className="animate-spin" />}
              تعيين المندوب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── History Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={historyDialog} onOpenChange={setHistoryDialog}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History size={16} />
              السجل التاريخي — {historyAccount?.account_username}
              <span className="text-sm text-muted-foreground font-normal">({historyAccount?.app_name})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : !historyAccount?.assignments?.length ? (
              <div className="text-center py-10 text-muted-foreground">
                <History size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">لا يوجد سجل تعيينات بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyAccount.assignments!.map((a, idx) => (
                  <div key={a.id} className={`flex items-start gap-3 p-3 rounded-lg border ${!a.end_date ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!a.end_date ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{a.employee_name}</span>
                        {!a.end_date && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                            شاغل حالياً
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        من: <span className="font-medium text-foreground">{a.start_date}</span>
                        {a.end_date && <> — إلى: <span className="font-medium text-foreground">{a.end_date}</span></>}
                        <span className="mr-3 text-muted-foreground">({a.month_year})</span>
                      </p>
                      {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{a.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformAccounts;
