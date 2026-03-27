import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Search, CheckCircle, Clock, Download, Loader2 } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Textarea } from '@shared/components/ui/textarea';
import { Label } from '@shared/components/ui/label';
import { useRealtimePostgresChanges, REALTIME_TABLES_ALERTS_PAGE } from '@shared/hooks/useRealtimePostgresChanges';
import { useToast } from '@shared/hooks/use-toast';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { alertsService } from '@services/alertsService';
import { useAlertsData } from '@shared/hooks/useAlertsData';
import type { Alert } from '@shared/lib/alertsBuilder';
import { escapeHtml } from '@shared/lib/security';
import { format } from 'date-fns';

// Static label map — not data (only residency, insurance, authorization, probation, platform_account)
export const alertTypeLabels: Record<string, string> = {
  residency: 'إقامة',
  insurance: 'تأمين',
  authorization: 'تفويض',
  probation: 'فترة التجربة',
  platform_account: 'حساب منصة',
  employee_absconded: 'مندوب هارب',
  employee_terminated: 'مندوب منتهي',
};

const severityStyles: Record<string, string> = { urgent: 'badge-urgent', warning: 'badge-warning', info: 'badge-info' };
const severityLabels: Record<string, string> = { urgent: '🔴 عاجل', warning: '🟠 تحذير', info: '🔵 معلومات' };

const typeIcons: Record<string, string> = {
  residency: '🪪',
  insurance: '🛡️',
  authorization: '📜',
  probation: '⏱️',
  platform_account: '📱',
  employee_absconded: '🚨',
  employee_terminated: '🧾',
};

const DB_BACKED_EMPLOYEE_ALERT_TYPES = new Set(['employee_absconded', 'employee_terminated']);

const isDbBackedEmployeeAlertType = (type: string) => DB_BACKED_EMPLOYEE_ALERT_TYPES.has(type);

function isUnresolvedAlertMatchingFilters(
  a: Alert,
  typeFilter: string,
  severityFilter: string,
  search: string
): boolean {
  if (a.resolved) return false;
  if (typeFilter !== 'all' && a.type !== typeFilter) return false;
  if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
  return a.entityName.includes(search);
}

const SEVERITY_SORT_ORDER: Record<string, number> = { urgent: 0, warning: 1, info: 2 };

const compareAlertsBySeverity = (a: Alert, b: Alert) =>
  (SEVERITY_SORT_ORDER[a.severity] ?? 3) - (SEVERITY_SORT_ORDER[b.severity] ?? 3);

const alertRowBorderClass = (severity: Alert['severity']) => {
  if (severity === 'urgent') return 'border-destructive/30';
  if (severity === 'warning') return 'border-warning/30';
  return 'border-border/50';
};

const alertIconContainerClass = (severity: Alert['severity']) => {
  if (severity === 'urgent') return 'bg-destructive/10';
  if (severity === 'warning') return 'bg-warning/10';
  return 'bg-info/10';
};

const daysLeftTextClass = (daysLeft: number) => {
  if (daysLeft <= 7) return 'text-destructive';
  if (daysLeft <= 30) return 'text-warning';
  return 'text-muted-foreground';
};

const printSeverityColor = (severity: Alert['severity']) => {
  if (severity === 'urgent') return '#dc2626';
  if (severity === 'warning') return '#d97706';
  return '#2563eb';
};

const loadXlsx = () => import('@e965/xlsx');

const Alerts = () => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [resolveDialog, setResolveDialog] = useState<Alert | null>(null);
  const [deferDialog, setDeferDialog] = useState<Alert | null>(null);
  const [deferDays, setDeferDays] = useState('7');
  const [resolveNote, setResolveNote] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = authQueryUserId(user?.id ?? null);
  const [rtTick, setRtTick] = useState(0);

  useRealtimePostgresChanges('alerts-page-realtime', REALTIME_TABLES_ALERTS_PAGE, () => {
    setRtTick((n) => n + 1);
  });

  const {
    data: alertsData = [],
    isLoading: loading,
    error: alertsError,
    refetch: refetchAlerts,
    iqamaAlertDays,
  } = useAlertsData();
  const alertsQueryKey = ['alerts', uid, 'page-data', iqamaAlertDays] as const;

  useEffect(() => {
    if (!alertsError) return;
    const msg = alertsError instanceof Error ? alertsError.message : 'حدث خطأ غير متوقع';
    toast({ title: 'تعذر تحميل التنبيهات', description: msg, variant: 'destructive' });
  }, [alertsError, toast]);

  useEffect(() => {
    if (rtTick === 0) return;
    void refetchAlerts();
  }, [rtTick, refetchAlerts]);

  const filtered = alertsData.filter(a =>
    isUnresolvedAlertMatchingFilters(a, typeFilter, severityFilter, search)
  );

  const resolved = alertsData.filter(a => a.resolved);

  const handleResolve = async () => {
    if (!resolveDialog) return;
    const targetAlertId = resolveDialog.id;
    queryClient.setQueryData<Alert[]>(alertsQueryKey, (prev = []) =>
      prev.map((a) => (a.id === resolveDialog.id ? { ...a, resolved: true } : a))
    );
    toast({ title: 'تم الحسم', description: `تم حسم تنبيه: ${resolveDialog.entityName}` });

    // Persist DB-backed employee alerts
    if (isDbBackedEmployeeAlertType(resolveDialog.type)) {
      try {
        await alertsService.resolveAlert(resolveDialog.id, user?.id ?? null);
        await queryClient.invalidateQueries({ queryKey: alertsQueryKey });
      } catch (e) {
        queryClient.setQueryData<Alert[]>(alertsQueryKey, (prev = []) =>
          prev.map((a) => (a.id === targetAlertId ? { ...a, resolved: false } : a))
        );
        const message = e instanceof Error ? e.message : 'فشل حسم التنبيه';
        toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      }
    }

    setResolveDialog(null);
    setResolveNote('');
  };

  const handleDefer = async () => {
    if (!deferDialog) return;
    const days = Number.parseInt(deferDays) || 7;
    const targetAlertId = deferDialog.id;
    const originalDueDate = deferDialog.dueDate;
    const originalDaysLeft = deferDialog.daysLeft;
    const newDate = new Date(deferDialog.dueDate);
    newDate.setDate(newDate.getDate() + days);
    queryClient.setQueryData<Alert[]>(alertsQueryKey, (prev = []) =>
      prev.map((a) =>
        a.id === deferDialog.id
          ? { ...a, daysLeft: a.daysLeft + days, dueDate: newDate.toISOString().split('T')[0] }
          : a
      )
    );
    toast({ title: 'تم التأجيل', description: `تم تأجيل التنبيه ${days} يوم` });

    // Persist DB-backed employee alerts
    if (isDbBackedEmployeeAlertType(deferDialog.type)) {
      const due = newDate.toISOString().split('T')[0];
      try {
        await alertsService.deferAlert(deferDialog.id, due);
        await queryClient.invalidateQueries({ queryKey: alertsQueryKey });
      } catch (e) {
        queryClient.setQueryData<Alert[]>(alertsQueryKey, (prev = []) =>
          prev.map((a) =>
            a.id === targetAlertId
              ? { ...a, dueDate: originalDueDate, daysLeft: originalDaysLeft }
              : a
          )
        );
        const message = e instanceof Error ? e.message : 'فشل تأجيل التنبيه';
        toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
      }
    }

    setDeferDialog(null);
    setDeferDays('7');
  };

  const handlePrint = () => {
    const severityLabels2: Record<string, string> = { urgent: 'عاجل', warning: 'تحذير', info: 'معلومة' };
    const rows = filtered.map(a => `<tr><td>${escapeHtml(alertTypeLabels[a.type] || a.type)}</td><td>${escapeHtml(a.entityName)}</td><td>${escapeHtml(a.dueDate || '—')}</td><td style="text-align:center">${escapeHtml(a.daysLeft ?? '—')}</td><td style="text-align:center;font-weight:700;color:${printSeverityColor(a.severity)}">${escapeHtml(severityLabels2[a.severity] || a.severity)}</td></tr>`).join('');
    const printWindow = globalThis.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>تقرير التنبيهات</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:8px;font-size:15px}p.sub{text-align:center;color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>تقرير التنبيهات التلقائية</h2><p class="sub">المجموع: ${filtered.length} تنبيه — ${new Date().toLocaleDateString('ar-SA')}</p><table><thead><tr><th>النوع</th><th>الجهة</th><th>تاريخ الاستحقاق</th><th>المتبقي (يوم)</th><th>الأولوية</th></tr></thead><tbody>${rows}</tbody></table><script>globalThis.onload=()=>{globalThis.print();globalThis.onafterprint=()=>globalThis.close()}</script></body></html>`);
    printWindow.document.close();
  };

  const handleExport = () => {
    void (async () => {
      const XLSX = await loadXlsx();
    const rows = [...alertsData]
      .filter(a => !a.resolved)
      .sort(compareAlertsBySeverity)
      .map(a => ({
        'الأولوية': severityLabels[a.severity] || a.severity,
        'النوع': alertTypeLabels[a.type] || a.type,
        'الجهة': a.entityName,
        'تاريخ الاستحقاق': a.dueDate,
        'المتبقي (يوم)': a.daysLeft,
        'الحالة': a.resolved ? 'محسوم' : 'نشط',
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'التنبيهات');
    XLSX.writeFile(wb, `التنبيهات_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    })();
  };

  const typeOptions = ['all', 'residency', 'insurance', 'authorization', 'probation', 'platform_account', 'employee_absconded', 'employee_terminated'];
  const urgentCount = filtered.filter(a => a.severity === 'urgent').length;
  const warningCount = filtered.filter(a => a.severity === 'warning').length;
  const infoCount = filtered.filter(a => a.severity === 'info').length;

  return (
    <div className="space-y-4">
      {/* Page header breadcrumb */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>التنبيهات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><Bell size={20} /> التنبيهات التلقائية</h1>
            <p className="page-subtitle">
              {loading ? 'جارٍ التحميل...' : `${filtered.length} تنبيه نشط — ${urgentCount} عاجل`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9"><Download size={14} /> البيانات ▾</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel (مرتب حسب الأولوية)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                void (async () => {
                const XLSX = await loadXlsx();
                const headers = [['النوع', 'الجهة', 'تاريخ الاستحقاق', 'المتبقي (يوم)', 'الأولوية']];
                const ws = XLSX.utils.aoa_to_sheet(headers);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'قالب');
                XLSX.writeFile(wb, 'template_alerts.xlsx');
                })();
              }}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="stat-card border-r-4 border-r-destructive cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSeverityFilter(severityFilter === 'urgent' ? 'all' : 'urgent')}>
          <p className="text-sm text-muted-foreground">عاجل</p>
          <p className="text-3xl font-bold text-destructive mt-1">{urgentCount}</p>
          <p className="text-xs text-muted-foreground mt-1">يتطلب تدخل فوري</p>
        </div>
        <div className="stat-card border-r-4 border-r-warning cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning')}>
          <p className="text-sm text-muted-foreground">تحذير</p>
          <p className="text-3xl font-bold text-warning mt-1">{warningCount}</p>
          <p className="text-xs text-muted-foreground mt-1">خلال 30-60 يوم</p>
        </div>
        <div className="stat-card border-r-4 border-r-info cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSeverityFilter(severityFilter === 'info' ? 'all' : 'info')}>
          <p className="text-sm text-muted-foreground">معلومات</p>
          <p className="text-3xl font-bold text-info mt-1">{infoCount}</p>
          <p className="text-xs text-muted-foreground mt-1">للاطلاع</p>
        </div>
        <div className="stat-card border-r-4 border-r-success cursor-pointer hover:shadow-md transition-shadow">
          <p className="text-sm text-muted-foreground">تم حسمه</p>
          <p className="text-3xl font-bold text-success mt-1">{resolved.length}</p>
          <p className="text-xs text-muted-foreground mt-1">تنبيهات محسومة</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/50 p-3 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{ v: 'all', l: 'الكل' }, { v: 'urgent', l: '🔴 عاجل' }, { v: 'warning', l: '🟠 تحذير' }, { v: 'info', l: '🔵 معلومات' }].map(s => (
              <button key={s.v} onClick={() => setSeverityFilter(s.v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${severityFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {t === 'all' ? 'كل الأنواع' : `${typeIcons[t] || '📌'} ${alertTypeLabels[t] || t}`}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-card rounded-xl border border-border/50 p-12 flex flex-col items-center justify-center gap-3 text-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جارٍ تحميل التنبيهات...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
            <CheckCircle size={40} className="mx-auto text-success mb-3" />
            <p className="text-muted-foreground">لا توجد تنبيهات مطابقة</p>
            <p className="text-xs text-muted-foreground mt-1">جميع المستندات سارية المفعول ✅</p>
          </div>
        ) : [...filtered].sort(compareAlertsBySeverity).map(a => (
          <div key={a.id} className={`bg-card rounded-xl border shadow-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow ${alertRowBorderClass(a.severity)}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${alertIconContainerClass(a.severity)}`}>
              {typeIcons[a.type] || '📌'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{alertTypeLabels[a.type] || a.type}</p>
                <span className="text-muted-foreground text-xs">—</span>
                <p className="text-sm text-foreground">{a.entityName}</p>
                <span className={severityStyles[a.severity]}>{severityLabels[a.severity]}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                تاريخ الاستحقاق: <span className="font-medium">{a.dueDate}</span>
                <span className={`mr-3 font-bold ${daysLeftTextClass(a.daysLeft)}`}>
                  {a.daysLeft < 0 ? `منتهي منذ ${Math.abs(a.daysLeft)} يوم` : `متبقي ${a.daysLeft} يوم`}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" className="gap-1 text-xs h-8" onClick={() => setDeferDialog(a)}>
                <Clock size={12} /> تأجيل
              </Button>
              <Button size="sm" className="gap-1 text-xs h-8 bg-success hover:bg-success/90" onClick={() => setResolveDialog(a)}>
                <CheckCircle size={12} /> حسم
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">✅ التنبيهات المحسومة ({resolved.length})</h3>
          <div className="space-y-2">
            {resolved.map(a => (
              <div key={a.id} className="bg-muted/30 rounded-xl border border-border/30 p-3 flex items-center gap-3 opacity-60">
                <span className="text-lg">{typeIcons[a.type] || '📌'}</span>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{alertTypeLabels[a.type] || a.type} — {a.entityName}</p>
                </div>
                <CheckCircle size={16} className="text-success" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>حسم التنبيه</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{resolveDialog && (alertTypeLabels[resolveDialog.type] || resolveDialog.type)}</p>
              <p className="text-sm text-muted-foreground mt-1">{resolveDialog?.entityName}</p>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Textarea placeholder="أدخل ملاحظة..." value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setResolveDialog(null)}>إلغاء</Button>
            <Button className="bg-success hover:bg-success/90" onClick={handleResolve}>
              <CheckCircle size={14} className="ml-1" /> تأكيد الحسم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Defer Dialog */}
      <Dialog open={!!deferDialog} onOpenChange={() => setDeferDialog(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>تأجيل التنبيه</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{deferDialog && (alertTypeLabels[deferDialog.type] || deferDialog.type)}</p>
              <p className="text-sm text-muted-foreground mt-1">{deferDialog?.entityName}</p>
            </div>
            <div className="space-y-2">
              <Label>مدة التأجيل (أيام)</Label>
              <div className="flex gap-2">
                {['7', '14', '30', '60'].map(d => (
                  <button key={d} onClick={() => setDeferDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-1 ${deferDays === d ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                    {d} يوم
                  </button>
                ))}
              </div>
              <Input type="number" value={deferDays} onChange={e => setDeferDays(e.target.value)} placeholder="أو أدخل عدد مخصص" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeferDialog(null)}>إلغاء</Button>
            <Button onClick={handleDefer}><Clock size={14} className="ml-1" /> تأجيل {deferDays} يوم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Alerts;
