import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit, Trash2, Search, ChevronDown, ChevronRight,
  UserPlus, CalendarDays, Loader2, X, Users, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
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
  residency_expiry?: string | null;
}

interface Session {
  id: string;
  platform_account_id: string;
  worker_employee_id: string;
  worker_name?: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

interface PlatformAccount {
  id: string;
  app_id: string;
  app_name?: string;
  app_color?: string;
  app_text_color?: string;
  account_name: string;
  account_external_id: string | null;
  residency_employee_id: string | null;
  residency_holder_name: string | null;
  residency_expiry: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  created_at: string;
  sessions?: Session[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const residencyBadge = (expiry: string | null) => {
  if (!expiry) return null;
  const days = differenceInDays(parseISO(expiry), new Date());
  if (days < 0) return { label: `انتهت منذ ${Math.abs(days)} يوم`, cls: 'bg-destructive/10 text-destructive border-destructive/20' };
  if (days <= 14) return { label: `تنتهي خلال ${days} يوم`, cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (days <= 30) return { label: `تنتهي خلال ${days} يوم`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: `تنتهي ${format(parseISO(expiry), 'dd/MM/yyyy')}`, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};

const emptyAccount = (): Partial<PlatformAccount> => ({
  app_id: '',
  account_name: '',
  account_external_id: '',
  residency_employee_id: null,
  residency_holder_name: '',
  residency_expiry: '',
  status: 'active',
  notes: '',
});

const emptySession = () => ({
  worker_employee_id: '',
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: '',
  notes: '',
});

// ─── Main Component ───────────────────────────────────────────────────────────

const PlatformAccounts = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit, canDelete } = usePermissions('platform_accounts');

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sessionsLoading, setSessionsLoading] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [filterApp, setFilterApp] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Account dialog
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PlatformAccount | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccount());
  const [savingAccount, setSavingAccount] = useState(false);

  // Session dialog
  const [sessionDialog, setSessionDialog] = useState(false);
  const [sessionTargetAccount, setSessionTargetAccount] = useState<PlatformAccount | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [sessionForm, setSessionForm] = useState(emptySession());
  const [savingSession, setSavingSession] = useState(false);

  // Delete dialogs
  const [deleteAccountDialog, setDeleteAccountDialog] = useState<PlatformAccount | null>(null);
  const [deleteSessionDialog, setDeleteSessionDialog] = useState<{ session: Session; accountId: string } | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [appsRes, empRes, accRes] = await Promise.all([
      supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name'),
      supabase.from('employees').select('id, name, residency_expiry').eq('status', 'active').order('name'),
      supabase.from('platform_accounts').select('*').order('created_at', { ascending: false }),
    ]);

    const appsData: App[] = (appsRes.data ?? []) as App[];
    const empData: Employee[] = (empRes.data ?? []) as Employee[];
    const rawAccounts = (accRes.data ?? []) as any[];

    const appMap = Object.fromEntries(appsData.map(a => [a.id, a]));

    const enriched: PlatformAccount[] = rawAccounts.map(a => ({
      ...a,
      app_name: appMap[a.app_id]?.name ?? '—',
      app_color: appMap[a.app_id]?.brand_color ?? '#6366f1',
      app_text_color: appMap[a.app_id]?.text_color ?? '#ffffff',
    }));

    setApps(appsData);
    setEmployees(empData);
    setAccounts(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchSessions = useCallback(async (accountId: string) => {
    setSessionsLoading(prev => new Set(prev).add(accountId));
    const { data } = await supabase
      .from('platform_account_sessions')
      .select('*')
      .eq('platform_account_id', accountId)
      .order('start_date', { ascending: false });

    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    const sessions: Session[] = ((data ?? []) as any[]).map(s => ({
      ...s,
      worker_name: empMap[s.worker_employee_id] ?? 'مندوب غير معروف',
    }));

    setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, sessions } : a));
    setSessionsLoading(prev => { const n = new Set(prev); n.delete(accountId); return n; });
  }, [employees]);

  // ── Expand / collapse ──────────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        const account = accounts.find(a => a.id === id);
        if (!account?.sessions) fetchSessions(id);
      }
      return next;
    });
  };

  // ── Account CRUD ───────────────────────────────────────────────────────────

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccount());
    setAccountDialog(true);
  };

  const openEditAccount = (a: PlatformAccount) => {
    setEditingAccount(a);
    setAccountForm({ ...a });
    setAccountDialog(true);
  };

  const saveAccount = async () => {
    if (!accountForm.app_id || !accountForm.account_name?.trim()) {
      toast({ title: 'خطأ', description: 'اختر المنصة وأدخل اسم الحساب', variant: 'destructive' });
      return;
    }
    setSavingAccount(true);

    const payload: any = {
      app_id: accountForm.app_id,
      account_name: accountForm.account_name!.trim(),
      account_external_id: accountForm.account_external_id?.trim() || null,
      residency_employee_id: accountForm.residency_employee_id || null,
      residency_holder_name: accountForm.residency_holder_name?.trim() || null,
      residency_expiry: accountForm.residency_expiry || null,
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
    if (error) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingAccount ? 'تم التعديل' : 'تم الإضافة', description: `حساب "${payload.account_name}"` });
    setAccountDialog(false);
    fetchData();
  };

  const deleteAccount = async () => {
    if (!deleteAccountDialog) return;
    const { error } = await supabase.from('platform_accounts').delete().eq('id', deleteAccountDialog.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف', description: `حساب "${deleteAccountDialog.account_name}"` });
    setDeleteAccountDialog(null);
    fetchData();
  };

  // ── Session CRUD ───────────────────────────────────────────────────────────

  const openAddSession = (account: PlatformAccount) => {
    setSessionTargetAccount(account);
    setEditingSession(null);
    setSessionForm(emptySession());
    setSessionDialog(true);
  };

  const openEditSession = (session: Session, account: PlatformAccount) => {
    setSessionTargetAccount(account);
    setEditingSession(session);
    setSessionForm({
      worker_employee_id: session.worker_employee_id,
      start_date: session.start_date,
      end_date: session.end_date ?? '',
      notes: session.notes ?? '',
    });
    setSessionDialog(true);
  };

  const saveSession = async () => {
    if (!sessionForm.worker_employee_id || !sessionForm.start_date) {
      toast({ title: 'خطأ', description: 'اختر المندوب وتاريخ البداية', variant: 'destructive' });
      return;
    }
    setSavingSession(true);

    const payload: any = {
      platform_account_id: sessionTargetAccount!.id,
      worker_employee_id: sessionForm.worker_employee_id,
      start_date: sessionForm.start_date,
      end_date: sessionForm.end_date || null,
      notes: sessionForm.notes?.trim() || null,
      created_by: user?.id ?? null,
    };

    let error;
    if (editingSession) {
      ({ error } = await supabase.from('platform_account_sessions').update(payload).eq('id', editingSession.id));
    } else {
      ({ error } = await supabase.from('platform_account_sessions').insert(payload));
    }

    setSavingSession(false);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingSession ? 'تم التعديل' : 'تم الإضافة', description: 'تم حفظ الجلسة' });
    setSessionDialog(false);
    fetchSessions(sessionTargetAccount!.id);
  };

  const deleteSession = async () => {
    if (!deleteSessionDialog) return;
    const { error } = await supabase.from('platform_account_sessions').delete().eq('id', deleteSessionDialog.session.id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف', description: 'تم حذف الجلسة' });
    const accId = deleteSessionDialog.accountId;
    setDeleteSessionDialog(null);
    fetchSessions(accId);
  };

  // ── Auto-fill residency from employee ─────────────────────────────────────

  const handleResidencyEmployeeChange = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    setAccountForm(prev => ({
      ...prev,
      residency_employee_id: empId === 'manual' ? null : empId,
      residency_holder_name: emp ? emp.name : prev.residency_holder_name,
      residency_expiry: emp?.residency_expiry ?? prev.residency_expiry,
    }));
  };

  // ── Filtered accounts ──────────────────────────────────────────────────────

  const filtered = accounts.filter(a => {
    const matchSearch = !search || a.account_name.includes(search) || (a.account_external_id ?? '').includes(search) || (a.residency_holder_name ?? '').includes(search);
    const matchApp = filterApp === 'all' || a.app_id === filterApp;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchApp && matchStatus;
  });

  const activeCount = accounts.filter(a => a.status === 'active').length;
  const urgentCount = accounts.filter(a => {
    if (!a.residency_expiry) return false;
    return differenceInDays(parseISO(a.residency_expiry), new Date()) <= 14;
  }).length;

  // ─────────────────────────────────────────────────────────────────────────

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
              <Users size={20} /> حسابات المنصات
            </h1>
            <p className="page-subtitle">
              {loading ? 'جارٍ التحميل...' : `${accounts.length} حساب — ${activeCount} نشط`}
              {urgentCount > 0 && <span className="text-destructive mr-2 font-semibold">· {urgentCount} إقامة قريبة الانتهاء</span>}
            </p>
          </div>
          {canEdit && (
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
          <p className="text-3xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="stat-card border-r-4 border-r-destructive">
          <p className="text-sm text-muted-foreground">إقامات قريبة الانتهاء</p>
          <p className="text-3xl font-bold text-destructive mt-1">{urgentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">خلال 14 يوم</p>
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
            placeholder="بحث باسم الحساب، ID، أو صاحب الإقامة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
        </div>
        <Select value={filterApp} onValueChange={setFilterApp}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="كل المنصات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المنصات</SelectItem>
            {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
        {(search || filterApp !== 'all' || filterStatus !== 'all') && (
          <Button variant="ghost" size="sm" className="gap-1 h-9 text-muted-foreground"
            onClick={() => { setSearch(''); setFilterApp('all'); setFilterStatus('all'); }}>
            <X size={13} /> مسح الفلاتر
          </Button>
        )}
      </div>

      {/* Accounts list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ds-card p-12 text-center text-muted-foreground">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد حسابات</p>
          <p className="text-sm mt-1">أضف حسابات المنصات من زر "إضافة حساب"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(account => {
            const expanded = expandedIds.has(account.id);
            const badge = residencyBadge(account.residency_expiry);
            const isSessionsLoading = sessionsLoading.has(account.id);

            return (
              <div key={account.id} className="ds-card overflow-hidden">
                {/* Account row */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--ds-surface-low)] transition-colors"
                  onClick={() => toggleExpand(account.id)}
                >
                  {/* Platform badge */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm"
                    style={{ background: account.app_color ?? '#6366f1', color: account.app_text_color ?? '#fff' }}
                  >
                    {account.app_name?.charAt(0) ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{account.account_name}</span>
                      {account.account_external_id && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {account.account_external_id}
                        </span>
                      )}
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: account.app_color + '22', color: account.app_color }}
                      >
                        {account.app_name}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${account.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground border-border'}`}>
                        {account.status === 'active' ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {account.residency_holder_name && (
                        <span className="text-xs text-muted-foreground">
                          الإقامة: <span className="font-medium text-foreground">{account.residency_holder_name}</span>
                        </span>
                      )}
                      {badge && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-primary"
                          title="إضافة جلسة" onClick={() => openAddSession(account)}>
                          <UserPlus size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          title="تعديل" onClick={() => openEditAccount(account)}>
                          <Edit size={14} />
                        </Button>
                      </>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        title="حذف" onClick={() => setDeleteAccountDialog(account)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                    {expanded ? <ChevronDown size={16} className="text-muted-foreground ml-1" /> : <ChevronRight size={16} className="text-muted-foreground ml-1" />}
                  </div>
                </div>

                {/* Sessions section */}
                {expanded && (
                  <div className="border-t border-[var(--ds-surface-container)] bg-[var(--ds-surface-low)] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Activity size={14} className="text-primary" />
                        سجل الجلسات (من شغّل الحساب)
                      </h3>
                      {canEdit && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => openAddSession(account)}>
                          <Plus size={12} /> إضافة جلسة
                        </Button>
                      )}
                    </div>

                    {isSessionsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={20} className="animate-spin text-primary" />
                      </div>
                    ) : !account.sessions || account.sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        لا توجد جلسات مسجّلة لهذا الحساب بعد
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {account.sessions.map(session => (
                          <div key={session.id} className="ds-card bg-white p-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {session.worker_name?.charAt(0) ?? '?'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{session.worker_name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <CalendarDays size={11} />
                                  من {format(parseISO(session.start_date), 'dd/MM/yyyy')}
                                  {session.end_date
                                    ? ` — إلى ${format(parseISO(session.end_date), 'dd/MM/yyyy')}`
                                    : ' — حتى الآن'
                                  }
                                </span>
                                {session.end_date && session.start_date && (
                                  <span className="text-primary font-medium">
                                    ({differenceInDays(parseISO(session.end_date), parseISO(session.start_date))} يوم)
                                  </span>
                                )}
                              </div>
                              {session.notes && (
                                <p className="text-xs text-muted-foreground mt-1">{session.notes}</p>
                              )}
                            </div>
                            {session.end_date === null && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                جارٍ الآن
                              </span>
                            )}
                            {canEdit && (
                              <div className="flex gap-1 flex-shrink-0">
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  onClick={() => openEditSession(session, account)}>
                                  <Edit size={13} />
                                </Button>
                                {canDelete && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                    onClick={() => setDeleteSessionDialog({ session, accountId: account.id })}>
                                    <Trash2 size={13} />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Account Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={accountDialog} onOpenChange={setAccountDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'تعديل حساب' : 'إضافة حساب منصة'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Platform */}
            <div className="space-y-1.5">
              <Label>المنصة <span className="text-destructive">*</span></Label>
              <Select value={accountForm.app_id} onValueChange={v => setAccountForm(p => ({ ...p, app_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة..." /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Account name */}
            <div className="space-y-1.5">
              <Label>اسم الحساب على المنصة <span className="text-destructive">*</span></Label>
              <Input
                placeholder="مثال: صلاح هنقر"
                value={accountForm.account_name ?? ''}
                onChange={e => setAccountForm(p => ({ ...p, account_name: e.target.value }))}
              />
            </div>

            {/* External ID */}
            <div className="space-y-1.5">
              <Label>معرّف الحساب (ID)</Label>
              <Input
                placeholder="الرقم أو المعرّف على المنصة"
                value={accountForm.account_external_id ?? ''}
                onChange={e => setAccountForm(p => ({ ...p, account_external_id: e.target.value }))}
                dir="ltr"
                className="text-left"
              />
            </div>

            {/* Residency — link to employee or manual */}
            <div className="space-y-1.5">
              <Label>صاحب الإقامة (مرتبط بمندوب)</Label>
              <Select
                value={accountForm.residency_employee_id ?? 'manual'}
                onValueChange={handleResidencyEmployeeChange}
              >
                <SelectTrigger><SelectValue placeholder="اختر مندوباً أو أدخل يدوياً..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">إدخال يدوي</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Residency holder name (manual) */}
            <div className="space-y-1.5">
              <Label>اسم صاحب الإقامة</Label>
              <Input
                placeholder="الاسم (لو غير مرتبط بمندوب في النظام)"
                value={accountForm.residency_holder_name ?? ''}
                onChange={e => setAccountForm(p => ({ ...p, residency_holder_name: e.target.value }))}
              />
            </div>

            {/* Residency expiry */}
            <div className="space-y-1.5">
              <Label>تاريخ انتهاء الإقامة</Label>
              <Input
                type="date"
                value={accountForm.residency_expiry ?? ''}
                onChange={e => setAccountForm(p => ({ ...p, residency_expiry: e.target.value }))}
              />
              {accountForm.residency_expiry && residencyBadge(accountForm.residency_expiry) && (
                <p className={`text-xs px-2 py-1 rounded ${residencyBadge(accountForm.residency_expiry)!.cls}`}>
                  {residencyBadge(accountForm.residency_expiry)!.label}
                </p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>حالة الحساب</Label>
              <Select value={accountForm.status} onValueChange={v => setAccountForm(p => ({ ...p, status: v as 'active' | 'inactive' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                placeholder="أي ملاحظات إضافية..."
                rows={2}
                value={accountForm.notes ?? ''}
                onChange={e => setAccountForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountDialog(false)}>إلغاء</Button>
            <Button onClick={saveAccount} disabled={savingAccount}>
              {savingAccount && <Loader2 size={14} className="animate-spin ml-2" />}
              {editingAccount ? 'حفظ التعديلات' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Session Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={sessionDialog} onOpenChange={setSessionDialog}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'تعديل جلسة' : 'إضافة جلسة'}
              {sessionTargetAccount && (
                <span className="text-muted-foreground font-normal text-sm mr-2">
                  — {sessionTargetAccount.account_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Worker */}
            <div className="space-y-1.5">
              <Label>المندوب الشغّال على الحساب <span className="text-destructive">*</span></Label>
              <Select
                value={sessionForm.worker_employee_id}
                onValueChange={v => setSessionForm(p => ({ ...p, worker_employee_id: v }))}
              >
                <SelectTrigger><SelectValue placeholder="اختر المندوب..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div className="space-y-1.5">
              <Label>تاريخ البداية <span className="text-destructive">*</span></Label>
              <Input
                type="date"
                value={sessionForm.start_date}
                onChange={e => setSessionForm(p => ({ ...p, start_date: e.target.value }))}
              />
            </div>

            {/* End date */}
            <div className="space-y-1.5">
              <Label>تاريخ النهاية (اتركه فارغاً لو لسه شغّال)</Label>
              <Input
                type="date"
                value={sessionForm.end_date}
                onChange={e => setSessionForm(p => ({ ...p, end_date: e.target.value }))}
              />
            </div>

            {/* Duration preview */}
            {sessionForm.start_date && sessionForm.end_date && (
              <p className="text-sm text-primary font-medium">
                المدة: {differenceInDays(parseISO(sessionForm.end_date), parseISO(sessionForm.start_date))} يوم
              </p>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea
                placeholder="ملاحظات عن الجلسة..."
                rows={2}
                value={sessionForm.notes}
                onChange={e => setSessionForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialog(false)}>إلغاء</Button>
            <Button onClick={saveSession} disabled={savingSession}>
              {savingSession && <Loader2 size={14} className="animate-spin ml-2" />}
              {editingSession ? 'حفظ التعديلات' : 'إضافة الجلسة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Account Confirm ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteAccountDialog} onOpenChange={o => !o && setDeleteAccountDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف حساب "{deleteAccountDialog?.account_name}"؟ سيتم حذف جميع الجلسات المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAccount} className="bg-destructive hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Session Confirm ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteSessionDialog} onOpenChange={o => !o && setDeleteSessionDialog(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذه الجلسة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSession}
              className="bg-destructive hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlatformAccounts;
