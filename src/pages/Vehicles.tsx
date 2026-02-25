import { useState } from 'react';
import { Search, Plus, Bike, Wrench } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { vehicles } from '@/data/mock';

const statusLabels: Record<string, string> = { active: 'نشطة', maintenance: 'صيانة', suspended: 'موقوفة' };
const statusStyles: Record<string, string> = { active: 'badge-success', maintenance: 'badge-warning', suspended: 'badge-urgent' };
const typeLabels: Record<string, string> = { motorcycle: 'موتوسيكل', car: 'سيارة' };

const getDaysLeft = (date: string) => {
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
};

const daysStyle = (days: number) => days <= 30 ? 'text-destructive font-semibold' : days <= 60 ? 'text-warning font-medium' : 'text-muted-foreground';

const Vehicles = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = vehicles.filter(v => {
    const matchSearch = v.plateNumber.toLowerCase().includes(search.toLowerCase()) || (v.currentDriver || '').includes(search);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    const matchType = typeFilter === 'all' || v.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Bike size={24} /> المركبات</h1>
          <p className="text-sm text-muted-foreground mt-1">{vehicles.length} مركبة مسجلة</p>
        </div>
        <Button className="gap-2"><Plus size={16} /> إضافة مركبة</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث برقم اللوحة أو اسم المندوب..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'motorcycle', l: 'موتوسيكل' }, { v: 'car', l: 'سيارة' }].map(t => (
            <button key={t.v} onClick={() => setTypeFilter(t.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{t.l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'نشطة' }, { v: 'maintenance', l: 'صيانة' }, { v: 'suspended', l: 'موقوفة' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">رقم اللوحة</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">النوع</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الماركة / الموديل</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب الحالي</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">التأمين</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">التسجيل</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">آخر صيانة</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => {
                const insDays = getDaysLeft(v.insuranceExpiry);
                const regDays = getDaysLeft(v.registrationExpiry);
                return (
                  <tr key={v.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-mono font-semibold text-foreground">{v.plateNumber}</td>
                    <td className="p-4 text-sm text-muted-foreground">{typeLabels[v.type]}</td>
                    <td className="p-4 text-sm text-muted-foreground">{v.brand} {v.model}</td>
                    <td className="p-4 text-sm text-foreground">{v.currentDriver || <span className="text-muted-foreground">غير معيّن</span>}</td>
                    <td className={`p-4 text-center text-sm ${daysStyle(insDays)}`}>{insDays} يوم</td>
                    <td className={`p-4 text-center text-sm ${daysStyle(regDays)}`}>{regDays} يوم</td>
                    <td className="p-4 text-center text-sm text-muted-foreground">{v.lastMaintenance || '—'}</td>
                    <td className="p-4 text-center"><span className={statusStyles[v.status]}>{statusLabels[v.status]}</span></td>
                    <td className="p-4 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="sm" variant="ghost" className="text-xs gap-1"><Wrench size={14} /> صيانة</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Vehicles;
