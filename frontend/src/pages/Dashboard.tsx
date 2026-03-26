/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, forwardRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Users, UserCheck, Bell, Package, Bike, Smartphone,
  TrendingUp, ArrowUpRight, ArrowDownRight, Award,
  BarChart2, Activity, MapPin,
  Target, Clock, ChevronUp, ChevronDown, DollarSign,
  Minus, Settings2,
} from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { dashboardService } from '@services/dashboardService';
import {
  format, formatDistanceToNow,
  subMonths, startOfMonth, endOfMonth, getDaysInMonth, getDate,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Legend,
} from 'recharts';
import { useRealtimePostgresChanges, REALTIME_TABLES_DASHBOARD } from '@/hooks/useRealtimePostgresChanges';
import { useMonthlyActiveEmployeeIds } from '@/hooks/useMonthlyActiveEmployeeIds';
import { isEmployeeVisibleInMonth } from '@/lib/employeeVisibility';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

const SKELETON_KEYS_2 = ['sk-1', 'sk-2'] as const;
const SKELETON_KEYS_4 = ['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const;
const SKELETON_KEYS_5 = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const;

const parsePositiveIntOrNull = (raw: string) => {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 1) return null;
  return n;
};


// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ h = 'h-16', w = 'w-full' }: { h?: string; w?: string }) => (
  <div className={`${h} ${w} bg-muted/40 rounded-xl animate-pulse`} />
);

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = forwardRef<HTMLDivElement, any>(({ active, payload, label }, ref) => {
  if (!active || !payload?.length) return null;
  return (
    <div ref={ref} className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={`${p.dataKey ?? p.name}-${p.name}`} style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
});
CustomTooltip.displayName = 'CustomTooltip';

// ─── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="bg-card rounded-2xl shadow-card overflow-hidden">
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, color, bg, sub, trend, loading }: {
  label: string; value: string | number; icon: any;
  color: string; bg: string; sub?: string;
  trend?: { value: number; positive: boolean }; loading?: boolean;
}) => (
  <div className="bg-card rounded-2xl p-4 shadow-card flex flex-col gap-3 hover:shadow-card-hover transition-shadow">
    {loading ? (
      <><div className="h-9 w-9 rounded-xl bg-muted/40 animate-pulse" /><div className="h-7 w-20 bg-muted/40 animate-pulse rounded-lg" /><div className="h-3 w-28 bg-muted/40 animate-pulse rounded" /></>
    ) : (
      <>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}><Icon size={18} className={color} /></div>
        <div>
          <p className="text-2xl font-black text-foreground leading-none">{value}</p>
          {trend && (
            <div className={`flex items-center gap-0.5 mt-1 text-[11px] font-semibold ${trend.positive ? 'text-emerald-600' : 'text-rose-500'}`}>
              {trend.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(trend.value).toFixed(1)}%
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground/75">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{sub}</p>}
        </div>
      </>
    )}
  </div>
);

// ─── Stat Chip ────────────────────────────────────────────────────────────────
const Chip = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className={`rounded-xl px-3 py-2 ${color}`}>
    <p className="text-xl font-black leading-none">{value}</p>
    <p className="text-[10px] font-semibold mt-1 opacity-80 leading-tight">{label}</p>
  </div>
);

// ─── Rank Colors ──────────────────────────────────────────────────────────────
const RANK_COLORS = ['bg-amber-100 text-amber-600', 'bg-slate-100 text-slate-500', 'bg-orange-100 text-orange-500'];

// ─── Leaderboard ─────────────────────────────────────────────────────────────
const Leaderboard = ({ entries, loading, max }: { entries: { name: string; orders: number; app?: string; appColor?: string }[]; loading: boolean; max?: number }) => {
  const maxVal = max || entries[0]?.orders || 1;
  return (
    <div className="space-y-1">
      {loading
        ? SKELETON_KEYS_5.map((k) => <div key={`leaderboard-skeleton-${k}`} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)
        : entries.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات هذا الشهر</p>
          : entries.map((e, i) => (
            <div key={`${e.name}-${e.orders}-${e.app ?? 'no-app'}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_COLORS[i] || 'bg-muted text-muted-foreground'}`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground truncate">{e.name}</span>
                  <span className="text-sm font-black text-foreground flex-shrink-0 ml-2">{e.orders.toLocaleString()}</span>
                </div>
                {e.app && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.appColor || '#888' }} />
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(e.orders / maxVal) * 100}%`, backgroundColor: e.appColor || '#888' }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
    </div>
  );
};

// ─── Target Bar ───────────────────────────────────────────────────────────────
const TargetBar = ({ name, actual, target, brandColor, textColor, riders }: {
  name: string; actual: number; target: number; brandColor: string; textColor: string; riders: number;
}) => {
  const pct = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
  const over = target > 0 && actual > target;
  let badgeCls = 'bg-rose-50 text-rose-600';
  if (over) badgeCls = 'bg-emerald-50 text-emerald-700';
  else if (pct >= 75) badgeCls = 'bg-amber-50 text-amber-700';
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: brandColor, color: textColor }}>{name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>
          {pct}%
        </span>
      </div>
      <div className="flex items-end justify-between mb-1.5">
        <span className="text-2xl font-black text-foreground">{actual.toLocaleString()}</span>
        {target > 0 && <span className="text-xs text-muted-foreground/80">هدف: {target.toLocaleString()}</span>}
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden mb-1">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: brandColor }} />
      </div>
      <p className="text-[10px] text-muted-foreground/80">{riders} مندوب</p>
    </div>
  );
};

type OrdersByAppCardRow = { app: string; orders: number; target: number; brandColor: string; textColor: string; riders: number };

const renderOrdersByAppNode = (loading: boolean, ordersByApp: OrdersByAppCardRow[]) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SKELETON_KEYS_4.map((k)=><Sk key={`app-card-skeleton-${k}`} h="h-28"/>)}
      </div>
    );
  }
  if (ordersByApp.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/80 text-center py-8">لا توجد بيانات طلبات لهذا الشهر</p>
    );
  }
  const gridColsClass = getOrdersByAppGridColsClass(ordersByApp.length);
  return (
    <div className={`grid gap-3 ${gridColsClass}`}>
      {ordersByApp.map(a => (
        <TargetBar key={a.app} name={a.app} actual={a.orders} target={a.target}
          brandColor={a.brandColor} textColor={a.textColor} riders={a.riders} />
      ))}
    </div>
  );
};

type DashboardTabKey = 'overview' | 'analytics';

const DashboardHeader = ({ activeTab, onTabChange }: { activeTab: DashboardTabKey; onTabChange: (tab: DashboardTabKey) => void }) => (
  <div className="flex items-center justify-between flex-wrap gap-3">
    <div>
      <nav className="flex items-center gap-1 text-xs text-muted-foreground/80 mb-1">
        <span>الرئيسية</span><span>/</span>
        <span className="text-muted-foreground font-medium">لوحة التحكم</span>
      </nav>
      <h1 className="text-xl font-black text-foreground">لوحة التحكم</h1>
      <p className="text-xs text-muted-foreground/80 mt-0.5">{format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}</p>
    </div>
    <div className="flex items-center bg-muted rounded-xl p-1 gap-1">
      {(['overview', 'analytics'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
            activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/75'
          )}
        >
          {tab === 'analytics' && <TrendingUp size={13} />}
          {tab === 'overview' ? 'النظرة العامة' : 'التحليلات والتوقعات'}
        </button>
      ))}
    </div>
  </div>
);

const RecentActivityCard = ({ recentActivity }: { recentActivity: { text: string; time: string; icon: any }[] }) => {
  if (recentActivity.length === 0) return null;
  return (
    <Card title="آخر النشاطات" subtitle="آخر 6 إجراءات في النظام">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {recentActivity.map((item) => (
          <div key={`${item.text}-${item.time}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <item.icon size={14} className="text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground/75 truncate">{item.text}</p>
              <p className="text-[10px] text-muted-foreground/80">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const OrdersByCityCard = ({ ordersByCity, totalOrders }: { ordersByCity: { city: string; orders: number }[]; totalOrders: number }) => {
  if (ordersByCity.length === 0) return null;
  return (
    <Card title="الطلبات حسب المنطقة" subtitle={`إجمالي: ${totalOrders.toLocaleString()} طلب`}>
      <div className="grid grid-cols-2 gap-4">
        {ordersByCity.map(c => {
          const pct = totalOrders > 0 ? Math.round((c.orders / totalOrders) * 100) : 0;
          return (
            <div key={c.city} className="rounded-xl bg-muted/40 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">{c.city}</p>
              <p className="text-2xl font-black text-foreground">{c.orders.toLocaleString()}</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-1">{pct}% من الإجمالي</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const MONTHS_BACK = 6;

interface RiderMonthly { id: string; name: string; months: number[]; avg: number; trend: 'up' | 'down' | 'stable'; lastMonth: number; thisMonth: number; }

type AnalyticsMonth = { label: string; ym: string; start: string; end: string };
type AnalyticsTrendRow = { month: string; orders: number; riders: number; avg: number };
type AnalyticsAppBreakdownRow = { name: string; brand_color: string; thisMonth: number; lastMonth: number; growth: number };
type AnalyticsOrderRow = { employee_id: string; app_id: string; orders_count: number };

const buildHistoricalMonths = (): AnalyticsMonth[] => {
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const d = subMonths(new Date(), MONTHS_BACK - 1 - i);
    return {
      label: format(d, 'MMM yy'),
      ym: format(d, 'yyyy-MM'),
      start: format(startOfMonth(d), 'yyyy-MM-dd'),
      end: format(endOfMonth(d), 'yyyy-MM-dd'),
    };
  });
};

const sumOrders = (rows: AnalyticsOrderRow[]) => rows.reduce((s, r) => s + r.orders_count, 0);

const countUniqueRiders = (rows: AnalyticsOrderRow[]) => new Set(rows.map(r => r.employee_id)).size;

const buildMonthlyTrend = (months: AnalyticsMonth[], monthOrdersResults: Array<{ data: AnalyticsOrderRow[] | null }>): AnalyticsTrendRow[] => {
  return months.map((m, i) => {
    const rows = monthOrdersResults[i]?.data || [];
    const total = sumOrders(rows);
    const activeRiders = countUniqueRiders(rows);
    return {
      month: m.label,
      orders: total,
      riders: activeRiders,
      avg: activeRiders > 0 ? Math.round(total / activeRiders) : 0,
    };
  });
};

const buildAppBreakdown = (
  apps: Array<{ id: string; name: string; brand_color: string }>,
  currOrders: AnalyticsOrderRow[],
  lastMonthOrders: AnalyticsOrderRow[],
): AnalyticsAppBreakdownRow[] => {
  return apps
    .map((app) => {
      const thisM = currOrders.filter(r => r.app_id === app.id).reduce((s, r) => s + r.orders_count, 0);
      const lastM = lastMonthOrders.filter(r => r.app_id === app.id).reduce((s, r) => s + r.orders_count, 0);
      const growth = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : 0;
      return { name: app.name, brand_color: app.brand_color, thisMonth: thisM, lastMonth: lastM, growth };
    })
    .sort((a, b) => b.thisMonth - a.thisMonth);
};

const accumulateRiderOrders = (results: Array<{ data: AnalyticsOrderRow[] | null }>) => {
  const riderData: Record<string, number[]> = {};
  results.forEach((res, mi) => {
    (res.data || []).forEach((r) => {
      if (!riderData[r.employee_id]) riderData[r.employee_id] = [0, 0, 0, 0];
      riderData[r.employee_id][mi] += r.orders_count;
    });
  });
  return riderData;
};

const getRiderTrend = (lastMonth: number, thisMonth: number): RiderMonthly['trend'] => {
  if (thisMonth > lastMonth * 1.05) return 'up';
  if (thisMonth < lastMonth * 0.95) return 'down';
  return 'stable';
};

const getGrowthBadgeClass = (growth: number) => {
  if (growth > 0) return 'bg-emerald-50 text-emerald-700';
  if (growth < 0) return 'bg-rose-50 text-rose-600';
  return 'bg-muted/40 text-muted-foreground';
};

const buildRiderMetrics = (riderData: Record<string, number[]>, empMap: Record<string, string>) => {
  return Object.entries(riderData)
    .filter(([id]) => empMap[id])
    .map(([id, monthlyOrders]) => {
      const avg = Math.round(monthlyOrders.reduce((s, v) => s + v, 0) / 4);
      const lastMonth = monthlyOrders[2];
      const thisMonth = monthlyOrders[3];
      const trend = getRiderTrend(lastMonth, thisMonth);
      return { id, name: empMap[id] || '—', months: monthlyOrders, avg, trend, lastMonth, thisMonth } satisfies RiderMonthly;
    });
};

const AnalyticsTab = () => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const daysInMonth = getDaysInMonth(new Date());
  const daysPassed = getDate(new Date());

  const { data, isLoading: loading } = useQuery({
    queryKey: ['dashboard-analytics', uid],
    enabled,
    queryFn: async () => {
      const months = buildHistoricalMonths();
      const monthLabels = months.map(m => m.label);

      const { appsRes, empRes, monthOrdersResults } = await dashboardService.fetchHistoricalData(months);
      const apps = appsRes.data || [];
      const empMap = Object.fromEntries((empRes.data || []).map(e => [e.id, e.name]));

      const monthOrderResults = monthOrdersResults;

      const trendData = buildMonthlyTrend(months, monthOrderResults as Array<{ data: AnalyticsOrderRow[] | null }>);

      const currOrders = monthOrderResults[MONTHS_BACK - 1].data || [];
      const currTotal = sumOrders(currOrders);
      const projectedOrders = daysPassed > 0 ? Math.round((currTotal / daysPassed) * daysInMonth) : 0;

      const lastMonthOrders = monthOrderResults[MONTHS_BACK - 2].data || [];
      const appBreakdown = buildAppBreakdown(apps, currOrders, lastMonthOrders);

      const last4 = monthOrderResults.slice(MONTHS_BACK - 4);
      const riderData = accumulateRiderOrders(last4 as Array<{ data: AnalyticsOrderRow[] | null }>);
      const riderMetrics = buildRiderMetrics(riderData, empMap);

      return { monthLabels, monthlyTrend: trendData, riderMetrics, projectedOrders, currentOrders: currTotal, appBreakdown };
    },
    staleTime: 5 * 60 * 1000,
  });

  const {
    monthLabels = [] as string[],
    monthlyTrend = [] as { month: string; orders: number; riders: number; avg: number }[],
    riderMetrics = [] as RiderMonthly[],
    projectedOrders = 0,
    currentOrders = 0,
    appBreakdown = [] as { name: string; brand_color: string; thisMonth: number; lastMonth: number; growth: number }[],
  } = data ?? {};

  const needsImprovement = riderMetrics.filter(r => r.trend === 'down' || (riderMetrics.length > 0 && r.thisMonth < (monthlyTrend[MONTHS_BACK - 1]?.avg || 0) * 0.7)).sort((a, b) => a.thisMonth - b.thisMonth).slice(0, 10);
  const improving = riderMetrics.filter(r => r.trend === 'up').sort((a, b) => b.thisMonth - a.thisMonth).slice(0, 5);
  const stable = riderMetrics.filter(r => r.trend === 'stable').length;
  const overallAvg = monthlyTrend[MONTHS_BACK - 1]?.avg || 0;
  const projGrowth = monthlyTrend[MONTHS_BACK - 2]?.orders > 0
    ? Math.round(((projectedOrders - monthlyTrend[MONTHS_BACK - 2].orders) / monthlyTrend[MONTHS_BACK - 2].orders) * 100) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <BarChart2 size={40} className="mx-auto text-primary animate-pulse" />
        <p className="text-muted-foreground text-sm">جارٍ تحميل التحليلات...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Prediction Banner ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-2"><Target size={16} /><span className="text-xs font-semibold opacity-80">الإسقاط المتوقع للشهر</span></div>
          <p className="text-3xl font-black">{projectedOrders.toLocaleString()}</p>
          <p className="text-xs opacity-70 mt-1">بناءً على {daysPassed} يوم منقضي من {daysInMonth}</p>
          <div className={`mt-2 text-xs font-bold ${projGrowth >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {projGrowth >= 0 ? '↑' : '↓'} {Math.abs(projGrowth)}% عن الشهر السابق
          </div>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground/80"><BarChart2 size={16} /><span className="text-xs font-semibold">متوسط الطلبات/مندوب</span></div>
          <p className="text-3xl font-black text-foreground">{overallAvg.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground/80 mt-1">هذا الشهر</p>
          <div className="mt-2 text-xs text-muted-foreground">{riderMetrics.filter(r => r.thisMonth >= overallAvg).length} مندوب فوق المتوسط</div>
        </div>
        <div className="bg-card rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground/80"><Activity size={16} /><span className="text-xs font-semibold">حالة الأداء</span></div>
          <div className="space-y-2 mt-1">
            <div className="flex justify-between items-center"><div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold"><ChevronUp size={13} />في تحسّن</div><span className="font-black text-foreground">{improving.length}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-1.5 text-muted-foreground/80 text-xs font-semibold"><Minus size={13} />مستقر</div><span className="font-black text-foreground">{stable}</span></div>
            <div className="flex justify-between items-center"><div className="flex items-center gap-1.5 text-rose-500 text-xs font-semibold"><ChevronDown size={13} />يحتاج تحسين</div><span className="font-black text-foreground">{riderMetrics.filter(r => r.trend === 'down').length}</span></div>
          </div>
        </div>
      </div>

      {/* ── 6-Month Trend ─────────────────────────────────────────────────── */}
      <Card title="اتجاه الطلبات والمتوسط — آخر 6 أشهر" subtitle="إجمالي الطلبات ومتوسط الطلبات لكل مندوب">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyTrend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: 12, color: 'hsl(var(--card-foreground))' }} />
            <Bar yAxisId="left" dataKey="orders" name="إجمالي الطلبات" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} opacity={0.85} />
            <Line yAxisId="right" type="monotone" dataKey="avg" name="متوسط/مندوب" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 3 }} />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── App Performance Comparison ────────────────────────────────────── */}
      <Card title="مقارنة أداء المنصات" subtitle="هذا الشهر مقارنة بالشهر السابق">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {appBreakdown.map(app => (
            <div key={app.name} className="rounded-xl border border-border/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-foreground">{app.name}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getGrowthBadgeClass(app.growth)}`}>
                  {app.growth > 0 ? '+' : ''}{app.growth}%
                </span>
              </div>
              <p className="text-2xl font-black text-foreground">{app.thisMonth.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">الشهر السابق: {app.lastMonth.toLocaleString()}</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${app.lastMonth > 0 ? Math.min((app.thisMonth / app.lastMonth) * 100, 150) : 0}%`, backgroundColor: app.brand_color }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Who Needs Improvement ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="يحتاجون تحسين 🔴" subtitle="أداء منخفض أو في تراجع هذا الشهر">
          <div className="space-y-1">
            {needsImprovement.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد حالات تحتاج تحسين 👍</p>
            ) : needsImprovement.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-rose-50/50 hover:bg-rose-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/80">الشهر الماضي: {r.lastMonth}</span>
                    <span className="text-[10px] text-rose-500 font-semibold">هذا الشهر: {r.thisMonth}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-rose-500">
                  <ChevronDown size={14} />
                  {r.lastMonth > 0 ? <span className="text-xs font-bold">{Math.round(((r.thisMonth - r.lastMonth) / r.lastMonth) * 100)}%</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="في تحسّن مستمر 🟢" subtitle="أداء متصاعد مقارنة بالشهر السابق">
          <div className="space-y-1">
            {improving.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات كافية</p>
            ) : improving.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-emerald-50/50 hover:bg-emerald-50 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/80">الشهر الماضي: {r.lastMonth}</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">هذا الشهر: {r.thisMonth}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-emerald-600">
                  <ChevronUp size={14} />
                  {r.lastMonth > 0 ? <span className="text-xs font-bold">+{Math.round(((r.thisMonth - r.lastMonth) / r.lastMonth) * 100)}%</span> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Riders below average ─────────────────────────────────────────── */}
      {overallAvg > 0 && (
        <Card title="مناديب تحت المتوسط" subtitle={`المتوسط العام هذا الشهر: ${overallAvg} طلب`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {riderMetrics
              .filter(r => r.thisMonth > 0 && r.thisMonth < overallAvg)
              .sort((a, b) => a.thisMonth - b.thisMonth)
              .slice(0, 12)
              .map(r => {
                const pct = Math.round((r.thisMonth / overallAvg) * 100);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-amber-100 bg-amber-50/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{r.name}</p>
                        <span className="text-xs font-bold text-amber-700">{r.thisMonth} طلب</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">{pct}% من المتوسط</p>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
interface EmpDetail {
  id: string;
  city: string | null;
  license_status: string | null;
  sponsorship_status: string | null;
}

type CityKey = 'makkah' | 'jeddah';
type LicenseKey = 'has_license' | 'applied' | 'no_license';

type EmployeeCounts = {
  makkah: {
    has_license: number;
    applied: number;
    no_license: number;
    sponsored: number;
    not_sponsored: number;
    has_license_sponsored: number;
    has_license_not_sponsored: number;
  };
  jeddah: {
    has_license: number;
    applied: number;
    no_license: number;
    sponsored: number;
    not_sponsored: number;
    has_license_sponsored: number;
    has_license_not_sponsored: number;
  };
  global: {
    sponsored: number;
    not_sponsored: number;
    absconded: number;
    terminated: number;
  };
};

const getCityKey = (city: string | null): CityKey | null => {
  if (city === 'makkah') return 'makkah';
  if (city === 'jeddah') return 'jeddah';
  return null;
};

const getLicenseKey = (licenseStatus: string | null): LicenseKey => {
  if (licenseStatus === 'has_license') return 'has_license';
  if (licenseStatus === 'applied') return 'applied';
  return 'no_license';
};

const incrementGlobalSponsorshipCounts = (counts: EmployeeCounts, sponsorship: string | null) => {
  if (sponsorship === 'sponsored') counts.global.sponsored++;
  else if (sponsorship === 'not_sponsored') counts.global.not_sponsored++;
  else if (sponsorship === 'absconded') counts.global.absconded++;
  else if (sponsorship === 'terminated') counts.global.terminated++;
};

const incrementCityLicenseCounts = (counts: EmployeeCounts, city: CityKey, license: LicenseKey) => {
  if (license === 'has_license') counts[city].has_license++;
  else if (license === 'applied') counts[city].applied++;
  else counts[city].no_license++;
};

const incrementCitySponsorshipCounts = (counts: EmployeeCounts, city: CityKey, sponsorship: string | null) => {
  if (sponsorship === 'sponsored') counts[city].sponsored++;
  else if (sponsorship === 'not_sponsored') counts[city].not_sponsored++;
};

const incrementCityComboCounts = (
  counts: EmployeeCounts,
  city: CityKey,
  license: LicenseKey,
  sponsorship: string | null,
) => {
  if (license !== 'has_license') return;
  if (sponsorship === 'sponsored') counts[city].has_license_sponsored++;
  else if (sponsorship === 'not_sponsored') counts[city].has_license_not_sponsored++;
};

const buildEmployeeCounts = (details: EmpDetail[]): EmployeeCounts => {
  const counts: EmployeeCounts = {
    makkah: { has_license: 0, applied: 0, no_license: 0, sponsored: 0, not_sponsored: 0, has_license_sponsored: 0, has_license_not_sponsored: 0 },
    jeddah: { has_license: 0, applied: 0, no_license: 0, sponsored: 0, not_sponsored: 0, has_license_sponsored: 0, has_license_not_sponsored: 0 },
    global: { sponsored: 0, not_sponsored: 0, absconded: 0, terminated: 0 },
  };

  for (const e of details) {
    const city = getCityKey(e.city);
    const license = getLicenseKey(e.license_status);
    const sponsorship = e.sponsorship_status;

    incrementGlobalSponsorshipCounts(counts, sponsorship);
    if (!city) continue;

    incrementCityLicenseCounts(counts, city, license);
    incrementCitySponsorshipCounts(counts, city, sponsorship);
    incrementCityComboCounts(counts, city, license, sponsorship);
  }

  return counts;
};

const getOrdersByAppGridColsClass = (count: number) => {
  if (count <= 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-2 sm:grid-cols-4';
};

type DashboardApp = { id: string; name: string; brand_color: string; text_color: string };
type DashboardAttendanceToday = { present?: number; absent?: number; late?: number; leave?: number; sick?: number };
type DashboardOrdersByCityRow = { city: string; orders: number };
type DashboardAttendanceWeekRow = { date: string; present: number; absent: number; late: number; leave: number; sick: number };
type DashboardOrdersByAppRow = {
  app: string;
  orders: number;
  appId: string;
  riders: number;
  brandColor: string;
  textColor: string;
  target: number;
  estRevenue: number;
};

const DASHBOARD_DAY_NAMES_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] as const;

const mapOrdersCityLabel = (city: string) => {
  if (city === 'makkah') return 'مكة المكرمة';
  if (city === 'jeddah') return 'جدة';
  return city;
};

const getAttendanceTodayCounts = (att: DashboardAttendanceToday | null | undefined) => ({
  presentToday: att?.present || 0,
  absentToday: att?.absent || 0,
  lateToday: att?.late || 0,
  leaveToday: att?.leave || 0,
  sickToday: att?.sick || 0,
});

const buildAttendanceWeek = (rows: DashboardAttendanceWeekRow[]) =>
  rows.map((r) => ({ day: DASHBOARD_DAY_NAMES_AR[new Date(`${r.date}T12:00:00`).getDay()], ...r }));

const DASHBOARD_ICON_MAP: Record<string, any> = {
  employees: Users,
  attendance: UserCheck,
  daily_orders: Package,
  vehicles: Bike,
  apps: Smartphone,
  alerts: Bell,
};

const DASHBOARD_TABLE_LABELS_AR: Record<string, string> = {
  employees: 'الموظفون',
  attendance: 'الحضور',
  advances: 'السلف',
  salary_records: 'الرواتب',
  daily_orders: 'الطلبات',
  vehicles: 'المركبات',
  apps: 'التطبيقات',
  user_roles: 'الأدوار',
  system_settings: 'الإعدادات',
  alerts: 'التنبيهات',
};

const DASHBOARD_ACTION_LABELS_AR: Record<string, string> = {
  INSERT: 'إضافة',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
};

type DashboardAuditRow = {
  action: string;
  table_name: string;
  created_at: string;
  profiles?: { name?: string | null; email?: string | null } | null;
};

const buildRecentActivity = (rows: DashboardAuditRow[]) => {
  return rows.map((a) => {
    const userName = 'مستخدم';
    const actionLabel = DASHBOARD_ACTION_LABELS_AR[a.action] || a.action;
    const tableLabel = DASHBOARD_TABLE_LABELS_AR[a.table_name] || a.table_name;
    const icon = DASHBOARD_ICON_MAP[a.table_name] || Activity;
    return {
      text: `${userName} — ${actionLabel} في ${tableLabel}`,
      time: formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true }),
      icon,
    };
  });
};

const useDashboardRealtimeInvalidation = (
  userId: string | undefined,
  currentMonth: string,
  queryClient: ReturnType<typeof useQueryClient>
) => {
  useRealtimePostgresChanges('dashboard-realtime', REALTIME_TABLES_DASHBOARD, () => {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', userId, currentMonth] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-analytics', userId] });
  });
};

const fetchDashboardKpis = async (
  currentMonth: string,
  activeEmployeeIdsInMonth: ReadonlySet<string> | undefined
) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: rpcData, error } = await dashboardService.getOverviewRpc(currentMonth, today);
  if (error) throw error;

  const rpc = (rpcData || {}) as any;
  const apps = (rpc.apps || []) as DashboardApp[];

  const { presentToday, absentToday, lateToday, leaveToday, sickToday } = getAttendanceTodayCounts(
    (rpc.attendanceToday || {}) as DashboardAttendanceToday
  );

  const rawEmpDetails = (rpc.empDetails || []) as EmpDetail[];
  const empDetails = rawEmpDetails.filter((e) =>
    isEmployeeVisibleInMonth({ id: e.id, sponsorship_status: e.sponsorship_status }, activeEmployeeIdsInMonth)
  );

  const ordersByApp = (rpc.ordersByApp || []) as DashboardOrdersByAppRow[];
  const totalOrders = ordersByApp.reduce((s, r) => s + (r.orders || 0), 0);
  const estRevenueByApp = ordersByApp;
  const estRevenueTotal = (rpc.kpis?.estRevenueTotal as number) || estRevenueByApp.reduce((s, r) => s + (r.estRevenue || 0), 0);

  const ordersByCity = ((rpc.ordersByCity || []) as DashboardOrdersByCityRow[]).map((r) => ({
    city: mapOrdersCityLabel(r.city),
    orders: r.orders,
  }));

  const allRiders = ((rpc.riders || []) as any[]).map((r) => ({
    name: r.name,
    orders: r.orders,
    app: r.app,
    appColor: r.appColor,
    appId: r.appId,
  }));

  const kpis = {
    activeEmployees: empDetails.length,
    presentToday, absentToday, lateToday, leaveToday, sickToday,
    totalOrders, prevMonthOrders: (rpc.kpis?.prevMonthOrders as number) || 0,
    activeVehicles: (rpc.kpis?.activeVehicles as number) || 0,
    activeAlerts: (rpc.kpis?.activeAlerts as number) || 0,
    activeApps: (rpc.kpis?.activeApps as number) || apps.length,
    hasLicense: empDetails.filter(e => e.license_status === 'has_license').length,
    appliedLicense: empDetails.filter(e => e.license_status === 'applied').length,
    noLicense: empDetails.filter(e => !e.license_status || e.license_status === 'no_license').length,
    makkahCount: empDetails.filter(e => e.city === 'makkah').length,
    jeddahCount: empDetails.filter(e => e.city === 'jeddah').length,
    estRevenueTotal,
  };

  const attendanceWeek = buildAttendanceWeek(
    (rpc.attendanceWeek || []) as DashboardAttendanceWeekRow[]
  );

  const recentActivity = buildRecentActivity(
    ((rpc.recentActivity || []) as DashboardAuditRow[]) || []
  );

  return { kpis, empDetails, ordersByApp, ordersByCity, allRiders, attendanceWeek, recentActivity, apps, estRevenueByApp };
};

type OverviewTabProps = {
  loading: boolean;
  kpis: {
    activeEmployees: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    leaveToday: number;
    sickToday: number;
    totalOrders: number;
    activeVehicles: number;
    activeAlerts: number;
    makkahCount: number;
    jeddahCount: number;
    estRevenueTotal: number;
  };
  orderGrowth: number;
  employeeCounts: EmployeeCounts;
  ordersByApp: OrdersByAppCardRow[];
  ordersByCity: { city: string; orders: number }[];
  topNInput: string;
  setTopNInput: (value: string) => void;
  handleTopNBlur: () => void;
  topRidersOverall: { name: string; orders: number; app: string; appColor: string; appId: string }[];
  maxOrderOverall: number;
  topRidersPerApp: Array<{ id: string; name: string; brand_color: string; riders: { name: string; orders: number; app: string; appColor: string; appId: string }[] }>;
  attendanceWeek: { day: string; present: number; absent: number; leave: number; sick: number; late: number }[];
  recentActivity: { text: string; time: string; icon: any }[];
};

const OverviewTab = ({
  loading,
  kpis,
  orderGrowth,
  employeeCounts,
  ordersByApp,
  ordersByCity,
  topNInput,
  setTopNInput,
  handleTopNBlur,
  topRidersOverall,
  maxOrderOverall,
  topRidersPerApp,
  attendanceWeek,
  recentActivity,
}: OverviewTabProps) => (
  <div className="space-y-6">

    {/* ── KPI Row ──────────────────────────────────────────────────── */}
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
      {[
        { label: 'المناديب النشطون', value: kpis.activeEmployees, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', sub: 'موظف نشط' },
        { label: 'حاضرون اليوم', value: kpis.presentToday, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `${kpis.absentToday} غائب` },
        { label: 'طلبات الشهر', value: kpis.totalOrders.toLocaleString(), icon: Package, color: 'text-orange-500', bg: 'bg-orange-50', trend: { value: orderGrowth, positive: orderGrowth >= 0 }, sub: 'هذا الشهر' },
        { label: 'متوسط طلبات/مندوب', value: kpis.activeEmployees > 0 ? Math.round(kpis.totalOrders / kpis.activeEmployees) : 0, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'طلب/مندوب' },
        { label: 'المركبات النشطة', value: kpis.activeVehicles, icon: Bike, color: 'text-violet-600', bg: 'bg-violet-50' },
        { label: 'التنبيهات', value: kpis.activeAlerts, icon: Bell, color: 'text-rose-500', bg: 'bg-rose-50', sub: 'غير محلولة' },
        { label: 'إيراد تقديري', value: kpis.estRevenueTotal.toLocaleString(), icon: DollarSign, color: 'text-green-700', bg: 'bg-green-50', sub: 'حسب تسعير المنصات' },
      ].map((kpi) => <KpiCard key={kpi.label} {...kpi} loading={loading} />)}
    </div>

    {/* ════════════════════════════════════════════════════════════
        ── SECTION 1: تحليل الموظفين ────────────────────────────
        ════════════════════════════════════════════════════════ */}
    <div>
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <Users size={14} /> تحليل الموظفين
      </h2>
      <div className="space-y-4">

        {/* City + totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Makkah breakdown */}
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center"><MapPin size={14} className="text-purple-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">مكة المكرمة</h3>
                  <p className="text-[10px] text-muted-foreground/80">{kpis.makkahCount} مندوب</p>
                </div>
              </div>
              <span className="text-3xl font-black text-foreground">{kpis.makkahCount}</span>
            </div>
            {loading ? <div className="space-y-2">{SKELETON_KEYS_2.map((k)=><Sk key={`makkah-skeleton-${k}`} h="h-10"/>)}</div> : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">حالة الرخصة</p>
                <div className="grid grid-cols-3 gap-2">
                  <Chip label="لديه رخصة" value={employeeCounts.makkah.has_license} color="bg-emerald-50 text-emerald-700" />
                  <Chip label="قيد التقديم" value={employeeCounts.makkah.applied} color="bg-amber-50 text-amber-700" />
                  <Chip label="بدون رخصة" value={employeeCounts.makkah.no_license} color="bg-red-50 text-red-700" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">الكفالة</p>
                <div className="grid grid-cols-2 gap-2">
                  <Chip label="مكفول" value={employeeCounts.makkah.sponsored} color="bg-blue-50 text-blue-700" />
                  <Chip label="غير مكفول" value={employeeCounts.makkah.not_sponsored} color="bg-muted/40 text-foreground/75" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">مكة + رخصة + كفالة</p>
                <div className="grid grid-cols-2 gap-2">
                  <Chip label="رخصة + مكفول" value={employeeCounts.makkah.has_license_sponsored} color="bg-indigo-50 text-indigo-700" />
                  <Chip label="رخصة + غير مكفول" value={employeeCounts.makkah.has_license_not_sponsored} color="bg-sky-50 text-sky-700" />
                </div>
              </div>
            )}
          </div>

          {/* Jeddah breakdown */}
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center"><MapPin size={14} className="text-blue-600" /></div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">جدة</h3>
                  <p className="text-[10px] text-muted-foreground/80">{kpis.jeddahCount} مندوب</p>
                </div>
              </div>
              <span className="text-3xl font-black text-foreground">{kpis.jeddahCount}</span>
            </div>
            {loading ? <div className="space-y-2">{SKELETON_KEYS_2.map((k)=><Sk key={`jeddah-skeleton-${k}`} h="h-10"/>)}</div> : (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">حالة الرخصة</p>
                <div className="grid grid-cols-3 gap-2">
                  <Chip label="لديه رخصة" value={employeeCounts.jeddah.has_license} color="bg-emerald-50 text-emerald-700" />
                  <Chip label="قيد التقديم" value={employeeCounts.jeddah.applied} color="bg-amber-50 text-amber-700" />
                  <Chip label="بدون رخصة" value={employeeCounts.jeddah.no_license} color="bg-red-50 text-red-700" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">الكفالة</p>
                <div className="grid grid-cols-2 gap-2">
                  <Chip label="مكفول" value={employeeCounts.jeddah.sponsored} color="bg-blue-50 text-blue-700" />
                  <Chip label="غير مكفول" value={employeeCounts.jeddah.not_sponsored} color="bg-muted/40 text-foreground/75" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">جدة + رخصة + كفالة</p>
                <div className="grid grid-cols-2 gap-2">
                  <Chip label="رخصة + مكفول" value={employeeCounts.jeddah.has_license_sponsored} color="bg-indigo-50 text-indigo-700" />
                  <Chip label="رخصة + غير مكفول" value={employeeCounts.jeddah.has_license_not_sponsored} color="bg-sky-50 text-sky-700" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sponsorship global breakdown */}
        <Card title="توزيع الكفالة — جميع المناديب">
          {loading ? <div className="grid grid-cols-4 gap-3">{SKELETON_KEYS_4.map((k)=><Sk key={`sponsorship-skeleton-${k}`} h="h-14"/>)}</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Chip label="مكفول" value={employeeCounts.global.sponsored} color="bg-blue-50 text-blue-700" />
              <Chip label="غير مكفول" value={employeeCounts.global.not_sponsored} color="bg-muted/40 text-foreground/75" />
              <Chip label="هارب" value={employeeCounts.global.absconded} color="bg-red-50 text-red-700" />
              <Chip label="منهي الكفالة" value={employeeCounts.global.terminated} color="bg-orange-50 text-orange-700" />
            </div>
          )}
        </Card>
      </div>
    </div>

    {/* ════════════════════════════════════════════════════════════
        ── SECTION 2: الطلبات ───────────────────────────────────
        ════════════════════════════════════════════════════════ */}
    <div>
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <Package size={14} /> الطلبات والأداء
      </h2>
      <div className="space-y-4">

        {/* Platform cards with target */}
        <div>
          <p className="text-xs text-muted-foreground/80 mb-2">طلبات الشهر حسب المنصة — مع نسبة تحقيق الهدف</p>
          {renderOrdersByAppNode(loading, ordersByApp)}
        </div>

        {/* Orders by city */}
        <OrdersByCityCard ordersByCity={ordersByCity} totalOrders={kpis.totalOrders} />

        {/* Top N overall + per platform */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div>
              <h3 className="text-sm font-bold text-foreground">أفضل المناديب</h3>
              <p className="text-[11px] text-muted-foreground/80 mt-0.5">حسب إجمالي الطلبات هذا الشهر</p>
            </div>
            <div className="flex items-center gap-2">
              <Settings2 size={13} className="text-muted-foreground/80" />
              <span className="text-xs text-muted-foreground/80">عدد المناديب:</span>
              <input
                type="number" min={1} max={50} value={topNInput}
                onChange={e => setTopNInput(e.target.value)}
                onBlur={handleTopNBlur}
                className="w-14 text-center border border-border rounded-lg text-sm font-bold py-1 bg-background text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="p-5">
            {/* Overall */}
            <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-3">الإجمالي</p>
            <Leaderboard entries={topRidersOverall} loading={loading} max={maxOrderOverall} />

            {/* Per platform */}
            {!loading && topRidersPerApp.length > 0 && (
              <div className="mt-6 space-y-5">
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">حسب المنصة</p>
                <div className={`grid grid-cols-1 ${topRidersPerApp.length >= 2 ? 'md:grid-cols-2' : ''} gap-5`}>
                  {topRidersPerApp.map(app => (
                    <div key={app.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: app.brand_color }} />
                        <span className="text-xs font-bold text-foreground/75">{app.name}</span>
                      </div>
                      <Leaderboard
                        entries={app.riders.map(r => ({ name: r.name, orders: r.orders, app: r.app, appColor: app.brand_color }))}
                        loading={false}
                        max={app.riders[0]?.orders || 1}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* ════════════════════════════════════════════════════════════
        ── SECTION 3: الحضور والانصراف ──────────────────────────
        ════════════════════════════════════════════════════════ */}
    <div>
      <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
        <Clock size={14} /> الحضور والانصراف
      </h2>
      <div className="space-y-4">

        {/* Today's breakdown */}
        <Card title="الحضور اليوم" subtitle={format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}>
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{SKELETON_KEYS_5.map((k)=><Sk key={`attendance-skeleton-${k}`} h="h-16"/>)}</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              <div className="rounded-xl bg-emerald-50 p-4 text-center">
                <p className="text-2xl font-black text-emerald-700">{kpis.presentToday}</p>
                <p className="text-[10px] font-semibold text-emerald-600 mt-1">حاضر</p>
              </div>
              <div className="rounded-xl bg-orange-50 p-4 text-center">
                <p className="text-2xl font-black text-orange-600">{kpis.lateToday}</p>
                <p className="text-[10px] font-semibold text-orange-500 mt-1">متأخر</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-4 text-center">
                <p className="text-2xl font-black text-rose-600">{kpis.absentToday}</p>
                <p className="text-[10px] font-semibold text-rose-500 mt-1">غائب</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 text-center">
                <p className="text-2xl font-black text-amber-600">{kpis.leaveToday}</p>
                <p className="text-[10px] font-semibold text-amber-500 mt-1">إجازة</p>
              </div>
              <div className="rounded-xl bg-sky-50 p-4 text-center">
                <p className="text-2xl font-black text-sky-600">{kpis.sickToday}</p>
                <p className="text-[10px] font-semibold text-sky-500 mt-1">مريض</p>
              </div>
            </div>
          )}
        </Card>

        {/* Weekly attendance chart + alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="الحضور — آخر 7 أيام" subtitle="حاضر / متأخر / غائب / إجازة / مريض">
              {attendanceWeek.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-muted-foreground/80 text-sm">لا توجد بيانات حضور</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendanceWeek} barGap={2} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="present" name="حاضر" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="متأخر" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="غائب" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="leave" name="إجازة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sick" name="مريض" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
          <AlertsList />
        </div>
      </div>
    </div>

    {/* ── Recent Activity ──────────────────────────────────────── */}
    <RecentActivityCard recentActivity={recentActivity} />
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const [activeTab, setActiveTab] = useState<DashboardTabKey>('overview');
  const [topN, setTopN] = useState(5);
  const [topNInput, setTopNInput] = useState('5');

  const currentMonth = format(new Date(), 'yyyy-MM');
  const queryClient = useQueryClient();
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(currentMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  useDashboardRealtimeInvalidation(user?.id, currentMonth, queryClient);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['dashboard-kpis', uid, currentMonth],
    enabled: enabled && !!activeIdsData,
    queryFn: () => fetchDashboardKpis(currentMonth, activeEmployeeIdsInMonth),
    staleTime: 5 * 60 * 1000,
  });

  const defaultKpis = { activeEmployees: 0, presentToday: 0, absentToday: 0, leaveToday: 0, lateToday: 0, sickToday: 0, totalOrders: 0, prevMonthOrders: 0, activeVehicles: 0, activeAlerts: 0, activeApps: 0, hasLicense: 0, appliedLicense: 0, noLicense: 0, makkahCount: 0, jeddahCount: 0, estRevenueTotal: 0 };
  const {
    kpis = defaultKpis,
    empDetails = [] as EmpDetail[],
    ordersByApp = [] as { app: string; orders: number; appId: string; riders: number; brandColor: string; textColor: string; target: number }[],
    ordersByCity = [] as { city: string; orders: number }[],
    allRiders = [] as { name: string; orders: number; app: string; appColor: string; appId: string }[],
    attendanceWeek = [] as { day: string; present: number; absent: number; leave: number; sick: number; late: number }[],
    recentActivity = [] as { text: string; time: string; icon: any }[],
    apps = [] as { id: string; name: string; brand_color: string; text_color: string }[],
    estRevenueByApp = [] as { app: string; orders: number; appId: string; riders: number; brandColor: string; textColor: string; target: number; estRevenue: number }[],
  } = data ?? {};

  // ── Derived ──
  const orderGrowth = useMemo(
    () => (kpis.prevMonthOrders > 0 ? ((kpis.totalOrders - kpis.prevMonthOrders) / kpis.prevMonthOrders) * 100 : 0),
    [kpis.prevMonthOrders, kpis.totalOrders],
  );

  const employeeCounts = useMemo(() => buildEmployeeCounts(empDetails), [empDetails]);

  const ridersByAppId = useMemo(() => {
    const map = new Map<string, typeof allRiders>();
    for (const r of allRiders) {
      const arr = map.get(r.appId);
      if (arr) arr.push(r);
      else map.set(r.appId, [r]);
    }
    return map;
  }, [allRiders]);

  const topRidersOverall = useMemo(() => allRiders.slice(0, topN), [allRiders, topN]);
  const maxOrderOverall = useMemo(() => topRidersOverall[0]?.orders || 1, [topRidersOverall]);

  const topRidersPerApp = useMemo(
    () =>
      apps
        .map((app) => ({
          ...app,
          riders: (ridersByAppId.get(app.id) || []).slice(0, topN),
        }))
        .filter((a) => a.riders.length > 0),
    [apps, ridersByAppId, topN],
  );

  const handleTopNBlur = useCallback(() => {
    const parsed = parsePositiveIntOrNull(topNInput);
    if (parsed !== null) {
      setTopN(parsed);
      return;
    }
    setTopNInput(String(topN));
  }, [topN, topNInput]);

  return (
    <div className="space-y-5">
      <DashboardHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'analytics' ? <AnalyticsTab /> : (
        <OverviewTab
          loading={loading}
          kpis={kpis}
          orderGrowth={orderGrowth}
          employeeCounts={employeeCounts}
          ordersByApp={ordersByApp}
          ordersByCity={ordersByCity}
          topNInput={topNInput}
          setTopNInput={setTopNInput}
          handleTopNBlur={handleTopNBlur}
          topRidersOverall={topRidersOverall}
          maxOrderOverall={maxOrderOverall}
          topRidersPerApp={topRidersPerApp}
          attendanceWeek={attendanceWeek}
          recentActivity={recentActivity}
        />
      )}
    </div>
  );
};

export default Dashboard;
