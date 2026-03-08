import { useState, useEffect } from 'react';
import { Smartphone, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const appColors: Record<string, string> = {
  'هنقرستيشن': 'bg-[hsl(0,72%,95%)] border-[hsl(0,72%,80%)] text-[hsl(0,72%,40%)]',
  'جاهز': 'bg-[hsl(152,60%,95%)] border-[hsl(152,60%,70%)] text-[hsl(152,60%,30%)]',
  'كيتا': 'bg-[hsl(38,92%,95%)] border-[hsl(38,92%,70%)] text-[hsl(38,92%,35%)]',
  'توبو': 'bg-[hsl(217,72%,95%)] border-[hsl(217,72%,70%)] text-[hsl(217,72%,35%)]',
  'نينجا': 'bg-[hsl(280,60%,95%)] border-[hsl(280,60%,70%)] text-[hsl(280,60%,35%)]',
};

interface AppData {
  id: string;
  name: string;
  employeeCount: number;
}

interface EmployeeInApp {
  id: string;
  name: string;
  monthOrders: number;
}

const Apps = () => {
  const [apps, setApps] = useState<AppData[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null);
  const [appEmployees, setAppEmployees] = useState<EmployeeInApp[]>([]);
  const [search, setSearch] = useState('');
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    const fetchApps = async () => {
      setLoadingApps(true);
      const { data } = await supabase.from('apps').select('id, name').eq('is_active', true).order('name');
      if (!data) { setLoadingApps(false); return; }

      // Get employee count per app
      const appsWithCounts = await Promise.all(
        data.map(async (app) => {
          const { count } = await supabase
            .from('employee_apps')
            .select('id', { count: 'exact', head: true })
            .eq('app_id', app.id)
            .eq('status', 'active');
          return { id: app.id, name: app.name, employeeCount: count || 0 };
        })
      );
      setApps(appsWithCounts);
      setLoadingApps(false);
    };
    fetchApps();
  }, []);

  const handleSelectApp = async (app: AppData) => {
    if (selectedApp?.id === app.id) { setSelectedApp(null); setAppEmployees([]); return; }
    setSelectedApp(app);
    setLoadingEmployees(true);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${new Date(parseInt(currentMonth.split('-')[0]), parseInt(currentMonth.split('-')[1]), 0).getDate()}`;

    const { data: empApps } = await supabase
      .from('employee_apps')
      .select('employee_id, employees(id, name)')
      .eq('app_id', app.id)
      .eq('status', 'active');

    if (!empApps) { setLoadingEmployees(false); return; }

    const employees = empApps.map(ea => (ea.employees as any)).filter(Boolean);

    const employeesWithOrders = await Promise.all(
      employees.map(async (emp: any) => {
        const { data: orders } = await supabase
          .from('daily_orders')
          .select('orders_count')
          .eq('employee_id', emp.id)
          .eq('app_id', app.id)
          .gte('date', startDate)
          .lte('date', endDate);
        const total = orders?.reduce((s, o) => s + o.orders_count, 0) || 0;
        return { id: emp.id, name: emp.name, monthOrders: total };
      })
    );
    setAppEmployees(employeesWithOrders);
    setLoadingEmployees(false);
  };

  const filteredEmployees = appEmployees.filter(e => e.name.includes(search));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Smartphone size={24} /> التطبيقات</h1>
        <p className="text-sm text-muted-foreground mt-1">إدارة التطبيقات ومناديب كل تطبيق</p>
      </div>

      {loadingApps ? (
        <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {apps.map(app => {
            const isSelected = selectedApp?.id === app.id;
            const colorClass = appColors[app.name] || 'bg-muted border-border text-foreground';
            return (
              <button
                key={app.id}
                onClick={() => handleSelectApp(app)}
                className={`p-5 rounded-xl border-2 text-center transition-all ${isSelected ? 'ring-2 ring-primary border-primary shadow-md' : `${colorClass} hover:shadow-md`}`}
              >
                <h3 className="font-bold text-lg">{app.name}</h3>
                <p className="text-2xl font-bold mt-2">{app.employeeCount}</p>
                <p className="text-xs text-muted-foreground mt-1">مندوب</p>
              </button>
            );
          })}
        </div>
      )}

      {selectedApp && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-foreground">مناديب {selectedApp.name}</h3>
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="بحث..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            {loadingEmployees ? (
              <div className="text-center py-8 text-muted-foreground text-sm">جارٍ التحميل...</div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد مناديب لهذا التطبيق</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-center p-4 text-sm font-semibold text-muted-foreground">طلبات الشهر</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => (
                    <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-4 text-sm font-medium text-foreground">{emp.name}</td>
                      <td className="p-4 text-center"><span className="badge-success">نشط</span></td>
                      <td className="p-4 text-center font-semibold text-primary">{emp.monthOrders.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Apps;
