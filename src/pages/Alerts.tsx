import { useState } from 'react';
import { Bell, Search, CheckCircle, Clock, X, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { alerts as initialAlerts, alertTypeLabels } from '@/data/mock';
import type { Alert } from '@/data/mock';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const severityStyles: Record<string, string> = { urgent: 'badge-urgent', warning: 'badge-warning', info: 'badge-info' };
const severityLabels: Record<string, string> = { urgent: '🔴 عاجل', warning: '🟠 تحذير', info: '🔵 معلومات' };

const typeIcons: Record<string, string> = {
  residency: '🪪', insurance: '🛡️', registration: '📋',
  license: '🪪', installment: '💳', deduction: '📄',
};

const Alerts = () => {
  const [localAlerts, setLocalAlerts] = useState<Alert[]>(initialAlerts);
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [resolveDialog, setResolveDialog] = useState<Alert | null>(null);
  const [deferDialog, setDeferDialog] = useState<Alert | null>(null);
  const [deferDays, setDeferDays] = useState('7');
  const [resolveNote, setResolveNote] = useState('');
  const { toast } = useToast();

  const filtered = localAlerts.filter(a => {
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    const matchSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchSearch = a.entityName.includes(search);
    const matchResolved = !a.resolved;
    return matchType && matchSeverity && matchSearch && matchResolved;
  });

  const resolved = localAlerts.filter(a => a.resolved);

  const handleResolve = () => {
    if (!resolveDialog) return;
    setLocalAlerts(prev => prev.map(a => a.id === resolveDialog.id ? { ...a, resolved: true } : a));
    toast({ title: 'تم الحسم', description: `تم حسم تنبيه: ${resolveDialog.entityName}` });
    setResolveDialog(null);
    setResolveNote('');
  };

  const handleDefer = () => {
    if (!deferDialog) return;
    const days = parseInt(deferDays) || 7;
    const newDate = new Date(deferDialog.dueDate);
    newDate.setDate(newDate.getDate() + days);
    setLocalAlerts(prev => prev.map(a =>
      a.id === deferDialog.id
        ? { ...a, daysLeft: a.daysLeft + days, dueDate: newDate.toISOString().split('T')[0] }
        : a
    ));
    toast({ title: 'تم التأجيل', description: `تم تأجيل التنبيه ${days} يوم` });
    setDeferDialog(null);
    setDeferDays('7');
  };

  const handleExport = () => {
    const severityOrder: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
    const rows = [...localAlerts]
      .filter(a => !a.resolved)
      .sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
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
  };

  const typeOptions = ['all', 'residency', 'insurance', 'registration', 'license', 'installment', 'deduction'];
  const urgentCount = filtered.filter(a => a.severity === 'urgent').length;
  const warningCount = filtered.filter(a => a.severity === 'warning').length;
  const infoCount = filtered.filter(a => a.severity === 'info').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell size={24} /> التنبيهات التلقائية
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} تنبيه نشط — {urgentCount} عاجل
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2"><Download size={15} /> 📥 تحميل تقرير ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExport}>📊 تصدير Excel (مرتب حسب الأولوية)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      <div className="bg-card rounded-xl border border-border/50 p-4 space-y-3">
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
              {t === 'all' ? 'كل الأنواع' : `${typeIcons[t]} ${alertTypeLabels[t]}`}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
            <CheckCircle size={40} className="mx-auto text-success mb-3" />
            <p className="text-muted-foreground">لا توجد تنبيهات مطابقة</p>
          </div>
        ) : filtered.sort((a, b) => {
          const order = { urgent: 0, warning: 1, info: 2 };
          return (order[a.severity as keyof typeof order] || 0) - (order[b.severity as keyof typeof order] || 0);
        }).map(a => (
          <div key={a.id} className={`bg-card rounded-xl border shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow ${a.severity === 'urgent' ? 'border-destructive/30' : a.severity === 'warning' ? 'border-warning/30' : 'border-border/50'}`}>
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${a.severity === 'urgent' ? 'bg-destructive/10' : a.severity === 'warning' ? 'bg-warning/10' : 'bg-info/10'}`}>
              {typeIcons[a.type]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{alertTypeLabels[a.type]}</p>
                <span className="text-muted-foreground text-xs">—</span>
                <p className="text-sm text-foreground">{a.entityName}</p>
                <span className={severityStyles[a.severity]}>{severityLabels[a.severity]}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                تاريخ الاستحقاق: <span className="font-medium">{a.dueDate}</span>
                <span className={`mr-3 font-bold ${a.daysLeft <= 7 ? 'text-destructive' : a.daysLeft <= 30 ? 'text-warning' : 'text-muted-foreground'}`}>
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
                <span className="text-lg">{typeIcons[a.type]}</span>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{alertTypeLabels[a.type]} — {a.entityName}</p>
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
              <p className="text-sm font-medium">{resolveDialog && alertTypeLabels[resolveDialog.type]}</p>
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
              <p className="text-sm font-medium">{deferDialog && alertTypeLabels[deferDialog.type]}</p>
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
