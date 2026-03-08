import { useState, useEffect } from 'react';
import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign } from 'lucide-react';
import StatCard from '@/components/StatCard';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(217,72%,45%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)'];

const Dashboard = () => {
  const [kpis, setKpis] = useState({
    activeEmployees: 0,
    presentToday: 0,
    absentToday: 0,
    activeAdvances: 0,
    totalAdvancesAmount: 0,
    totalSalaries: 0,
  });
  const [ordersByApp, setOrdersByApp] = useState<{ app: string; orders: number }[]>([]);
  const [attendanceWeek, setAttendanceWeek] = useState<{ day: string; present: number; absent: number; leave: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string; icon: typeof Users }[]>([
    { text: 'لا توجد نشاطات حديثة', time: '', icon: TrendingUp },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');
      const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

      const [empRes, attRes, advRes, ordersRes, weekAttRes, salaryRes, auditRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('advances').select('amount').eq('status', 'active'),
        supabase.from('daily_orders').select('app_id, orders_count, apps(name)').gte('date', currentMonth + '-01').lte('date', today),
        supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
        supabase.from('salary_records').select('net_salary').eq('month_year', currentMonth),
        supabase.from('audit_log').select('action, table_name, created_at').order('created_at', { ascending: false }).limit(6),
      ]);

      // KPIs
      const activeEmployees = empRes.count || 0;
      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;
      const activeAdvances = advRes.data?.length || 0;
      const totalAdvancesAmount = advRes.data?.reduce((s, a) => s + (Number(a.amount) || 0), 0) || 0;
      const totalSalaries = salaryRes.data?.reduce((s, r) => s + (Number(r.net_salary) || 0), 0) || 0;
      setKpis({ activeEmployees, presentToday, absentToday, activeAdvances, totalAdvancesAmount, totalSalaries });

      // Orders by app for pie chart
      const appTotals: Record<string, number> = {};
      ordersRes.data?.forEach(r => {
        const name = (r.apps as any)?.name || 'غير معروف';
        appTotals[name] = (appTotals[name] || 0) + r.orders_count;
      });
      setOrdersByApp(Object.entries(appTotals).map(([app, orders]) => ({ app, orders })));

      // Weekly attendance — group by date
      const weekMap: Record<string, { present: number; absent: number; leave: number }> = {};
      weekAttRes.data?.forEach(r => {
        if (!weekMap[r.date]) weekMap[r.date] = { present: 0, absent: 0, leave: 0 };
        if (r.status === 'present' || r.status === 'late') weekMap[r.date].present++;
        else if (r.status === 'absent') weekMap[r.date].absent++;
        else if (r.status === 'leave' || r.status === 'sick') weekMap[r.date].leave++;
      });
      const dayNames = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
      const weekData = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({
          day: dayNames[new Date(date + 'T12:00:00').getDay()],
          ...counts,
        }));
      setAttendanceWeek(weekData);

      // Activity feed from audit_log
      if (auditRes.data && auditRes.data.length > 0) {
        const iconMap: Record<string, typeof Users> = {
          employees: Users,
          attendance: UserCheck,
          advances: CreditCard,
          salary_records: Wallet,
          daily_orders: TrendingUp,
          vehicles: DollarSign,
        };
        setRecentActivity(
          auditRes.data.map(a => ({
            text: `${a.action} — ${a.table_name}`,
            time: formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true }),
            icon: iconMap[a.table_name] || TrendingUp,
          }))
        );
      }

      setLoading(false);
    };

    fetchDashboard();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">لوحة التحكم</h1>
        <p className="page-subtitle mt-1">نظرة عامة على النظام</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <StatCard title="المناديب النشطين" value={loading ? '...' : kpis.activeEmployees} icon={Users} color="primary" />
        <StatCard title="رواتب الشهر" value={loading ? '...' : `${kpis.totalSalaries.toLocaleString()} ر.س`} icon={Wallet} color="success" />
        <StatCard title="الحاضرين اليوم" value={loading ? '...' : kpis.presentToday} icon={UserCheck} color="info" subtitle={`غائب: ${kpis.absentToday}`} />
        <StatCard title="السلف القائمة" value={loading ? '...' : `${kpis.totalAdvancesAmount.toLocaleString()} ر.س`} icon={CreditCard} color="warning" subtitle={`${kpis.activeAdvances} سلف`} />
        <StatCard title="السلف النشطة" value={loading ? '...' : kpis.activeAdvances} icon={DollarSign} color="primary" />
        <StatCard title="حاضر / غائب" value={loading ? '...' : `${kpis.presentToday} / ${kpis.absentToday}`} icon={TrendingUp} color="success" />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">الحضور هذا الأسبوع</h3>
          {attendanceWeek.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              لا توجد بيانات حضور للأسبوع الحالي
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={attendanceWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="present" name="حاضر" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" name="غائب" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leave" name="إجازة" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <AlertsList />
      </div>

      {/* Orders + P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">الطلبات حسب التطبيق</h3>
          {ordersByApp.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
              لا توجد بيانات طلبات هذا الشهر
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ordersByApp} dataKey="orders" nameKey="app" cx="50%" cy="50%" outerRadius={80}
                  label={({ app, percent }) => `${app} ${(percent * 100).toFixed(0)}%`}>
                  {ordersByApp.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4 sm:p-5">
          <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">آخر النشاطات</h3>
          <div className="space-y-1">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <item.icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.text}</p>
                  {item.time && <p className="text-xs text-muted-foreground">{item.time}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
