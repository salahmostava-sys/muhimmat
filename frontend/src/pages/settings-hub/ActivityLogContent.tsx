import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import {
  Download, Search, RefreshCw, X, Activity,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from '@e965/xlsx';
import { format } from 'date-fns';
import { settingsHubService } from '@/services/settingsHubService';

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

export default function ActivityLogContent() {
  const { isRTL } = useLanguage();
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
      const { data, count, error } = await settingsHubService.getAuditLogs(
        page * PAGE_SIZE,
        (page + 1) * PAGE_SIZE - 1,
        filterAction,
        filterTable,
        debouncedSearch
      );
      if (error) throw error;

      const userIds = [...new Set((data || []).map(l => l.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await settingsHubService.getAuditProfilesByIds(userIds);
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
    const { data } = await settingsHubService.getAuditLogsForExport();
    if (!data) return;
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
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={fetchLogs}>
            <RefreshCw size={13} /> تحديث
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExport}>
            <Download size={13} /> تصدير
          </Button>
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
                    key={i}
                    className={`p-3 text-xs font-semibold whitespace-nowrap ${i === 2 ? 'text-center' : isRTL ? 'text-right' : 'text-left'} ${i === 4 ? 'hidden lg:table-cell' : ''}`}
                    style={{ color: 'var(--ds-on-surface-variant)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ background: 'var(--ds-surface-lowest)' }}>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
                    <td className="p-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-3 text-center"><Skeleton className="h-5 w-14 mx-auto rounded-full" /></td>
                    <td className="p-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-36" /></td>
                  </tr>
                ))
                : logs.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <Activity size={32} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--ds-on-surface-variant)' }} />
                        <p className="text-sm" style={{ color: 'var(--ds-on-surface-variant)' }}>
                          لا توجد سجلات
                        </p>
                      </td>
                    </tr>
                  )
                  : logs.map(log => (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid var(--ds-surface-container)' }}
                      className="transition-colors hover:bg-[var(--ds-surface-low)]"
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
                        {log.new_value && (
                          <p
                            className="text-[10px] font-mono truncate max-w-[200px]"
                            style={{ color: 'var(--ds-on-surface-variant)' }}
                            title={JSON.stringify(log.new_value)}
                          >
                            {Object.entries(log.new_value).slice(0, 2).map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 20)}`).join(' | ')}
                          </p>
                        )}
                        {log.record_id && (
                          <p className="text-[9px] font-mono mt-0.5 opacity-50" dir="ltr" style={{ color: 'var(--ds-on-surface-variant)' }}>
                            {log.record_id.slice(0, 8)}...
                          </p>
                        )}
                      </td>
                    </tr>
                  ))
              }
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
