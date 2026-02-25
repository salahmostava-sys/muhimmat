import { useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { alerts, alertTypeLabels } from '@/data/mock';

const severityStyles: Record<string, string> = { urgent: 'badge-urgent', warning: 'badge-warning', info: 'badge-info' };
const severityLabels: Record<string, string> = { urgent: 'عاجل', warning: 'تحذير', info: 'معلومات' };

const Alerts = () => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = alerts.filter(a => {
    const matchType = typeFilter === 'all' || a.type === typeFilter;
    const matchSeverity = severityFilter === 'all' || a.severity === severityFilter;
    const matchSearch = a.entityName.includes(search);
    return matchType && matchSeverity && matchSearch;
  });

  const typeOptions = ['all', 'residency', 'insurance', 'registration', 'license', 'installment', 'deduction'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Bell size={24} /> التنبيهات</h1>
        <p className="text-sm text-muted-foreground mt-1">{alerts.length} تنبيه — {alerts.filter(a => a.severity === 'urgent').length} عاجل</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card border-r-4 border-r-destructive">
          <p className="text-sm text-muted-foreground">عاجل</p>
          <p className="text-2xl font-bold text-destructive mt-1">{alerts.filter(a => a.severity === 'urgent').length}</p>
        </div>
        <div className="stat-card border-r-4 border-r-warning">
          <p className="text-sm text-muted-foreground">تحذير</p>
          <p className="text-2xl font-bold text-warning mt-1">{alerts.filter(a => a.severity === 'warning').length}</p>
        </div>
        <div className="stat-card border-r-4 border-r-info">
          <p className="text-sm text-muted-foreground">معلومات</p>
          <p className="text-2xl font-bold text-info mt-1">{alerts.filter(a => a.severity === 'info').length}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {t === 'all' ? 'الكل' : alertTypeLabels[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'urgent', l: 'عاجل' }, { v: 'warning', l: 'تحذير' }, { v: 'info', l: 'معلومات' }].map(s => (
            <button key={s.v} onClick={() => setSeverityFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${severityFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(a => (
          <div key={a.id} className="bg-card rounded-xl border border-border/50 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${a.severity === 'urgent' ? 'bg-destructive/10' : a.severity === 'warning' ? 'bg-warning/10' : 'bg-info/10'}`}>
              {a.type === 'residency' ? '🪪' : a.type === 'insurance' ? '🛡️' : a.type === 'registration' ? '📋' : a.type === 'license' ? '🪪' : a.type === 'installment' ? '💳' : '📄'}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{alertTypeLabels[a.type]} — {a.entityName}</p>
              <p className="text-xs text-muted-foreground">تاريخ الاستحقاق: {a.dueDate}</p>
            </div>
            <div className="text-left">
              <span className={severityStyles[a.severity]}>{severityLabels[a.severity]}</span>
              <p className={`text-sm font-bold mt-1 ${a.daysLeft <= 7 ? 'text-destructive' : a.daysLeft <= 30 ? 'text-warning' : 'text-muted-foreground'}`}>{a.daysLeft} يوم</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;
