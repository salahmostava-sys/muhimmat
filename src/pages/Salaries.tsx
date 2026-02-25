import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Wallet, Download, CheckCircle } from 'lucide-react';
import { salaryRecords } from '@/data/mock';

const statusLabels: Record<string, string> = { pending: 'معلق', approved: 'معتمد', paid: 'مصروف' };
const statusStyles: Record<string, string> = { pending: 'badge-warning', approved: 'badge-info', paid: 'badge-success' };

const MonthAccounting = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = salaryRecords.filter(r => {
    const matchSearch = r.employeeName.includes(search);
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchType = typeFilter === 'all' || r.salaryType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalNet = filtered.reduce((s, r) => s + r.netSalary, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'shift', l: 'دوام' }, { v: 'orders', l: 'طلبات' }].map(t => (
            <button key={t.v} onClick={() => setTypeFilter(t.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${typeFilter === t.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{t.l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلق' }, { v: 'approved', l: 'معتمد' }, { v: 'paid', l: 'مصروف' }].map(s => (
            <button key={s.v} onClick={() => setStatusFilter(s.v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{s.l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card"><p className="text-sm text-muted-foreground">إجمالي الرواتب</p><p className="text-2xl font-bold text-foreground mt-1">{totalNet.toLocaleString()} ر.س</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">عدد الموظفين</p><p className="text-2xl font-bold text-foreground mt-1">{filtered.length}</p></div>
        <div className="stat-card"><p className="text-sm text-muted-foreground">في انتظار الاعتماد</p><p className="text-2xl font-bold text-warning mt-1">{filtered.filter(r => r.status === 'pending').length}</p></div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-3 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-3 text-sm font-semibold text-muted-foreground">النوع</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الراتب الأساسي</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">البدلات</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">خصم الغياب</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">خصم السلف</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">خصم خارجي</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">خصم يدوي</th>
                <th className="text-center p-3 text-sm font-semibold text-primary">صافي الراتب</th>
                <th className="text-center p-3 text-sm font-semibold text-muted-foreground">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="p-3 text-sm font-medium text-foreground">{r.employeeName}</td>
                  <td className="p-3 text-sm text-muted-foreground">{r.salaryType === 'orders' ? 'طلبات' : 'دوام'}</td>
                  <td className="p-3 text-center text-sm">{r.baseSalary.toLocaleString()}</td>
                  <td className="p-3 text-center text-sm text-success">+{r.allowances}</td>
                  <td className="p-3 text-center text-sm text-destructive">{r.absenceDeduction > 0 ? `-${r.absenceDeduction}` : '—'}</td>
                  <td className="p-3 text-center text-sm text-destructive">{r.advanceDeduction > 0 ? `-${r.advanceDeduction}` : '—'}</td>
                  <td className="p-3 text-center text-sm text-destructive">{r.externalDeduction > 0 ? `-${r.externalDeduction}` : '—'}</td>
                  <td className="p-3 text-center text-sm text-destructive">{r.manualDeduction > 0 ? `-${r.manualDeduction}` : '—'}</td>
                  <td className="p-3 text-center text-sm font-bold text-primary">{r.netSalary.toLocaleString()}</td>
                  <td className="p-3 text-center"><span className={statusStyles[r.status]}>{statusLabels[r.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" className="gap-2"><Download size={16} /> تصدير Excel</Button>
        <Button className="gap-2"><CheckCircle size={16} /> اعتماد المحددين</Button>
      </div>
    </div>
  );
};

const Salaries = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet size={24} /> الرواتب</h1>
      <p className="text-sm text-muted-foreground mt-1">محاسبة الشهر وكشف الرواتب</p>
    </div>
    <Tabs defaultValue="accounting" dir="rtl">
      <TabsList>
        <TabsTrigger value="accounting">محاسبة الشهر</TabsTrigger>
        <TabsTrigger value="history">سجل الصرف</TabsTrigger>
      </TabsList>
      <TabsContent value="accounting"><MonthAccounting /></TabsContent>
      <TabsContent value="history"><div className="text-center py-12 text-muted-foreground">سجل الصرف للأشهر السابقة</div></TabsContent>
    </Tabs>
  </div>
);

export default Salaries;
