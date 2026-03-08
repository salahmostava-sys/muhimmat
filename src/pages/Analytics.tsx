import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, Award, Users, Package, Wallet, ArrowUpRight, ArrowDownRight, BarChart2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import * as XLSX from '@e965/xlsx';

interface AppStat { id: string; name: string; brand_color: string; text_color: string; orders: number; }
interface TopRider { id: string; name: string; orders: number; app: string; appColor: string; }
interface MonthlyTrend { month: string; orders: number; }

const MONTHS_BACK = 6;

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [appStats, setAppStats] = useState<AppStat[]>([]);
  const [topRiders, setTopRiders] = useState<TopRider[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalSalariesPaid, setTotalSalariesPaid] = useState(0);
  const [prevMonthOrders, setPrevMonthOrders] = useState(0);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const [appsRes, empRes, salRes] = await Promise.all([
        supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('salary_records').select('net_salary').eq('month_year', currentMonth).eq('is_approved', true),
      ]);

      setTotalEmployees(empRes.count || 0);
      setTotalSalariesPaid(salRes.data?.reduce((s, r) => s + (r.net_salary || 0), 0) || 0);

      const apps = appsRes.data || [];

      // Per-app orders this month
      const appStatsData: AppStat[] = await Promise.all(
        apps.map(async app => {
          const { data } = await supabase
            .from('daily_orders')
            .select('orders_count')
            .eq('app_id', app.id)
            .gte('date', `${currentMonth}-01`)
            .lte('date', `${currentMonth}-31`);
          const orders = data?.reduce((s, r) => s + r.orders_count, 0) || 0;
          return { ...app, orders };
        })
      );
      setAppStats(appStatsData.sort((a, b) => b.orders - a.orders));
      setTotalOrders(appStatsData.reduce((s, a) => s + a.orders, 0));

      // Previous month orders for trend
      const { data: prevOrders } = await supabase
        .from('daily_orders')
        .select('orders_count')
        .gte('date', `${prevMonth}-01`)
        .lte('date', `${prevMonth}-31`);
      setPrevMonthOrders(prevOrders?.reduce((s, r) => s + r.orders_count, 0) || 0);

      // Top riders this month
      const { data: empOrders } = await supabase
        .from('daily_orders')
        .select('employee_id, orders_count, app_id')
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`);

      const { data: empNames } = await supabase.from('employees').select('id, name').eq('status', 'active');
      const empMap = Object.fromEntries((empNames || []).map(e => [e.id, e.name]));
      const appMap = Object.fromEntries(apps.map(a => [a.id, { name: a.name, color: a.brand_color }]));

      const riderTotals: Record<string, { orders: number; app: string; appColor: string }> = {};
      (empOrders || []).forEach(o => {
        if (!riderTotals[o.employee_id]) {
          riderTotals[o.employee_id] = { orders: 0, app: appMap[o.app_id]?.name || '—', appColor: appMap[o.app_id]?.color || '#888' };
        }
        riderTotals[o.employee_id].orders += o.orders_count;
      });

      const topList = Object.entries(riderTotals)
        .map(([id, v]) => ({ id, name: empMap[id] || 'غير معروف', ...v }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 10);
      setTopRiders(topList);

      // Monthly trend (last 6 months)
      const trend: MonthlyTrend[] = [];
      for (let i = MONTHS_BACK - 1; i >= 0; i--) {
        const m = format(subMonths(new Date(), i), 'yyyy-MM');
        const mLabel = format(subMonths(new Date(), i), 'MMM yy');
        const start = format(startOfMonth(subMonths(new Date(), i)), 'yyyy-MM-dd');
        const end = format(endOfMonth(subMonths(new Date(), i)), 'yyyy-MM-dd');
        const { data } = await supabase
          .from('daily_orders')
          .select('orders_count')
          .gte('date', start)
          .lte('date', end);
        trend.push({ month: mLabel, orders: data?.reduce((s, r) => s + r.orders_count, 0) || 0 });
      }
      setMonthlyTrend(trend);

      setLoading(false);
    };
    load();
  }, []);

  const orderGrowth = prevMonthOrders > 0 ? ((totalOrders - prevMonthOrders) / prevMonthOrders) * 100 : 0;
  const isGrowthPositive = orderGrowth >= 0;

  const handleExport = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appStats.map(a => ({ المنصة: a.name, الطلبات: a.orders }))), 'المنصات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topRiders.map((r, i) => ({ '#': i + 1, المندوب: r.name, المنصة: r.app, الطلبات: r.orders }))), 'أفضل المناديب');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyTrend.map(m => ({ الشهر: m.month, الطلبات: m.orders }))), 'الاتجاه الشهري');
    XLSX.writeFile(wb, `تحليلات_${currentMonth}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <BarChart2 size={40} className="mx-auto text-primary animate-pulse" />
        <p className="text-muted-foreground">جارٍ تحميل التحليلات...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span><span className="page-breadcrumb-sep">/</span><span>التحليلات</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="page-title flex items-center gap-2"><TrendingUp size={20} /> لوحة التحليلات</h1>
            <p className="page-subtitle">أداء المنصات والمناديب — {format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download size={15} /> تصدير Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
            <Package size={18} className="text-primary" />
          </div>
          <p className="text-3xl font-bold text-foreground">{totalOrders.toLocaleString()}</p>
          <div className={`flex items-center gap-1 text-xs mt-2 font-medium ${isGrowthPositive ? 'text-success' : 'text-destructive'}`}>
            {isGrowthPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(orderGrowth).toFixed(1)}% مقارنة بالشهر السابق
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">المناديب النشطون</p>
            <Users size={18} className="text-info" />
          </div>
          <p className="text-3xl font-bold text-foreground">{totalEmployees}</p>
          <p className="text-xs text-muted-foreground mt-2">موظف نشط</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">الرواتب المدفوعة</p>
            <Wallet size={18} className="text-success" />
          </div>
          <p className="text-3xl font-bold text-foreground">{totalSalariesPaid.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">ريال هذا الشهر</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">متوسط الطلبات/مندوب</p>
            <Award size={18} className="text-warning" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {totalEmployees > 0 ? Math.round(totalOrders / totalEmployees) : 0}
          </p>
          <p className="text-xs text-muted-foreground mt-2">طلب/مندوب هذا الشهر</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly trend */}
        <div className="lg:col-span-2 chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">اتجاه الطلبات الشهري</h3>
            <p className="chart-card-subtitle">آخر {MONTHS_BACK} أشهر</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line type="monotone" dataKey="orders" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 4 }} name="الطلبات" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform distribution */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-card-title">توزيع المنصات</h3>
          </div>
          <div className="p-4 flex flex-col items-center">
            {appStats.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={appStats} dataKey="orders" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                      {appStats.map(a => <Cell key={a.id} fill={a.brand_color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      formatter={(v: any) => [v.toLocaleString(), 'طلب']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-1.5 mt-2">
                  {appStats.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.brand_color }} />
                        <span className="text-foreground font-medium">{a.name}</span>
                      </div>
                      <span className="text-muted-foreground">{a.orders.toLocaleString()} طلب</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8">لا توجد بيانات</p>
            )}
          </div>
        </div>
      </div>

      {/* Platform bar chart */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title">أداء المنصات هذا الشهر</h3>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={appStats} margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                formatter={(v: any) => [v.toLocaleString(), 'طلب']}
              />
              <Bar dataKey="orders" radius={[6, 6, 0, 0]} name="الطلبات">
                {appStats.map(a => <Cell key={a.id} fill={a.brand_color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Riders */}
      <div className="chart-card">
        <div className="chart-card-header">
          <h3 className="chart-card-title flex items-center gap-2"><Award size={16} className="text-warning" /> أفضل 10 مناديب</h3>
          <p className="chart-card-subtitle">حسب عدد الطلبات هذا الشهر</p>
        </div>
        <div className="divide-y divide-border/40">
          {topRiders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">لا توجد بيانات طلبات هذا الشهر</div>
          ) : topRiders.map((rider, idx) => (
            <div key={rider.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                ${idx === 0 ? 'bg-warning/20 text-warning' : idx === 1 ? 'bg-muted-foreground/20 text-muted-foreground' : idx === 2 ? 'bg-orange-500/20 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{rider.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rider.appColor }} />
                  <p className="text-xs text-muted-foreground">{rider.app}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-foreground">{rider.orders.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">طلب</p>
              </div>
              {/* Progress bar */}
              <div className="w-24 hidden md:block">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${topRiders[0].orders > 0 ? (rider.orders / topRiders[0].orders) * 100 : 0}%`, backgroundColor: rider.appColor }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
