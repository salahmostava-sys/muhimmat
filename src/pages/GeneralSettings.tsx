import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/context/LanguageContext';
import { useSystemSettings } from '@/context/SystemSettingsContext';
import { useAuth } from '@/context/AuthContext';
import ProjectSettings from '@/components/settings/ProjectSettings';
import {
  Settings2, Database, Download, Loader2, History,
  Search, RefreshCw, ChevronLeft, ChevronRight, X, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';

/* ─── Activity Log types & constants ─── */
interface AuditLog {
  id: string;
  table_name: string;
  action: string;
  user_id: string | null;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  profile?: { name: string | null; email: string | null } | null;
}

const PAGE_SIZE = 25;

const actionColors: Record<string, string> = {
  INSERT: 'bg-success/10 text-success border-success/20',
  UPDATE: 'bg-warning/10 text-warning border-warning/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
};

const actionLabels: Record<string, { ar: string; en: string }> = {
  INSERT: { ar: 'إضافة', en: 'Create' },
  UPDATE: { ar: 'تعديل', en: 'Update' },
  DELETE: { ar: 'حذف', en: 'Delete' },
};

const tableLabels: Record<string, { ar: string; en: string }> = {
  employees: { ar: 'الموظفون', en: 'Employees' },
  attendance: { ar: 'الحضور', en: 'Attendance' },
  advances: { ar: 'السلف', en: 'Advances' },
  salary_records: { ar: 'الرواتب', en: 'Salaries' },
  daily_orders: { ar: 'الطلبات', en: 'Orders' },
  vehicles: { ar: 'المركبات', en: 'Vehicles' },
  vehicle_assignments: { ar: 'تسليم العهد', en: 'Vehicle Assignments' },
  alerts: { ar: 'التنبيهات', en: 'Alerts' },
  apps: { ar: 'التطبيقات', en: 'Apps' },
  profiles: { ar: 'الملفات الشخصية', en: 'Profiles' },
  user_roles: { ar: 'الأدوار', en: 'Roles' },
  user_permissions: { ar: 'الصلاحيات', en: 'Permissions' },
  system_settings: { ar: 'إعدادات النظام', en: 'System Settings' },
};

/* ─── Activity Log sub-component ─── */
function ActivityLogTab() {
  const { isRTL, lang } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction !== 'all') query = query.eq('action', filterAction);
      if (filterTable !== 'all') query = query.eq('table_name', filterTable);
      if (debouncedSearch.trim()) {
        query = query.or(`table_name.ilike.%${debouncedSearch}%,action.ilike.%${debouncedSearch}%,record_id.ilike.%${debouncedSearch}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds);
        profiles?.forEach(p => { profileMap[p.id] = { name: p.name, email: p.email }; });
      }

      setLogs((data || []).map(l => ({
        ...l,
        old_value: l.old_value as Record<string, unknown> | null,
        new_value: l.new_value as Record<string, unknown> | null,
        profile: l.user_id ? profileMap[l.user_id] ?? null : null,
      })));
      setTotalCount(count || 0);
    } catch { setLogs([]); }
    setLoading(false);
  }, [page, filterAction, filterTable, debouncedSearch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(0); }, [filterAction, filterTable, debouncedSearch]);

  const handleExport = async () => {
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(1000);
    if (!data) return;
    const rows = data.map(l => ({
      [lang === 'ar' ? 'التاريخ' : 'Date']: format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
      [lang === 'ar' ? 'الجدول' : 'Table']: l.table_name,
      [lang === 'ar' ? 'العملية' : 'Action']: l.action,
      [lang === 'ar' ? 'معرف المستخدم' : 'User ID']: l.user_id || '',
      [lang === 'ar' ? 'معرف السجل' : 'Record ID']: l.record_id || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
    XLSX.writeFile(wb, `activity_log_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const getActionLabel = (action: string) => actionLabels[action]?.[lang as 'ar' | 'en'] || action;
  const getTableLabel = (table: string) => tableLabels[table]?.[lang as 'ar' | 'en'] || table;
  const activeFilters = [filterAction !== 'all', filterTable !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {lang === 'ar' ? `${totalCount.toLocaleString()} سجل محفوظ` : `${totalCount.toLocaleString()} records`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={fetchLogs}>
            <RefreshCw size={13} /> {lang === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExport}>
            <Download size={13} /> {lang === 'ar' ? 'تصدير' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-muted/30 rounded-xl border border-border/50 p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث...' : 'Search...'}
            className={`h-8 text-sm ${isRTL ? 'pr-8' : 'pl-8'}`} />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === 'ar' ? 'كل العمليات' : 'All Actions'}</SelectItem>
            <SelectItem value="INSERT">{lang === 'ar' ? 'إضافة' : 'Create'}</SelectItem>
            <SelectItem value="UPDATE">{lang === 'ar' ? 'تعديل' : 'Update'}</SelectItem>
            <SelectItem value="DELETE">{lang === 'ar' ? 'حذف' : 'Delete'}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{lang === 'ar' ? 'كل الجداول' : 'All Tables'}</SelectItem>
            {Object.entries(tableLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label[lang as 'ar' | 'en']}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <button onClick={() => { setFilterAction('all'); setFilterTable('all'); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
            <X size={12} /> {lang === 'ar' ? 'مسح' : 'Clear'}
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px]">{activeFilters}</Badge>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {[
                  lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time',
                  lang === 'ar' ? 'المستخدم' : 'User',
                  lang === 'ar' ? 'العملية' : 'Action',
                  lang === 'ar' ? 'الوحدة' : 'Module',
                  lang === 'ar' ? 'التفاصيل' : 'Details',
                ].map((h, i) => (
                  <th key={i} className={`p-3 text-xs font-semibold text-muted-foreground whitespace-nowrap ${i === 2 ? 'text-center' : isRTL ? 'text-right' : 'text-left'} ${i === 4 ? 'hidden lg:table-cell' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-3 text-center"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-36" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Activity size={32} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">{lang === 'ar' ? 'لا توجد سجلات' : 'No records found'}</p>
                  </td>
                </tr>
              ) : logs.map(log => (
                <tr key={log.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3 whitespace-nowrap">
                    <p className="text-xs font-medium text-foreground" dir="ltr">{format(new Date(log.created_at), 'yyyy-MM-dd')}</p>
                    <p className="text-[10px] text-muted-foreground" dir="ltr">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                  </td>
                  <td className="p-3">
                    {log.profile ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">
                          {(log.profile.name || log.profile.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{log.profile.name || '—'}</p>
                          <p className="text-[10px] text-muted-foreground" dir="ltr">{log.profile.email || ''}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{lang === 'ar' ? 'النظام' : 'System'}</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionColors[log.action] || 'bg-muted text-muted-foreground border-border'}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-medium text-foreground">{getTableLabel(log.table_name)}</span>
                    <p className="text-[10px] text-muted-foreground font-mono">{log.table_name}</p>
                  </td>
                  <td className="p-3 hidden lg:table-cell max-w-xs">
                    {log.new_value && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]" title={JSON.stringify(log.new_value)}>
                        {Object.entries(log.new_value).slice(0, 2).map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 20)}`).join(' | ')}
                      </p>
                    )}
                    {log.record_id && (
                      <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5" dir="ltr">{log.record_id.slice(0, 8)}...</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {lang === 'ar'
                ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} من ${totalCount}`
                : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount}`}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/50 disabled:opacity-40 hover:bg-muted transition-colors">
                {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-border/50 disabled:opacity-40 hover:bg-muted transition-colors">
                {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function GeneralSettings() {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  const { projectName } = useSystemSettings();
  const { role } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isRTL = lang === 'ar';
  const initialTab = searchParams.get('tab') === 'activity' ? 'activity' : 'settings';
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);

  document.title = `${projectName} | ${isRTL ? 'الإعدادات العامة' : 'General Settings'}`;

  const TABLES = [
    'employees', 'attendance', 'advances', 'advance_installments',
    'daily_orders', 'employee_apps', 'apps', 'salary_schemes',
    'salary_records', 'external_deductions', 'vehicles', 'vehicle_assignments',
  ];

  const fetchAllTables = async () => {
    const allData: Record<string, any[]> = {};
    for (const table of TABLES) {
      const { data } = await supabase.from(table as any).select('*');
      allData[table] = data || [];
    }
    return allData;
  };

  const handleBackupExcel = async () => {
    setLoadingExcel(true);
    const allData = await fetchAllTables();
    const wb = XLSX.utils.book_new();
    for (const table of TABLES) {
      const rows = allData[table];
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
    }
    XLSX.writeFile(wb, `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
    setLoadingExcel(false);
    toast({ title: `✅ ${isRTL ? 'تم تصدير ملف Excel بنجاح' : 'Excel backup downloaded'}` });
  };

  const handleBackupJson = async () => {
    setLoadingJson(true);
    const allData = await fetchAllTables();
    const jsonBlob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(jsonBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setLoadingJson(false);
    toast({ title: `✅ ${isRTL ? 'تم تصدير ملف JSON بنجاح' : 'JSON backup downloaded'}` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Settings2 size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? 'الإعدادات العامة' : 'General Settings'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isRTL ? 'إدارة اسم المشروع والشعار والمظهر وسجل النشاطات' : 'Manage project settings and activity log'}
          </p>
        </div>
      </div>

      <Tabs defaultValue={initialTab} dir={isRTL ? 'rtl' : 'ltr'}>
        <TabsList className="mb-4">
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 size={14} />
            {isRTL ? 'الإعدادات' : 'Settings'}
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History size={14} />
            {isRTL ? 'سجل النشاطات' : 'Activity Log'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <ProjectSettings />

          {/* Admin-only Backup Section */}
          {role === 'admin' && (
            <div className="bg-card border border-border/50 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center text-warning">
                  <Database size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {isRTL ? 'النسخ الاحتياطي' : 'System Backup'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? `تصدير ${TABLES.length} جداول — اختر الصيغة المناسبة` : `Export ${TABLES.length} tables — choose format`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleBackupExcel} disabled={loadingExcel || loadingJson} variant="outline" className="gap-2">
                  {loadingExcel ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {isRTL ? 'تحميل Excel' : 'Download Excel'}
                </Button>
                <Button onClick={handleBackupJson} disabled={loadingExcel || loadingJson} variant="outline" className="gap-2">
                  {loadingJson ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  {isRTL ? 'تحميل JSON' : 'Download JSON'}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
