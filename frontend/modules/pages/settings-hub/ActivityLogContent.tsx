import { useState, useEffect, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@app/providers/LanguageContext';
import {
  Search, RefreshCw, X, Activity, FolderOpen,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Badge } from '@shared/components/ui/badge';
import { Skeleton } from '@shared/components/ui/skeleton';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { settingsHubService } from '@services/settingsHubService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';

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
  employees:            { ar: 'الموظفون', en: 'Employees' },
  attendance:           { ar: 'الحضور', en: 'Attendance' },
  advances:             { ar: 'السلف', en: 'Advances' },
  salary_records:       { ar: 'الرواتب', en: 'Salaries' },
  daily_orders:         { ar: 'الطلبات', en: 'Orders' },
  vehicles:             { ar: 'المركبات', en: 'Vehicles' },
  vehicle_assignments:  { ar: 'تسليم العهد', en: 'Vehicle Assignments' },
  alerts:               { ar: 'التنبيهات', en: 'Alerts' },
  apps:                 { ar: 'التطبيقات', en: 'Apps' },
  profiles:             { ar: 'الملفات الشخصية', en: 'Profiles' },
  user_roles:           { ar: 'الأدوار', en: 'Roles' },
  user_permissions:     { ar: 'الصلاحيات', en: 'Permissions' },
  system_settings:      { ar: 'إعدادات النظام', en: 'System Settings' },
};

const toShortText = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > 28 ? `${str.slice(0, 28)}...` : str;
};

const buildChangeSummary = (log: AuditLog) => {
  const oldV = log.old_value || {};
  const newV = log.new_value || {};
  if (log.action === 'INSERT') {
    return Object.entries(newV).slice(0, 3).map(([k, v]) => `${k}: ${toShortText(v)}`).join(' | ');
  }
  if (log.action === 'DELETE') {
    return Object.entries(oldV).slice(0, 3).map(([k, v]) => `${k}: ${toShortText(v)}`).join(' | ');
  }
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const changed = keys
    .filter((k) => JSON.stringify(oldV[k]) !== JSON.stringify(newV[k]))
    .slice(0, 3)
    .map((k) => `${k}: ${toShortText(oldV[k])} → ${toShortText(newV[k])}`);
  return changed.join(' | ');
};

const formatJson = (obj: Record<string, unknown> | null) => {
  if (!obj || Object.keys(obj).length === 0) return '—';
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    console.error('[ActivityLog] formatJson failed', e);
    return '[unserializable-object]';
  }
};

const getHeaderAlignmentClass = (index: number, isRTL: boolean) => {
  if (index === 2) return 'text-center';
  return isRTL ? 'text-right' : 'text-left';
};

const SKELETON_ROWS = [
  'activity-skeleton-row-1',
  'activity-skeleton-row-2',
  'activity-skeleton-row-3',
  'activity-skeleton-row-4',
  'activity-skeleton-row-5',
  'activity-skeleton-row-6',
] as const;

const hasPayload = (log: AuditLog) =>
  Boolean(
    (log.old_value && Object.keys(log.old_value).length > 0) ||
      (log.new_value && Object.keys(log.new_value).length > 0)
  );

export default function ActivityLogContent() {
  const { isRTL } = useLanguage();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data: logsData,
    isLoading: loading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['activity-log', uid, page, filterAction, filterTable, debouncedSearch],
    enabled,
    queryFn: async () => {
      const { rows: data, total: count } = await settingsHubService.getAuditLogs(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1,
        filterAction,
        filterTable,
        debouncedSearch
      );

      const userIds = [...new Set((data || []).map((l) => l.user_id).filter(Boolean))] as string[];
      const profileMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const profiles = await settingsHubService.getAuditProfilesByIds(userIds);
        profiles.forEach((p) => { profileMap[p.id] = { name: p.name, email: p.email }; });
      }

      return {
        rows: (data || []).map((l) => ({
          ...l,
          old_value: l.old_value as Record<string, unknown> | null,
          new_value: l.new_value as Record<string, unknown> | null,
          profile: l.user_id ? profileMap[l.user_id] ?? null : null,
        })),
        total: count || 0,
      };
    },
    retry: defaultQueryRetry,
    staleTime: 15_000,
  });

  useEffect(() => {
    setLogs(logsData?.rows || []);
    setTotalCount(logsData?.total || 0);
  }, [logsData]);
  useEffect(() => { setPage(0); }, [filterAction, filterTable, debouncedSearch]);
  useEffect(() => { setExpandedId(null); }, [page]);

  const handleExport = async () => {
    const data = await settingsHubService.getAuditLogsForExport();
    if (!data.length) return;
    const rows = data.map(l => ({
      'التاريخ': format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss'),
      'الجدول': l.table_name,
      'العملية': l.action,
      'معرف المستخدم': l.user_id || '',
      'معرف السجل': l.record_id || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
    XLSX.writeFile(wb, `activity_log_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const getActionLabel = (action: string) => actionLabels[action]?.ar || action;
  const getTableLabel = (table: string) => tableLabels[table]?.ar || table;
  const activeFilters = [filterAction !== 'all', filterTable !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-5" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Section header */}
      <div className="flex items-center gap-3 pb-4" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(38,66,230,0.08)', color: '#2642e6' }}>
          <Activity size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--ds-on-surface)' }}>
            سجل النشاطات
          </h2>
          <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
            {`${totalCount.toLocaleString()} سجل محفوظ`}
          </p>
        </div>
        <div className="flex items-center gap-2 mr-auto">
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => void refetchLogs()}>
            <RefreshCw size={13} /> تحديث
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <FolderOpen size={13} /> ملفات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-3 flex flex-wrap items-center gap-3"
        style={{ background: 'var(--ds-surface-low)' }}
      >
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            className={`h-8 text-sm ${isRTL ? 'pr-8' : 'pl-8'}`}
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العمليات</SelectItem>
            <SelectItem value="INSERT">إضافة</SelectItem>
            <SelectItem value="UPDATE">تعديل</SelectItem>
            <SelectItem value="DELETE">حذف</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الجداول</SelectItem>
            {Object.entries(tableLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label.ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activeFilters > 0 && (
          <button
            onClick={() => { setFilterAction('all'); setFilterTable('all'); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={12} /> مسح
            <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[9px]">
              {activeFilters}
            </Badge>
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--ds-surface-low)', borderBottom: '1px solid var(--ds-surface-container)' }}>
                {[
                  'التاريخ والوقت',
                  'المستخدم',
                  'العملية',
                  'الوحدة',
                  'التفاصيل',
                ].map((h, i) => (
                  <th
                    key={`activity-header-${h}`}
                    className={`p-3 text-xs font-semibold whitespace-nowrap ${getHeaderAlignmentClass(i, isRTL)} ${i === 4 ? 'hidden lg:table-cell' : ''}`}
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: 'var(--ds-surface-lowest)' }}>
              {loading && SKELETON_ROWS.map((skeletonKey) => (
                <tr key={skeletonKey} style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                  <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="p-3 text-center"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-36" /></td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <Activity size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--ds-on-surface-variant)' }} />
                    <p className="text-sm" style={{ color: 'var(--ds-on-surface-variant)' }}>
                      لا توجد سجلات
                    </p>
                  </td>
                </tr>
              )}
              {!loading && logs.length > 0 && logs.map(log => (
                    <Fragment key={log.id}>
                    <tr
                      style={{ borderBottom: expandedId === log.id ? 'none' : '1px solid var(--ds-surface-container)' }}
                      className={`transition-colors hover:bg-[var(--ds-surface-low)] ${expandedId === log.id ? 'bg-[var(--ds-surface-low)]' : ''} ${hasPayload(log) ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (!hasPayload(log)) return;
                        setExpandedId(expandedId === log.id ? null : log.id);
                      }}
                    >
                      <td className="p-3 whitespace-nowrap">
                        <p className="text-xs font-medium" style={{ color: 'var(--ds-on-surface)' }} dir="ltr">
                          {format(new Date(log.created_at), 'yyyy-MM-dd')}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--ds-on-surface-variant)' }} dir="ltr">
                          {format(new Date(log.created_at), 'HH:mm:ss')}
                        </p>
                      </td>
                      <td className="p-3">
                        {log.profile ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                              style={{ background: 'rgba(38,66,230,0.08)', color: '#2642e6' }}
                            >
                              {(log.profile.name || log.profile.email || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium" style={{ color: 'var(--ds-on-surface)' }}>{log.profile.name || '—'}</p>
                              <p className="text-[10px]" style={{ color: 'var(--ds-on-surface-variant)' }} dir="ltr">{log.profile.email || ''}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
                            النظام
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${actionColors[log.action] || 'bg-muted text-muted-foreground border-border'}`}>
                          {getActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-medium" style={{ color: 'var(--ds-on-surface)' }}>
                          {getTableLabel(log.table_name)}
                        </span>
                        <p className="text-[10px] font-mono" style={{ color: 'var(--ds-on-surface-variant)' }}>
                          {log.table_name}
                        </p>
                      </td>
                      <td className="p-3 hidden lg:table-cell max-w-xs">
                        <div className="flex items-start gap-1.5">
                          {hasPayload(log) && (
                            <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--ds-on-surface-variant)' }}>
                              {expandedId === log.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            {(log.new_value || log.old_value) && (
                              <p
                                className="text-[10px] font-mono truncate max-w-[200px]"
                                style={{ color: 'var(--ds-on-surface-variant)' }}
                                title={buildChangeSummary(log)}
                              >
                                {buildChangeSummary(log) || '—'}
                              </p>
                            )}
                            {log.record_id && (
                              <p className="text-[9px] font-mono mt-0.5 opacity-50" dir="ltr" style={{ color: 'var(--ds-on-surface-variant)' }}>
                                {log.record_id.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                        <td colSpan={5} className="p-0" style={{ background: 'var(--ds-surface-lowest)' }}>
                          <div className="p-3 border-t" style={{ borderColor: 'var(--ds-surface-container)' }}>
                            {log.action === 'UPDATE' && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--ds-on-surface)' }}>قبل</p>
                                  <pre
                                    className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                    style={{
                                      background: 'var(--ds-surface-low)',
                                      border: '1px solid var(--ds-surface-container)',
                                      color: 'var(--ds-on-surface-variant)',
                                    }}
                                    dir="ltr"
                                  >
                                    {formatJson(log.old_value)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--ds-on-surface)' }}>بعد</p>
                                  <pre
                                    className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                    style={{
                                      background: 'var(--ds-surface-low)',
                                      border: '1px solid var(--ds-surface-container)',
                                      color: 'var(--ds-on-surface-variant)',
                                    }}
                                    dir="ltr"
                                  >
                                    {formatJson(log.new_value)}
                                  </pre>
                                </div>
                              </div>
                            )}
                            {log.action === 'INSERT' && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--ds-on-surface)' }}>البيانات المضافة</p>
                                <pre
                                  className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                  style={{
                                    background: 'var(--ds-surface-low)',
                                    border: '1px solid var(--ds-surface-container)',
                                    color: 'var(--ds-on-surface-variant)',
                                  }}
                                  dir="ltr"
                                >
                                  {formatJson(log.new_value)}
                                </pre>
                              </div>
                            )}
                            {log.action === 'DELETE' && (
                              <div>
                                <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--ds-on-surface)' }}>البيانات المحذوفة</p>
                                <pre
                                  className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap break-all"
                                  style={{
                                    background: 'var(--ds-surface-low)',
                                    border: '1px solid var(--ds-surface-container)',
                                    color: 'var(--ds-on-surface-variant)',
                                  }}
                                  dir="ltr"
                                >
                                  {formatJson(log.old_value)}
                                </pre>
                              </div>
                            )}
                            {!['INSERT', 'UPDATE', 'DELETE'].includes(log.action) && (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold mb-1.5">قبل</p>
                                  <pre className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-48" dir="ltr" style={{ background: 'var(--ds-surface-low)', border: '1px solid var(--ds-surface-container)' }}>
                                    {formatJson(log.old_value)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold mb-1.5">بعد</p>
                                  <pre className="text-[10px] font-mono p-2 rounded-lg overflow-x-auto max-h-48" dir="ltr" style={{ background: 'var(--ds-surface-low)', border: '1px solid var(--ds-surface-container)' }}>
                                    {formatJson(log.new_value)}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between"
            style={{
              borderTop: '1px solid var(--ds-surface-container)',
              background: 'var(--ds-surface-low)',
            }}
          >
            <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>
              {`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} من ${totalCount}`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                style={{ border: '1px solid var(--ds-outline-variant)' }}
              >
                {isRTL ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>
              <span className="text-xs px-2" style={{ color: 'var(--ds-on-surface-variant)' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 w-7 flex items-center justify-center rounded-lg disabled:opacity-40 hover:bg-muted transition-colors"
                style={{ border: '1px solid var(--ds-outline-variant)' }}
              >
                {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
