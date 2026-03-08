import { useState, useEffect } from 'react';
import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign, Bell, ArrowUpRight, Package, MapPin, ShieldCheck, FileText, Car } from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useAppColors } from '@/hooks/useAppColors';

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

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

// ─── Platform Order Card (Row 1) ──────────────────────────────────
interface PlatformOrderCardProps {
  name: string;
  orders: number;
  totalOrders: number;
  brandColor: string;
  textColor: string;
}

const PlatformOrderCard = ({ name, orders, totalOrders, brandColor, textColor }: PlatformOrderCardProps) => {
  const pct = totalOrders > 0 ? Math.round((orders / totalOrders) * 100) : 0;
  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: brandColor, color: textColor }}>{name}</span>
        <span className="text-xs font-bold text-foreground">{orders.toLocaleString()}</span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: brandColor }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{pct}% من الإجمالي</span>
      </div>
    </div>
  );
};

// ─── Stat Mini Card ───────────────────────────────────────────────
const MiniStat = ({ label, value, sub, color = 'text-foreground' }: { label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1">
    <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
    <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
  </div>
);

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
    jeddahCount: 0, makkahCount: 0,
    hasLicense: 0, appliedLicense: 0, noLicense: 0,
  });
  const [ordersByApp, setOrdersByApp] = useState<{ app: string; orders: number; appId: string }[]>([]);
  const [ridersByApp, setRidersByApp] = useState<{ app: string; count: number; brandColor: string; textColor: string }[]>([]);
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

      const [empRes, attRes, advRes, ordersRes, weekAttRes, salaryRes, auditRes, empAppsRes, empDetailsRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('advances').select('amount').eq('status', 'active'),
        supabase.from('daily_orders').select('employee_id, app_id, orders_count, apps(id, name), employees(name)')
          .gte('date', currentMonth + '-01').lte('date', today),
        supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
        supabase.from('salary_records').select('net_salary').eq('month_year', currentMonth),
        supabase.from('audit_log').select('action, table_name, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('employee_apps').select('app_id, employee_id, apps(name, brand_color, text_color)').eq('status', 'active'),
        supabase.from('employees').select('city, license_status').eq('status', 'active'),
      ]);

      const activeEmployees = empRes.count || 0;
      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present' || a.status === 'late').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;
      const activeAdvances = advRes.data?.length || 0;
      const totalAdvancesAmount = advRes.data?.reduce((s, a) => s + (Number(a.amount) || 0), 0) || 0;
      const totalSalaries = salaryRes.data?.reduce((s, r) => s + (Number(r.net_salary) || 0), 0) || 0;

      // City & license stats
      const empDetails = empDetailsRes.data || [];
      const jeddahCount = empDetails.filter(e => e.city === 'jeddah').length;
      const makkahCount = empDetails.filter(e => e.city === 'makkah').length;
      const hasLicense = empDetails.filter(e => e.license_status === 'has_license').length;
      const appliedLicense = empDetails.filter(e => e.license_status === 'applied').length;
      const noLicense = empDetails.filter(e => e.license_status === 'no_license' || !e.license_status).length;

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
      setKpis({ activeEmployees, presentToday, absentToday, activeAdvances, totalAdvancesAmount, totalSalaries, totalOrders, jeddahCount, makkahCount, hasLicense, appliedLicense, noLicense });

      // Top 5 leaderboard
      const leaders = Object.entries(empOrderMap)
        .map(([id, d]) => ({ employeeId: id, name: d.name, orders: d.orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
      setLeaderboard(leaders);

      // Riders per app — unique employees per app from employee_apps
      const appRidersMap: Record<string, { count: number; brandColor: string; textColor: string }> = {};
      empAppsRes.data?.forEach(r => {
        const app = r.apps as any;
        if (!app?.name) return;
        if (!appRidersMap[app.name]) appRidersMap[app.name] = { count: 0, brandColor: app.brand_color || '#6366f1', textColor: app.text_color || '#fff' };
        appRidersMap[app.name].count++;
      });
      setRidersByApp(Object.entries(appRidersMap).map(([app, d]) => ({ app, ...d })));

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

  const Skeleton = ({ h = 'h-16', w = 'w-full' }: { h?: string; w?: string }) => (
    <div className={`${h} ${w} bg-muted/40 rounded-xl animate-pulse`} />
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Page header ──────────────────────────────── */}
      <div>
        <nav className="page-breadcrumb">
          <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span className="text-foreground font-medium">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</span>
        </nav>
        <h1 className="page-title">{lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}</h1>
      </div>

      {/* ── Row 1: Orders per platform + Total ────────────────── */}
      <div className="bg-card border border-border/50 rounded-xl p-4 animate-fade-in">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="icon-box-sm bg-orange-100 dark:bg-orange-500/15">
              <Package size={14} className="text-orange-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">طلبات هذا الشهر حسب المنصة</h3>
          </div>
          {!loading && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">الإجمالي:</span>
              <span className="text-lg font-black text-foreground">{kpis.totalOrders.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">طلب</span>
            </div>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <Skeleton key={i} h="h-20" />)}
          </div>
        ) : ordersByApp.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات طلبات لهذا الشهر</p>
        ) : (
          <div className={`grid gap-2 ${
            ordersByApp.length <= 2 ? 'grid-cols-2' :
            ordersByApp.length === 3 ? 'grid-cols-3' :
            'grid-cols-2 sm:grid-cols-4'
          }`}>
            {ordersByApp.sort((a, b) => b.orders - a.orders).map(({ app, orders }) => {
              const colorData = appColors.find(a => a.name === app);
              return (
                <PlatformOrderCard
                  key={app}
                  name={app}
                  orders={orders}
                  totalOrders={kpis.totalOrders}
                  brandColor={colorData?.brand_color || '#6366f1'}
                  textColor={colorData?.text_color || '#ffffff'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Row 2: Riders overview ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: riders per platform */}
        <div className="bg-card border border-border/50 rounded-xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-box-sm bg-brand-50 dark:bg-brand-500/15">
              <Users size={14} className="text-brand-500" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">المناديب حسب المنصة</h3>
            {!loading && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full mr-auto font-semibold">
                {kpis.activeEmployees} مندوب نشط
              </span>
            )}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <Skeleton key={i} h="h-14" />)}</div>
          ) : ridersByApp.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا يوجد مناديب مرتبطون بمنصات</p>
          ) : (
            <div className={`grid gap-2 ${ridersByApp.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
              {ridersByApp.sort((a, b) => b.count - a.count).map(({ app, count, brandColor, textColor }) => (
                <div key={app} className="flex items-center gap-2 rounded-xl p-2.5 border border-border/50">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ backgroundColor: brandColor, color: textColor }}>
                    {app.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{app}</p>
                    <p className="text-base font-black text-foreground leading-tight">{count}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Attendance + License + City stats */}
        <div className="bg-card border border-border/50 rounded-xl p-4 animate-fade-in space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="icon-box-sm bg-success/10">
              <UserCheck size={14} className="text-success" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">إحصائيات المناديب</h3>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} h="h-14" />)}</div>
          ) : (
            <>
              {/* Attendance row */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">الحضور اليوم</p>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="حاضر" value={kpis.presentToday} color="text-success" />
                  <MiniStat label="غائب" value={kpis.absentToday} color="text-destructive" />
                  <MiniStat label="إجمالي نشطين" value={kpis.activeEmployees} color="text-primary" />
                </div>
              </div>

              {/* License row */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">الرخص</p>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="لديه رخصة" value={kpis.hasLicense} color="text-success" />
                  <MiniStat label="تم التقديم" value={kpis.appliedLicense} color="text-warning" />
                  <MiniStat label="بدون رخصة" value={kpis.noLicense} color="text-muted-foreground" />
                </div>
              </div>

              {/* City row */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">المناطق</p>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label="🕌 مكة المكرمة" value={kpis.makkahCount} color="text-purple-600 dark:text-purple-400" />
                  <MiniStat label="🌊 جدة" value={kpis.jeddahCount} color="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Row 3: Attendance chart + Alerts ────────────────── */}
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

      {/* ── Row 4: Finance KPIs + Leaderboard ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Finance cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
          {[
            { label: 'رواتب الشهر', value: `${kpis.totalSalaries.toLocaleString()} ر.س`, icon: Wallet, bg: 'bg-success/10', color: 'text-success' },
            { label: 'إجمالي السلف', value: `${kpis.totalAdvancesAmount.toLocaleString()} ر.س`, icon: CreditCard, bg: 'bg-warning/10', color: 'text-warning', sub: `${kpis.activeAdvances} سلف نشطة` },
            { label: 'إجمالي الطلبات', value: kpis.totalOrders.toLocaleString(), icon: Package, bg: 'bg-orange-100 dark:bg-orange-500/15', color: 'text-orange-500', sub: 'هذا الشهر' },
          ].map((card, i) => (
            <div key={i} className="metric-card animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-xl font-bold text-foreground leading-tight">{loading ? '—' : card.value}</p>
                  {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
                </div>
                <div className={`icon-box ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
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

      {/* ── Row 5: Recent activity ───────────────────────────── */}
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
