import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Save, Package } from 'lucide-react';
import { employees, dailyOrders, appsList } from '@/data/mock';
import { useToast } from '@/hooks/use-toast';

const OrdersEntry = () => {
  const [selectedDate, setSelectedDate] = useState('2025-02-25');
  const [selectedApp, setSelectedApp] = useState('الكل');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const orderDrivers = employees.filter(e => e.status === 'active' && e.salaryType === 'orders');
  const filtered = orderDrivers.filter(e => e.name.includes(search));
  const dayOrders = dailyOrders.filter(o => o.date === selectedDate);

  const getOrderCount = (empId: string, app: string) => {
    const order = dayOrders.find(o => o.employeeId === empId && o.app === app);
    return order?.orders || 0;
  };

  const totalOrders = dayOrders.reduce((sum, o) => sum + o.orders, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44" />
        <div className="flex gap-2">
          {['الكل', ...appsList].map(app => (
            <button key={app} onClick={() => setSelectedApp(app)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedApp === app ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
              {app}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-muted-foreground">إجمالي الطلبات: <strong className="text-foreground">{totalOrders}</strong></span>
      </div>
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">السكيمة</th>
                {(selectedApp === 'الكل' ? appsList : [selectedApp]).map(app => (
                  <th key={app} className="text-center p-4 text-sm font-semibold text-muted-foreground">{app}</th>
                ))}
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">المجموع</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">مجموع الشهر</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(emp => {
                const appsToShow = selectedApp === 'الكل' ? appsList : [selectedApp];
                const dayTotal = appsToShow.reduce((s, app) => s + getOrderCount(emp.id, app), 0);
                const monthTotal = dailyOrders.filter(o => o.employeeId === emp.id && o.date.startsWith('2025-02')).reduce((s, o) => s + o.orders, 0);
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{emp.schemeName || '—'}</td>
                    {appsToShow.map(app => (
                      <td key={app} className="p-4 text-center">
                        <Input type="number" min={0} className="w-20 mx-auto text-center" defaultValue={getOrderCount(emp.id, app)} />
                      </td>
                    ))}
                    <td className="p-4 text-center font-semibold text-foreground">{dayTotal}</td>
                    <td className="p-4 text-center font-semibold text-primary">{monthTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => toast({ title: 'تم الحفظ', description: 'تم حفظ طلبات اليوم بنجاح' })}>
          <Save size={16} /> حفظ الطلبات
        </Button>
      </div>
    </div>
  );
};

const MonthSummary = () => {
  const orderDrivers = employees.filter(e => e.salaryType === 'orders' && e.status !== 'terminated');
  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">السكيمة</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">إجمالي الطلبات</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">الراتب المحتسب</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">Target</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">متوسط يومي</th>
                <th className="text-center p-4 text-sm font-semibold text-muted-foreground">حالة الاعتماد</th>
              </tr>
            </thead>
            <tbody>
              {orderDrivers.map(emp => {
                const monthOrders = dailyOrders.filter(o => o.employeeId === emp.id && o.date.startsWith('2025-02')).reduce((s, o) => s + o.orders, 0);
                const estimatedSalary = monthOrders * 5.5;
                const reachedTarget = monthOrders >= 700;
                const workDays = 25;
                const avgDaily = Math.round(monthOrders / workDays);
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-4 text-sm font-medium text-foreground">{emp.name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{emp.schemeName}</td>
                    <td className="p-4 text-center font-semibold">{monthOrders}</td>
                    <td className="p-4 text-center font-semibold text-primary">{estimatedSalary.toLocaleString()} ر.س</td>
                    <td className="p-4 text-center">
                      <span className={reachedTarget ? 'badge-success' : 'badge-warning'}>{reachedTarget ? 'وصل ✅' : 'لم يصل'}</span>
                    </td>
                    <td className="p-4 text-center text-muted-foreground">{avgDaily}</td>
                    <td className="p-4 text-center"><span className="badge-info">معلق</span></td>
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

const Orders = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Package size={24} /> الطلبات اليومية</h1>
      <p className="text-sm text-muted-foreground mt-1">إدخال ومتابعة طلبات المناديب</p>
    </div>
    <Tabs defaultValue="entry" dir="rtl">
      <TabsList>
        <TabsTrigger value="entry">إدخال الطلبات</TabsTrigger>
        <TabsTrigger value="summary">ملخص الشهر</TabsTrigger>
      </TabsList>
      <TabsContent value="entry"><OrdersEntry /></TabsContent>
      <TabsContent value="summary"><MonthSummary /></TabsContent>
    </Tabs>
  </div>
);

export default Orders;
