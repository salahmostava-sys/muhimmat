import { useState, useEffect } from 'react';
import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign, Bell, ArrowUpRight, Package } from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useAppColors } from '@/hooks/useAppColors';

// ─── KPI Metric Card ──────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: string | number;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
  trend?: number;
}

const MetricCard = ({ title, value, icon: Icon, iconBg, iconColor, subtitle, trend }: MetricCardProps) => (
  <div className="metric-card animate-fade-in">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground leading-tight tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        {trend !== undefined && (
          <div className={cn(
            'inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-0.5 rounded-full',
            trend >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          )}>
            <ArrowUpRight size={11} className={trend < 0 ? 'rotate-90' : ''} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className={`icon-box ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
  </div>
);

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Chart container ──────────────────────────────────────────────
const ChartCard = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="chart-card animate-fade-in">
    <div className="chart-card-header">
      <h3 className="chart-card-title">{title}</h3>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-card-hover px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

// ─── Platform Order Card ──────────────────────────────────────────
interface PlatformCardProps {
  name: string;
  orders: number;
  totalOrders: number;
  employeeCount: number;
  brandColor: string;
  textColor: string;
}

const PlatformCard = ({ name, orders, totalOrders, employeeCount, brandColor, textColor }: PlatformCardProps) => {
  const pct = totalOrders > 0 ? Math.round((orders / totalOrders) * 100) : 0;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: brandColor, color: textColor }}>{name}</span>
        <span className="text-xs text-muted-foreground">{employeeCount} مندوب</span>
      </div>
      <div>
        <p className="text-3xl font-extrabold text-foreground leading-none">{orders.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-0.5">طلب هذا الشهر</p>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>النسبة من الإجمالي</span>
          <span className="font-semibold" style={{ color: brandColor }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: brandColor }} />
        </div>
      </div>
    </div>
  );
};

// ─── Leaderboard ──────────────────────────────────────────────────
interface LeaderEntry { employeeId: string; name: string; orders: number; }
const RANK_ICONS = ['🥇', '🥈', '🥉'];

const Leaderboard = ({ leaders, loading }: { leaders: LeaderEntry[]; loading: boolean }) => {
  const maxOrders = leaders[0]?.orders || 1;
  return (
    <div className="space-y-2">
      {loading
        ? Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted/40 rounded-xl animate-pulse" />
        ))
        : leaders.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات طلبات هذا الشهر</p>
          : leaders.map((l, i) => {
            const pct = Math.round((l.orders / maxOrders) * 100);
            return (
              <div key={l.employeeId} className="flex items-center gap-3 group">
                <span className="text-base w-7 text-center flex-shrink-0">
                  {i < 3 ? RANK_ICONS[i] : <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {l.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-foreground truncate">{l.name}</span>
                    <span className="text-xs font-bold text-foreground ml-2 flex-shrink-0">{l.orders.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7F32' : 'hsl(var(--primary))',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = () => {
  const { lang } = useLanguage();
  const { apps: appColors } = useAppColors();

  const [kpis, setKpis] = useState({
    activeEmployees: 0, presentToday: 0, absentToday: 0,
    activeAdvances: 0, totalAdvancesAmount: 0, totalSalaries: 0, totalOrders: 0,
  });
  const [ordersByApp, setOrdersByApp] = useState<{ app: string; orders: number; appId: string }[]>([]);
  const [employeeCountByApp, setEmployeeCountByApp] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
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

      const [empRes, attRes, advRes, ordersRes, weekAttRes, salaryRes, auditRes, empAppsRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('advances').select('amount').eq('status', 'active'),
        supabase.from('daily_orders').select('employee_id, app_id, orders_count, apps(id, name), employees(name)')
          .gte('date', currentMonth + '-01').lte('date', today),
        supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
        supabase.from('salary_records').select('net_salary').eq('month_year', currentMonth),
        supabase.from('audit_log').select('action, table_name, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('employee_apps').select('app_id, apps(name)').eq('status', 'active'),
      ]);

      const activeEmployees = empRes.count || 0;
      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;
      const activeAdvances = advRes.data?.length || 0;
      const totalAdvancesAmount = advRes.data?.reduce((s, a) => s + (Number(a.amount) || 0), 0) || 0;
      const totalSalaries = salaryRes.data?.reduce((s, r) => s + (Number(r.net_salary) || 0), 0) || 0;

      // Build app orders map + leaderboard
      const appTotals: Record<string, { orders: number; appId: string }> = {};
      const empOrderMap: Record<string, { name: string; orders: number }> = {};

      ordersRes.data?.forEach(r => {
        const appName = (r.apps as any)?.name || 'غير معروف';
        const appId = (r.apps as any)?.id || r.app_id;
        if (!appTotals[appName]) appTotals[appName] = { orders: 0, appId };
        appTotals[appName].orders += r.orders_count;

        const empName = (r.employees as any)?.name || '';
        if (empName) {
          if (!empOrderMap[r.employee_id]) empOrderMap[r.employee_id] = { name: empName, orders: 0 };
          empOrderMap[r.employee_id].orders += r.orders_count;
        }
      });

      const ordersArr = Object.entries(appTotals).map(([app, d]) => ({ app, orders: d.orders, appId: d.appId }));
      const totalOrders = ordersArr.reduce((s, r) => s + r.orders, 0);
      setOrdersByApp(ordersArr);
      setKpis({ activeEmployees, presentToday, absentToday, activeAdvances, totalAdvancesAmount, totalSalaries, totalOrders });

      // Top 5 leaderboard
      const leaders = Object.entries(empOrderMap)
        .map(([id, d]) => ({ employeeId: id, name: d.name, orders: d.orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
      setLeaderboard(leaders);

      // Employee count per app
      const empByApp: Record<string, number> = {};
      empAppsRes.data?.forEach(r => {
        const name = (r.apps as any)?.name;
        if (name) empByApp[name] = (empByApp[name] || 0) + 1;
      });
      setEmployeeCountByApp(empByApp);

      // Weekly attendance
      const weekMap: Record<string, { present: number; absent: number; leave: number }> = {};
      weekAttRes.data?.forEach(r => {
        if (!weekMap[r.date]) weekMap[r.date] = { present: 0, absent: 0, leave: 0 };
        if (r.status === 'present' || r.status === 'late') weekMap[r.date].present++;
        else if (r.status === 'absent') weekMap[r.date].absent++;
        else if (r.status === 'leave' || r.status === 'sick') weekMap[r.date].leave++;
      });
      const dayNames = lang === 'ar'
        ? ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
        : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      setAttendanceWeek(
        Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ day: dayNames[new Date(date + 'T12:00:00').getDay()], ...counts }))
      );

      if (auditRes.data?.length) {
        const iconMap: Record<string, typeof Users> = {
          employees: Users, attendance: UserCheck, advances: CreditCard,
          salary_records: Wallet, daily_orders: TrendingUp, vehicles: DollarSign,
        };
        setRecentActivity(auditRes.data.map(a => ({
          text: `${a.action} — ${a.table_name}`,
          time: formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true }),
          icon: iconMap[a.table_name] || TrendingUp,
        })));
      }

      setLoading(false);
    };
    fetchDashboard();
  }, [lang]);

  const kpiCards: MetricCardProps[] = [
    { title: lang === 'ar' ? 'المناديب النشطين' : 'Active Employees', value: loading ? '—' : kpis.activeEmployees, icon: Users, iconBg: 'bg-brand-50 dark:bg-brand-500/15', iconColor: 'text-brand-500' },
    { title: lang === 'ar' ? 'رواتب الشهر' : 'Monthly Salaries', value: loading ? '—' : `${kpis.totalSalaries.toLocaleString()} ر.س`, icon: Wallet, iconBg: 'bg-success/10', iconColor: 'text-success' },
    { title: lang === 'ar' ? 'الحاضرين اليوم' : 'Present Today', value: loading ? '—' : kpis.presentToday, icon: UserCheck, iconBg: 'bg-info/10', iconColor: 'text-info', subtitle: lang === 'ar' ? `غائب: ${kpis.absentToday}` : `Absent: ${kpis.absentToday}` },
    { title: lang === 'ar' ? 'إجمالي السلف' : 'Total Advances', value: loading ? '—' : `${kpis.totalAdvancesAmount.toLocaleString()} ر.س`, icon: CreditCard, iconBg: 'bg-warning/10', iconColor: 'text-warning', subtitle: lang === 'ar' ? `${kpis.activeAdvances} سلف نشطة` : `${kpis.activeAdvances} active` },
    { title: lang === 'ar' ? 'إجمالي الطلبات' : 'Total Orders', value: loading ? '—' : kpis.totalOrders.toLocaleString(), icon: Package, iconBg: 'bg-orange-100 dark:bg-orange-500/15', iconColor: 'text-orange-500', subtitle: lang === 'ar' ? 'هذا الشهر' : 'This month' },
    { title: lang === 'ar' ? 'التنبيهات' : 'Alerts', value: loading ? '—' : kpis.absentToday, icon: Bell, iconBg: 'bg-destructive/10', iconColor: 'text-destructive' },
  ];

  const platformGridCols =
    ordersByApp.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' :
    ordersByApp.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
    'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Row 0: Page header ──────────────────────────────── */}
      <div className="page-header">
        <div className="page-breadcrumb">
          <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span className="text-foreground font-medium">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
        </div>
        <h1 className="page-title">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>
        <p className="page-subtitle">{lang === 'ar' ? 'نظرة عامة على النظام' : 'System overview'}</p>
      </div>

      {/* ── Row 1: KPI cards ────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpiCards.map((card, i) => <MetricCard key={i} {...card} />)}
      </div>

      {/* ── Row 2: Attendance chart + Alerts ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title={lang === 'ar' ? 'الحضور هذا الأسبوع' : 'Weekly Attendance'}>
            {attendanceWeek.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
                {lang === 'ar' ? 'لا توجد بيانات حضور' : 'No attendance data'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={attendanceWeek} barGap={4} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="present" name={lang === 'ar' ? 'حاضر' : 'Present'} fill="#12B76A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" name={lang === 'ar' ? 'غائب' : 'Absent'} fill="#F04438" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="leave" name={lang === 'ar' ? 'إجازة' : 'Leave'} fill="#F79009" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
        <AlertsList />
      </div>

      {/* ── Row 3: Platform cards + Leaderboard ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Platform cards — takes 2 cols */}
        <div className="lg:col-span-2 chart-card animate-fade-in">
          <div className="chart-card-header">
            <h3 className="chart-card-title">{lang === 'ar' ? 'الطلبات حسب المنصة' : 'Orders by Platform'}</h3>
            {!loading && kpis.totalOrders > 0 && (
              <span className="text-xs text-muted-foreground">
                {lang === 'ar' ? `الإجمالي: ${kpis.totalOrders.toLocaleString()} طلب` : `Total: ${kpis.totalOrders.toLocaleString()} orders`}
              </span>
            )}
          </div>
          <div className="p-5">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="bg-muted/40 rounded-xl h-32 animate-pulse" />)}
              </div>
            ) : ordersByApp.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                {lang === 'ar' ? 'لا توجد بيانات طلبات لهذا الشهر' : 'No orders data this month'}
              </div>
            ) : (
              <div className={`grid ${platformGridCols} gap-3`}>
                {ordersByApp.sort((a, b) => b.orders - a.orders).map(({ app, orders }) => {
                  const colorData = appColors.find(a => a.name === app);
                  return (
                    <PlatformCard
                      key={app}
                      name={app}
                      orders={orders}
                      totalOrders={kpis.totalOrders}
                      employeeCount={employeeCountByApp[app] || 0}
                      brandColor={colorData?.brand_color || '#6366f1'}
                      textColor={colorData?.text_color || '#ffffff'}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top 5 leaderboard */}
        <ChartCard
          title={lang === 'ar' ? 'أفضل 5 مناديب' : 'Top 5 Riders'}
          action={
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {lang === 'ar' ? 'هذا الشهر' : 'This month'}
            </span>
          }
        >
          <Leaderboard leaders={leaderboard} loading={loading} />
        </ChartCard>
      </div>

      {/* ── Row 4: Recent activity ───────────────────────────── */}
      <ChartCard title={lang === 'ar' ? 'آخر النشاطات' : 'Recent Activity'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 -mx-1">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
              <div className="icon-box-sm bg-brand-50 dark:bg-brand-500/15 flex-shrink-0">
                <item.icon size={14} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{item.text}</p>
                {item.time && <p className="text-xs text-muted-foreground">{item.time}</p>}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
};

export default Dashboard;
