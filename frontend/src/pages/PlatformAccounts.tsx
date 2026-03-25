import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useMonthlyActiveEmployeeIds } from '@/hooks/useMonthlyActiveEmployeeIds';
import { filterVisibleEmployeesInMonth } from '@/lib/employeeVisibility';
import { GlobalTableFilters, createDefaultGlobalFilters } from '@/components/table/GlobalTableFilters';
import { usePlatformAccountsPaged } from '@/hooks/usePlatformAccountsPaged';
import { Skeleton } from '@/components/ui/skeleton';
import { auditService } from '@/services/auditService';
import * as XLSX from '@e965/xlsx';
import type { BranchKey } from '@/components/table/GlobalTableFilters';
import { ColorBadge } from '@/components/ui/ColorBadge';
import {
  platformAccountService,
  type PlatformApp as App,
  type PlatformEmployee as Employee,
  type PlatformAccountWritePayload,
} from '@/services/platformAccountService';
import {
  accountAssignmentService,
  type AccountAssignment as Assignment,
} from '@/services/accountAssignmentService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AssignmentWithName = Assignment & { employee_name?: string };

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
  assignments?: AssignmentWithName[];
  /** عدد سجلات التعيين المسجّلة على الشهر الحالي (قد يكون >1 إذا تعاقب عدة مناديب) */
  assignments_this_month_count?: number;
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
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: perms } = usePermissions('platform_accounts');
  const { settings } = useSystemSettings();
  const alertDays = settings?.iqama_alert_days ?? 90;
  const monthYearNow = format(new Date(), 'yyyy-MM');
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthYearNow);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const {
    data: pageData,
    isLoading: loading,
    error: pageDataError,
    refetch: refetchPageData,
  } = useQuery({
    queryKey: ['platform-accounts', uid, 'page-data'],
    enabled,
    queryFn: async () => {
      const [appsRes, empRes, accRes, assignRes, monthAssignRes] = await Promise.all([
        platformAccountService.getApps(),
        platformAccountService.getEmployees(),
        platformAccountService.getAccounts(),
        accountAssignmentService.getActiveAssignments(),
        accountAssignmentService.getAssignmentsForMonthYear(monthYearNow),
      ]);

      const appsData: App[] = (appsRes.data ?? []) as App[];
      const empData: Employee[] = (empRes.data ?? []) as Employee[];
      const rawAccounts = (accRes.data ?? []) as PlatformAccount[];
      const activeAssignments = (assignRes.data ?? []) as Assignment[];
      const monthRows = (monthAssignRes.data ?? []) as { account_id: string }[];

      const countByAccount = new Map<string, number>();
      monthRows.forEach((r) => {
        countByAccount.set(r.account_id, (countByAccount.get(r.account_id) ?? 0) + 1);
      });

      const appMap = Object.fromEntries(appsData.map((a) => [a.id, a]));
      const empMap = Object.fromEntries(empData.map((e) => [e.id, e]));

      const enriched: PlatformAccount[] = rawAccounts.map((a) => {
        const active = activeAssignments.find((x) => x.account_id === a.id);
        return {
          ...a,
          app_name: appMap[a.app_id]?.name ?? '—',
          app_color: appMap[a.app_id]?.brand_color ?? '#6366f1',
          app_text_color: appMap[a.app_id]?.text_color ?? '#ffffff',
          current_employee: active ? empMap[active.employee_id] ?? null : null,
          assignments_this_month_count: countByAccount.get(a.id) ?? 0,
        };
      });

      return { appsData, empData, enriched };
    },
    retry: 2,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [groupAppTab, setGroupAppTab] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'detailed' | 'fast'>('detailed');

  // Fast list state (server-side pagination)
  const [fastPage, setFastPage] = useState(1);
  const [fastPageSize] = useState(30);
  const [fastFilters, setFastFilters] = useState(() => createDefaultGlobalFilters());

  type SortKey = 'account_username' | 'account_id_on_platform' | 'iqama_number' | 'iqama_expiry_date' | 'current_employee' | 'assignments_month' | 'status';
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

  useEffect(() => {
    if (!pageData) return;
    setApps(pageData.appsData);
    setEmployees(filterVisibleEmployeesInMonth(pageData.empData, activeEmployeeIdsInMonth));
    setAccounts(pageData.enriched);
  }, [pageData, activeEmployeeIdsInMonth]);

  useEffect(() => {
    if (!pageDataError) return;
    const message = pageDataError instanceof Error ? pageDataError.message : 'تعذر تحميل البيانات';
    toast({ title: 'خطأ', description: message, variant: 'destructive' });
  }, [pageDataError, toast]);

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
          case 'assignments_month':
            return x.assignments_this_month_count ?? 0;
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
      ({ error } = await platformAccountService.updateAccount(editingAccount.id, payload));
      if (!error) {
        await auditService.logAdminAction({
          action: 'platform_accounts.update',
          table_name: 'platform_accounts',
          record_id: editingAccount.id,
          meta: { fields: Object.keys(payload), app_id: payload.app_id, status: payload.status },
        });
      }
    } else {
      const res = await platformAccountService.createAccount(payload);
      error = res.error;
      const createdId =
        Array.isArray(res.data) && typeof (res.data as unknown[])[0] === 'object' && (res.data as unknown[])[0] !== null
          ? (res.data as Array<{ id?: unknown }>)[0]?.id
          : null;
      const createdIdStr = typeof createdId === 'string' ? createdId : null;
      if (!error) {
        await auditService.logAdminAction({
          action: 'platform_accounts.create',
          table_name: 'platform_accounts',
          record_id: createdIdStr,
          meta: { account_username: payload.account_username, app_id: payload.app_id, status: payload.status },
        });
      }
    }

    setSavingAccount(false);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editingAccount ? 'تم التعديل' : 'تم الإضافة', description: `حساب "${payload.account_username}"` });
    setAccountDialog(false);
    void refetchPageData();
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
    const { data: open } = await accountAssignmentService.getOpenAssignmentIdsByAccount(assignTarget!.id);

    if (open && open.length > 0) {
      const openRows = open as Array<{ id: string }>;
      await accountAssignmentService.closeAssignmentsByIds(openRows.map((x) => x.id), today);
    }

    // 2. Insert new assignment
    const { error } = await accountAssignmentService.createAssignment({
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
    const { error: linkErr } = await platformAccountService.syncAccountEmployee(assignTarget!.id, assignForm.employee_id);

    if (linkErr) {
      setSavingAssign(false);
      toast({ title: 'خطأ', description: linkErr.message, variant: 'destructive' });
      return;
    }

    await auditService.logAdminAction({
      action: 'platform_account_assignments.create',
      table_name: 'platform_accounts',
      record_id: assignTarget!.id,
      meta: {
        employee_id: assignForm.employee_id,
        start_date: assignForm.start_date,
        month_year: monthYear,
        notes: assignForm.notes?.trim() || null,
      },
    });

    setSavingAssign(false);
    toast({ title: 'تم التعيين', description: 'تم تعيين المندوب بنجاح' });
    setAssignDialog(false);
    void refetchPageData();
  };

  // ── History ────────────────────────────────────────────────────────────────

  const openHistory = async (account: PlatformAccount) => {
    setHistoryAccount(account);
    setHistoryDialog(true);
    setHistoryLoading(true);

    const { data } = await accountAssignmentService.getHistoryByAccountId(account.id);
    await auditService.logAdminAction({
      action: 'platform_account_assignments.view_history',
      table_name: 'platform_accounts',
      record_id: account.id,
      meta: { count: Array.isArray(data) ? data.length : 0 },
    });

    const empMap = Object.fromEntries(employees.map(e => [e.id, e.name]));
    const assignments: AssignmentWithName[] = ((data ?? []) as Assignment[]).map(r => ({
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
        <Tabs value={viewMode} onValueChange={(v) => { setViewMode(v as 'detailed' | 'fast'); }} dir="rtl">
          <TabsList className="h-9">
            <TabsTrigger value="detailed" className="text-xs">تفصيلي</TabsTrigger>
            <TabsTrigger value="fast" className="text-xs">قائمة (سريعة)</TabsTrigger>
          </TabsList>
        </Tabs>

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
            onClick={() => {
              setSearch('');
              setFilterStatus('all');
              setGroupAppTab('all');
              setFastFilters(createDefaultGlobalFilters());
              setFastPage(1);
            }}>
            <X size={13} /> مسح
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      ) : viewMode === 'fast' ? (
        <PlatformAccountsFastList
          apps={apps}
          employees={employees}
          alertDays={alertDays}
          page={fastPage}
          pageSize={fastPageSize}
          filters={{
            driverId: fastFilters.driverId || undefined,
            platformAppId: fastFilters.platformAppId || undefined,
            branch: fastFilters.branch || 'all',
            search: fastFilters.search || undefined,
            status: (filterStatus as 'all' | 'active' | 'inactive'),
          }}
          onFiltersChange={(next) => {
            setFastFilters((p) => ({ ...p, ...next }));
            setFastPage(1);
          }}
          onPageChange={setFastPage}
        />
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
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('account_username')}>
                            اسم الحساب {sortKey === 'account_username' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('account_id_on_platform')}>
                            رقم الحساب {sortKey === 'account_id_on_platform' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('iqama_number')}>
                            رقم الإقامة {sortKey === 'iqama_number' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('iqama_expiry_date')}>
                            انتهاء الإقامة {sortKey === 'iqama_expiry_date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('current_employee')}>
                            المندوب الحالي {sortKey === 'current_employee' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none max-w-[7rem]" onClick={() => toggleSort('assignments_month')} title="عدد مرات تسجيل تعيين على الشهر الحالي (تعاقب عدة مناديب)">
                            تعيينات الشهر {sortKey === 'assignments_month' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="text-center font-semibold px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                            الحالة {sortKey === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                          </th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sorted.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-10 text-center text-muted-foreground">
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
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`text-xs font-semibold tabular-nums ${(acc.assignments_this_month_count ?? 0) > 1 ? 'text-primary' : 'text-muted-foreground'}`}
                                    title="عدد سجلات التعيين المسجّلة لهذا الشهر (شهر واحد قد يشمل عدة مناديب بالتتابع)"
                                  >
                                    {acc.assignments_this_month_count ?? 0}
                                  </span>
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              بيانات الحساب على المنصة ثابتة (اسم صاحب الحساب، الإقامة المسجّلة على الحساب). المندوب الحالي يُدار من «تعيين» أو يظهر من آخر تعيين نشط؛ ويمكن أن يتعاقب عدة مناديب على نفس الحساب خلال الشهر.
            </p>
            <div className="space-y-1.5">
              <Label>المنصة</Label>
              <Select value={accountForm.app_id ?? ''} onValueChange={v => setAccountForm(p => ({ ...p, app_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة" /></SelectTrigger>
                <SelectContent>
                  {apps.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground">بيانات الحساب على المنصة</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>اسم صاحب الحساب (كما يظهر على المنصة)</Label>
                  <Input value={accountForm.account_username ?? ''} onChange={e => setAccountForm(p => ({ ...p, account_username: e.target.value }))} placeholder="اسم المستخدم / صاحب الحساب" />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم الحساب (ID على المنصة)</Label>
                  <Input value={accountForm.account_id_on_platform ?? ''} onChange={e => setAccountForm(p => ({ ...p, account_id_on_platform: e.target.value }))} placeholder="رقم الحساب" dir="ltr" />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold text-foreground">بيانات الإقامة المسجّلة على الحساب</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>رقم الإقامة</Label>
                  <Input value={accountForm.iqama_number ?? ''} onChange={e => setAccountForm(p => ({ ...p, iqama_number: e.target.value }))} placeholder="1xxxxxxxxx" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ انتهاء الإقامة</Label>
                  <Input type="date" value={accountForm.iqama_expiry_date ?? ''} onChange={e => setAccountForm(p => ({ ...p, iqama_expiry_date: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>اقتراح من بيانات مندوب (اختياري)</Label>
              <p className="text-[11px] text-muted-foreground mb-1">
                عند اختيار مندوب يُعبّأ تلقائياً <strong>رقم الإقامة</strong> و<strong>تاريخ انتهاء الإقامة</strong> من ملفه الموظّف؛ عدّل الحقلين إذا كانت إقامة الحساب على المنصة ليست نفس إقامة المندوب.
              </p>
              <Select
                value={(accountForm.employee_id ?? null) ? String(accountForm.employee_id) : '__none__'}
                onValueChange={v => {
                  const id = v === '__none__' ? null : v;
                  setAccountForm(p => {
                    const emp = id ? employees.find(e => e.id === id) : null;
                    return {
                      ...p,
                      employee_id: id,
                      ...(emp
                        ? {
                            iqama_number: emp.national_id?.trim() || p.iqama_number || '',
                            iqama_expiry_date: emp.residency_expiry
                              ? String(emp.residency_expiry).slice(0, 10)
                              : p.iqama_expiry_date,
                          }
                        : {}),
                    };
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختياري — لاستيراد الإقامة من ملف الموظف" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون اختيار —</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              نفس الحساب قد يعمل عليه <span className="font-semibold text-foreground">عدة مناديب خلال الشهر</span> بالتتابع: كل تعيين جديد يُغلق التعيين السابق ويُفتح سجل جديد. يظهر في الجدول عمود «تعيينات الشهر» لعدد مرات التسجيل في الشهر الحالي.
            </p>
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
              {assignForm.employee_id && (() => {
                const e = employees.find(x => x.id === assignForm.employee_id);
                if (!e?.national_id && !e?.residency_expiry) return null;
                return (
                  <p className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                    {e.national_id && (
                      <span className="block">رقم الإقامة في ملف الموظف: <span className="font-mono dir-ltr inline-block">{e.national_id}</span></span>
                    )}
                    {e.residency_expiry && (
                      <span className="block">انتهاء الإقامة (ملف الموظف): <span className="font-medium">{format(parseISO(String(e.residency_expiry).slice(0, 10)), 'dd/MM/yyyy')}</span></span>
                    )}
                  </p>
                );
              })()}
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
              <div className="space-y-4">
                {(() => {
                  const rows = historyAccount.assignments ?? [];
                  const byMonth = new Map<string, typeof rows>();
                  rows.forEach((a) => {
                    const my = a.month_year || '—';
                    if (!byMonth.has(my)) byMonth.set(my, []);
                    byMonth.get(my)!.push(a);
                  });
                  const sortedMonths = Array.from(byMonth.keys()).sort((x, y) => y.localeCompare(x));
                  return sortedMonths.map((month) => (
                    <div key={month} className="space-y-2">
                      <p className="text-xs font-bold text-foreground border-b border-border pb-1">
                        شهر {month} — {byMonth.get(month)!.length} تعيين
                        {byMonth.get(month)!.length > 1 && (
                          <span className="font-normal text-muted-foreground mr-2"> (تعاقب عدة مناديب على نفس الحساب)</span>
                        )}
                      </p>
                      {byMonth.get(month)!.map((a) => (
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
                            </p>
                            {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{a.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformAccounts;

function PlatformAccountsFastList(props: {
  apps: App[];
  employees: Employee[];
  alertDays: number;
  page: number;
  pageSize: number;
  filters: {
    driverId?: string;
    platformAppId?: string;
    branch?: BranchKey;
    search?: string;
    status?: 'all' | 'active' | 'inactive';
  };
  onFiltersChange: (next: Partial<ReturnType<typeof createDefaultGlobalFilters>>) => void;
  onPageChange: (p: number) => void;
}) {
  const { apps, employees, alertDays, page, pageSize, filters, onFiltersChange, onPageChange } = props;

  const { data, isLoading } = usePlatformAccountsPaged({
    page,
    pageSize,
    filters: {
      driverId: filters.driverId,
      platformAppId: filters.platformAppId,
      branch: filters.branch,
      search: filters.search,
      status: filters.status,
    },
  });

  type PagedRow = {
    id: string;
    app_id: string;
    employee_id: string | null;
    account_username: string;
    account_id_on_platform: string | null;
    iqama_number: string | null;
    iqama_expiry_date: string | null;
    status: 'active' | 'inactive';
    notes: string | null;
    created_at: string;
    apps?: { id: string; name: string; brand_color: string | null; text_color: string | null } | null;
    employees?: { id: string; name: string; city: string | null } | null;
  };
  const paged = data as unknown as { data?: PagedRow[]; count?: number } | undefined;
  const rows = paged?.data || [];
  const total = paged?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await platformAccountService.exportAccounts({
        filters: {
          employeeId: filters.driverId,
          appId: filters.platformAppId,
          branch: filters.branch && filters.branch !== 'all' ? filters.branch : undefined,
          status: filters.status && filters.status !== 'all' ? filters.status : undefined,
          search: filters.search,
        },
      });
      if (res.error) throw res.error;

      const out = (res.data || []) as PagedRow[];
      const sheet = out.map((r) => ({
        'اسم الحساب': r.account_username ?? '',
        'المنصة': r.apps?.name ?? '',
        'المندوب': r.employees?.name ?? '',
        'الفرع': r.employees?.city ?? '',
        'رقم الحساب على المنصة': r.account_id_on_platform ?? '',
        'رقم الإقامة': r.iqama_number ?? '',
        'انتهاء الإقامة': r.iqama_expiry_date ?? '',
        'الحالة': r.status ?? '',
        'ملاحظات': r.notes ?? '',
        'تاريخ الإنشاء': r.created_at ?? '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(sheet);
      XLSX.utils.book_append_sheet(wb, ws, 'PlatformAccounts');
      XLSX.writeFile(wb, `platform-accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await auditService.logAdminAction({
        action: 'platform_accounts.export',
        table_name: 'platform_accounts',
        record_id: null,
        meta: { total: out.length, filters },
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="ds-card p-3">
        <GlobalTableFilters
          value={{
            ...createDefaultGlobalFilters(),
            driverId: filters.driverId || '',
            platformAppId: filters.platformAppId || '',
            branch: filters.branch || 'all',
            search: filters.search || '',
          }}
          onChange={(next) => onFiltersChange(next)}
          onReset={() => onFiltersChange(createDefaultGlobalFilters())}
          options={{
            drivers: employees.map((e) => ({ id: e.id, name: e.name })),
            platforms: apps.map((a) => ({ id: a.id, name: a.name })),
            enableBranch: true,
            enableDriver: true,
            enablePlatform: true,
            enableDateRange: false,
          }}
        />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">{total.toLocaleString()} نتيجة</div>
        <Button size="sm" variant="outline" className="h-8 gap-2" onClick={exportExcel} disabled={exporting}>
          {exporting && <Loader2 size={14} className="animate-spin" />}
          تصدير Excel
        </Button>
      </div>

      <div className="ds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-center font-semibold px-4 py-3">الحساب</th>
                <th className="text-center font-semibold px-4 py-3">المنصة</th>
                <th className="text-center font-semibold px-4 py-3">المندوب</th>
                <th className="text-center font-semibold px-4 py-3">انتهاء الإقامة</th>
                <th className="text-center font-semibold px-4 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
                : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      لا توجد نتائج
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const app = r.apps;
                    const emp = r.employees;
                    const badge = iqamaBadge(r.iqama_expiry_date, alertDays);
                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold">{r.account_username}</td>
                        <td className="px-4 py-3">
                          <ColorBadge
                            label={app?.name || '—'}
                            bg={app?.brand_color || '#6366f1'}
                            fg={app?.text_color || '#ffffff'}
                          />
                        </td>
                        <td className="px-4 py-3">{emp?.name || '—'}</td>
                        <td className="px-4 py-3">
                          {badge ? (
                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${r.status === 'active' ? 'bg-success/10 text-success border-success/20' : 'bg-muted text-muted-foreground border-border'}`}>
                            {r.status === 'active' ? 'نشط' : 'غير نشط'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs">
          <div className="text-muted-foreground">
            {total.toLocaleString()} نتيجة
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              السابق
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
