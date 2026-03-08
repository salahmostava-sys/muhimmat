import { useState, useEffect } from 'react';
import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign, Bell, ArrowUpRight } from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useLanguage } from '@/context/LanguageContext';

// TailAdmin brand colors
const CHART_COLORS = ['#6172F3', '#12B76A', '#F79009', '#F04438', '#7C3AED', '#0EA5E9'];

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
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
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
const ChartCard = ({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
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
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = () => {
  const { lang } = useLanguage();

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

      const activeEmployees = empRes.count || 0;
      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;
      const activeAdvances = advRes.data?.length || 0;
      const totalAdvancesAmount = advRes.data?.reduce((s, a) => s + (Number(a.amount) || 0), 0) || 0;
      const totalSalaries = salaryRes.data?.reduce((s, r) => s + (Number(r.net_salary) || 0), 0) || 0;
      setKpis({ activeEmployees, presentToday, absentToday, activeAdvances, totalAdvancesAmount, totalSalaries });

      const appTotals: Record<string, number> = {};
      ordersRes.data?.forEach(r => {
        const name = (r.apps as any)?.name || 'غير معروف';
        appTotals[name] = (appTotals[name] || 0) + r.orders_count;
      });
      setOrdersByApp(Object.entries(appTotals).map(([app, orders]) => ({ app, orders })));

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
      const weekData = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({
          day: dayNames[new Date(date + 'T12:00:00').getDay()],
          ...counts,
        }));
      setAttendanceWeek(weekData);

      if (auditRes.data && auditRes.data.length > 0) {
        const iconMap: Record<string, typeof Users> = {
          employees: Users, attendance: UserCheck, advances: CreditCard,
          salary_records: Wallet, daily_orders: TrendingUp, vehicles: DollarSign,
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
  }, [lang]);

  const kpiCards: MetricCardProps[] = [
    {
      title: lang === 'ar' ? 'المناديب النشطين' : 'Active Employees',
      value: loading ? '—' : kpis.activeEmployees,
      icon: Users,
      iconBg: 'bg-brand-50 dark:bg-brand-500/15',
      iconColor: 'text-brand-500',
    },
    {
      title: lang === 'ar' ? 'رواتب الشهر' : 'Monthly Salaries',
      value: loading ? '—' : `${kpis.totalSalaries.toLocaleString()} ر.س`,
      icon: Wallet,
      iconBg: 'bg-success/10',
      iconColor: 'text-success',
    },
    {
      title: lang === 'ar' ? 'الحاضرين اليوم' : 'Present Today',
      value: loading ? '—' : kpis.presentToday,
      icon: UserCheck,
      iconBg: 'bg-info/10',
      iconColor: 'text-info',
      subtitle: lang === 'ar' ? `غائب: ${kpis.absentToday}` : `Absent: ${kpis.absentToday}`,
    },
    {
      title: lang === 'ar' ? 'إجمالي السلف' : 'Total Advances',
      value: loading ? '—' : `${kpis.totalAdvancesAmount.toLocaleString()} ر.س`,
      icon: CreditCard,
      iconBg: 'bg-warning/10',
      iconColor: 'text-warning',
      subtitle: lang === 'ar' ? `${kpis.activeAdvances} سلف نشطة` : `${kpis.activeAdvances} active`,
    },
    {
      title: lang === 'ar' ? 'السلف النشطة' : 'Active Advances',
      value: loading ? '—' : kpis.activeAdvances,
      icon: DollarSign,
      iconBg: 'bg-brand-50 dark:bg-brand-500/15',
      iconColor: 'text-brand-500',
    },
    {
      title: lang === 'ar' ? 'التنبيهات' : 'Alerts',
      value: loading ? '—' : kpis.absentToday,
      icon: Bell,
      iconBg: 'bg-destructive/10',
      iconColor: 'text-destructive',
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Page header ────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-breadcrumb">
          <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span className="text-foreground font-medium">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
        </div>
        <h1 className="page-title">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>
        <p className="page-subtitle">{lang === 'ar' ? 'نظرة عامة على النظام' : 'System overview'}</p>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpiCards.map((card, i) => (
          <MetricCard key={i} {...card} />
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Weekly attendance bar chart */}
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

        {/* Alerts */}
        <AlertsList />
      </div>

      {/* ── Bottom row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Orders by platform donut */}
        <ChartCard title={lang === 'ar' ? 'الطلبات حسب التطبيق' : 'Orders by Platform'}>
          {ordersByApp.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              {lang === 'ar' ? 'لا توجد بيانات طلبات' : 'No orders data'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={ordersByApp}
                  dataKey="orders"
                  nameKey="app"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {ordersByApp.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Recent activity */}
        <ChartCard title={lang === 'ar' ? 'آخر النشاطات' : 'Recent Activity'}>
          <div className="space-y-1 -mx-1">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
              >
                <div className="icon-box-sm bg-brand-50 dark:bg-brand-500/15 flex-shrink-0">
                  <item.icon size={14} className="text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.text}</p>
                  {item.time && (
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

export default Dashboard;
