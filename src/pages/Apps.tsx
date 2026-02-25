import { useState } from 'react';
import { Smartphone, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { employees, appsList, dailyOrders } from '@/data/mock';

const appColors: Record<string, string> = {
  'هنقرستيشن': 'bg-[hsl(0,72%,95%)] border-[hsl(0,72%,80%)] text-[hsl(0,72%,40%)]',
  'جاهز': 'bg-[hsl(152,60%,95%)] border-[hsl(152,60%,70%)] text-[hsl(152,60%,30%)]',
  'كيتا': 'bg-[hsl(38,92%,95%)] border-[hsl(38,92%,70%)] text-[hsl(38,92%,35%)]',
  'توبو': 'bg-[hsl(217,72%,95%)] border-[hsl(217,72%,70%)] text-[hsl(217,72%,35%)]',
  'نينجا': 'bg-[hsl(280,60%,95%)] border-[hsl(280,60%,70%)] text-[hsl(280,60%,35%)]',
};

const Apps = () => {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const appDrivers = selectedApp
    ? employees.filter(e => e.apps.includes(selectedApp) && e.status !== 'terminated' && e.name.includes(search))
    : [];

  const getMonthOrders = (empId: string, app: string) =>
    dailyOrders.filter(o => o.employeeId === empId && o.app === app && o.date.startsWith('2025-02')).reduce((s, o) => s + o.orders, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Smartphone size={24} /> التطبيقات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة التطبيقات ومناديب كل تطبيق</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {appsList.map(app => {
          const count = employees.filter(e => e.apps.includes(app) && e.status !== 'terminated').length;
          const isSelected = selectedApp === app;
          return (
            <button
              key={app}
              onClick={() => setSelectedApp(isSelected ? null : app)}
              className={`p-5 rounded-xl border-2 text-center transition-all ${isSelected ? 'ring-2 ring-primary border-primary shadow-md' : `${appColors[app]} hover:shadow-md`}`}
            >
              <h3 className="font-bold text-lg">{app}</h3>
              <p className="text-2xl font-bold mt-2">{count}</p>
              <p className="text-xs text-muted-foreground mt-1">مندوب</p>
            </button>
          );
        })}
      </div>

      {selectedApp && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">مناديب {selectedApp}</h3>
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">طلبات الشهر</th>
                </tr>
              </thead>
              <tbody>
                {appDrivers.map(emp => (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="p-4 text-center"><span className="badge-success">نشط</span></td>
                    <td className="p-4 text-center font-semibold text-primary">{getMonthOrders(emp.id, selectedApp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Apps;
