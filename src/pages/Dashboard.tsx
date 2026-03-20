import { useState, useEffect, forwardRef } from 'react';
import {
  Users, UserCheck, Bell, Package, Bike, Smartphone,
  TrendingUp, ArrowUpRight, ArrowDownRight, Award,
  BarChart2, Download, Activity, MapPin, ShieldCheck,
  Target, Clock, AlertTriangle, ChevronUp, ChevronDown,
  Star, ThumbsUp, ThumbsDown, Minus, Settings2,
} from 'lucide-react';
import AlertsList from '@/components/AlertsList';
import { supabase } from '@/integrations/supabase/client';
import {
  format, subDays, formatDistanceToNow,
  subMonths, startOfMonth, endOfMonth, getDaysInMonth, getDate,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useLanguage } from '@/context/LanguageContext';
import { useAppColors } from '@/hooks/useAppColors';
import { Button } from '@/components/ui/button';
import * as XLSX from '@e965/xlsx';

function cn(...classes: (string | undefined | false)[]) { return classes.filter(Boolean).join(' '); }

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
      {payload.map((p: any) => <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>)}
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
        ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)
        : entries.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات هذا الشهر</p>
          : entries.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors">
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
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: brandColor, color: textColor }}>{name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${over ? 'bg-emerald-50 text-emerald-700' : pct >= 75 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-600'}`}>
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

// ══════════════════════════════════════════════════════════════════════════════
// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const MONTHS_BACK = 6;

interface RiderMonthly { id: string; name: string; months: number[]; avg: number; trend: 'up' | 'down' | 'stable'; lastMonth: number; thisMonth: number; }

const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [monthLabels, setMonthLabels] = useState<string[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; orders: number; riders: number; avg: number }[]>([]);
  const [riderMetrics, setRiderMetrics] = useState<RiderMonthly[]>([]);
  const [projectedOrders, setProjectedOrders] = useState(0);
  const [currentOrders, setCurrentOrders] = useState(0);
  const [appBreakdown, setAppBreakdown] = useState<{ name: string; brand_color: string; thisMonth: number; lastMonth: number; growth: number }[]>([]);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const daysInMonth = getDaysInMonth(new Date());
  const daysPassed = getDate(new Date());

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const months = Array.from({ length: MONTHS_BACK }, (_, i) => {
        const d = subMonths(new Date(), MONTHS_BACK - 1 - i);
        return { label: format(d, 'MMM yy'), ym: format(d, 'yyyy-MM'), start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd') };
      });
      setMonthLabels(months.map(m => m.label));

      const [appsRes, empRes] = await Promise.all([
        supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
        supabase.from('employees').select('id, name').eq('status', 'active'),
      ]);
      const apps = appsRes.data || [];
      const appMap = Object.fromEntries(apps.map(a => [a.id, a]));
      const empMap = Object.fromEntries((empRes.data || []).map(e => [e.id, e.name]));

      // Fetch orders for each of the 6 months
      const monthOrderResults = await Promise.all(
        months.map(m => supabase.from('daily_orders').select('employee_id, orders_count, app_id').gte('date', m.start).lte('date', m.end))
      );

      // Build trend
      const trendData = months.map((m, i) => {
        const rows = monthOrderResults[i].data || [];
        const total = rows.reduce((s, r) => s + r.orders_count, 0);
        const activeRiders = new Set(rows.map(r => r.employee_id)).size;
        return { month: m.label, orders: total, riders: activeRiders, avg: activeRiders > 0 ? Math.round(total / activeRiders) : 0 };
      });
      setMonthlyTrend(trendData);

      // Current month orders
      const currOrders = monthOrderResults[MONTHS_BACK - 1].data || [];
      const currTotal = currOrders.reduce((s, r) => s + r.orders_count, 0);
      setCurrentOrders(currTotal);
      setProjectedOrders(daysPassed > 0 ? Math.round((currTotal / daysPassed) * daysInMonth) : 0);

      // App breakdown (this month vs last month)
      const lastMonthOrders = monthOrderResults[MONTHS_BACK - 2].data || [];
      const appBreak = apps.map(app => {
        const thisM = currOrders.filter(r => r.app_id === app.id).reduce((s, r) => s + r.orders_count, 0);
        const lastM = lastMonthOrders.filter(r => r.app_id === app.id).reduce((s, r) => s + r.orders_count, 0);
        const growth = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : 0;
        return { name: app.name, brand_color: app.brand_color, thisMonth: thisM, lastMonth: lastM, growth };
      }).sort((a, b) => b.thisMonth - a.thisMonth);
      setAppBreakdown(appBreak);

      // Per-rider monthly breakdown (last 4 months for trend)
      const last4 = monthOrderResults.slice(MONTHS_BACK - 4);
      const riderData: Record<string, number[]> = {};
      last4.forEach((res, mi) => {
        (res.data || []).forEach(r => {
          if (!riderData[r.employee_id]) riderData[r.employee_id] = [0, 0, 0, 0];
          riderData[r.employee_id][mi] += r.orders_count;
        });
      });

      const overallAvg = trendData[MONTHS_BACK - 1]?.avg || 0;

      const metrics: RiderMonthly[] = Object.entries(riderData)
        .filter(([id]) => empMap[id])
        .map(([id, monthlyOrders]) => {
          const avg = Math.round(monthlyOrders.reduce((s, v) => s + v, 0) / 4);
          const lastMonth = monthlyOrders[2];
          const thisMonth = monthlyOrders[3];
          const trend: 'up' | 'down' | 'stable' = thisMonth > lastMonth * 1.05 ? 'up' : thisMonth < lastMonth * 0.95 ? 'down' : 'stable';
          return { id, name: empMap[id] || '—', months: monthlyOrders, avg, trend, lastMonth, thisMonth };
        });

      setRiderMetrics(metrics);
      setLoading(false);
    };
    load();
  }, []);

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
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${app.growth > 0 ? 'bg-emerald-50 text-emerald-700' : app.growth < 0 ? 'bg-rose-50 text-rose-600' : 'bg-muted/40 text-muted-foreground'}`}>
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
  city: string | null;
  license_status: string | null;
  sponsorship_status: string | null;
}

const Dashboard = () => {
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
  const [topN, setTopN] = useState(5);
  const [topNInput, setTopNInput] = useState('5');

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({
    activeEmployees: 0, presentToday: 0, absentToday: 0, leaveToday: 0, lateToday: 0, sickToday: 0,
    totalOrders: 0, prevMonthOrders: 0,
    activeVehicles: 0, activeAlerts: 0, activeApps: 0,
    hasLicense: 0, appliedLicense: 0, noLicense: 0,
    makkahCount: 0, jeddahCount: 0,
  });
  const [empDetails, setEmpDetails] = useState<EmpDetail[]>([]);
  const [ordersByApp, setOrdersByApp] = useState<{ app: string; orders: number; appId: string; riders: number; brandColor: string; textColor: string; target: number }[]>([]);
  const [ordersByCity, setOrdersByCity] = useState<{ city: string; orders: number }[]>([]);
  const [allRiders, setAllRiders] = useState<{ name: string; orders: number; app: string; appColor: string; appId: string }[]>([]);
  const [attendanceWeek, setAttendanceWeek] = useState<{ day: string; present: number; absent: number; leave: number; sick: number; late: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string; icon: any }[]>([]);
  const [apps, setApps] = useState<{ id: string; name: string; brand_color: string; text_color: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      const currentMonth = format(new Date(), 'yyyy-MM');
      const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
      const sixDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
      const prevStart = `${prevMonth}-01`;
      const prevEnd = format(endOfMonth(new Date(`${prevMonth}-01`)), 'yyyy-MM-dd');

      const [empRes, attRes, ordersRes, prevOrdersRes, weekAttRes, auditRes, empDetailsRes, vehiclesRes, alertsRes, appsRes, targetsRes] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('status').eq('date', today),
        supabase.from('daily_orders').select('employee_id, app_id, orders_count, apps(id, name, brand_color, text_color), employees(name, city)').gte('date', currentMonth + '-01').lte('date', today),
        supabase.from('daily_orders').select('orders_count').gte('date', prevStart).lte('date', prevEnd),
        supabase.from('attendance').select('date, status').gte('date', sixDaysAgo).lte('date', today),
        supabase.from('audit_log').select('action, table_name, created_at, profiles(name, email)').order('created_at', { ascending: false }).limit(6),
        supabase.from('employees').select('city, license_status, sponsorship_status').eq('status', 'active'),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
        supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true),
        supabase.from('app_targets').select('app_id, target_orders').eq('month_year', currentMonth),
      ]);

      const appsData = appsRes.data || [];
      setApps(appsData);
      const targetMap: Record<string, number> = {};
      (targetsRes.data || []).forEach(t => { targetMap[t.app_id] = t.target_orders; });

      // ── Attendance ──
      const todayAtt = attRes.data || [];
      const presentToday = todayAtt.filter(a => a.status === 'present').length;
      const absentToday = todayAtt.filter(a => a.status === 'absent').length;
      const lateToday = todayAtt.filter(a => a.status === 'late').length;
      const leaveToday = todayAtt.filter(a => a.status === 'leave').length;
      const sickToday = todayAtt.filter(a => a.status === 'sick').length;

      // ── Employee details ──
      const details = empDetailsRes.data as EmpDetail[] || [];
      setEmpDetails(details);

      // ── Orders ──
      const appTotals: Record<string, { orders: number; appId: string; riders: Set<string>; brandColor: string; textColor: string }> = {};
      const empOrderMap: Record<string, { name: string; orders: number; appColor: string; app: string; appId: string }> = {};
      const cityOrderMap: Record<string, number> = { makkah: 0, jeddah: 0 };

      (ordersRes.data || []).forEach((r: any) => {
        const app = r.apps;
        const appName = app?.name || '—';
        const appId = app?.id || r.app_id;
        const brandColor = app?.brand_color || '#6366f1';
        const textColor = app?.text_color || '#fff';
        const empName = r.employees?.name || '';
        const empCity = r.employees?.city;

        if (!appTotals[appName]) appTotals[appName] = { orders: 0, appId, riders: new Set(), brandColor, textColor };
        appTotals[appName].orders += r.orders_count;
        appTotals[appName].riders.add(r.employee_id);

        if (empCity === 'makkah') cityOrderMap['makkah'] = (cityOrderMap['makkah'] || 0) + r.orders_count;
        else if (empCity === 'jeddah') cityOrderMap['jeddah'] = (cityOrderMap['jeddah'] || 0) + r.orders_count;

        if (empName) {
          if (!empOrderMap[r.employee_id]) empOrderMap[r.employee_id] = { name: empName, orders: 0, appColor: brandColor, app: appName, appId };
          empOrderMap[r.employee_id].orders += r.orders_count;
        }
      });

      const ordersArr = Object.entries(appTotals).map(([app, d]) => ({
        app, orders: d.orders, appId: d.appId, riders: d.riders.size,
        brandColor: d.brandColor, textColor: d.textColor, target: targetMap[d.appId] || 0,
      })).sort((a, b) => b.orders - a.orders);

      const totalOrders = ordersArr.reduce((s, r) => s + r.orders, 0);
      setOrdersByApp(ordersArr);
      setOrdersByCity(Object.entries(cityOrderMap).map(([city, orders]) => ({ city: city === 'makkah' ? 'مكة المكرمة' : 'جدة', orders })));
      setAllRiders(Object.values(empOrderMap).sort((a, b) => b.orders - a.orders));

      setKpis({
        activeEmployees: empRes.count || 0,
        presentToday, absentToday, lateToday, leaveToday, sickToday,
        totalOrders, prevMonthOrders: prevOrdersRes.data?.reduce((s, r) => s + r.orders_count, 0) || 0,
        activeVehicles: vehiclesRes.count || 0,
        activeAlerts: alertsRes.count || 0,
        activeApps: appsRes.count || 0,
        hasLicense: details.filter(e => e.license_status === 'has_license').length,
        appliedLicense: details.filter(e => e.license_status === 'applied').length,
        noLicense: details.filter(e => !e.license_status || e.license_status === 'no_license').length,
        makkahCount: details.filter(e => e.city === 'makkah').length,
        jeddahCount: details.filter(e => e.city === 'jeddah').length,
      });

      // ── Attendance week ──
      const weekMap: Record<string, { present: number; absent: number; leave: number; sick: number; late: number }> = {};
      (weekAttRes.data || []).forEach(r => {
        if (!weekMap[r.date]) weekMap[r.date] = { present: 0, absent: 0, leave: 0, sick: 0, late: 0 };
        if (r.status === 'present') weekMap[r.date].present++;
        else if (r.status === 'late') weekMap[r.date].late++;
        else if (r.status === 'absent') weekMap[r.date].absent++;
        else if (r.status === 'leave') weekMap[r.date].leave++;
        else if (r.status === 'sick') weekMap[r.date].sick++;
      });
      const dayNames = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
      setAttendanceWeek(
        Object.entries(weekMap).sort(([a], [b]) => a.localeCompare(b))
          .map(([date, counts]) => ({ day: dayNames[new Date(date + 'T12:00:00').getDay()], ...counts }))
      );

      // ── Recent activity ──
      if (auditRes.data?.length) {
        const iconMap: Record<string, any> = { employees: Users, attendance: UserCheck, daily_orders: Package, vehicles: Bike, apps: Smartphone, alerts: Bell };
        const tableAr: Record<string, string> = { employees: 'الموظفون', attendance: 'الحضور', advances: 'السلف', salary_records: 'الرواتب', daily_orders: 'الطلبات', vehicles: 'المركبات', apps: 'التطبيقات', user_roles: 'الأدوار', system_settings: 'الإعدادات', alerts: 'التنبيهات' };
        const actionAr: Record<string, string> = { INSERT: 'إضافة', UPDATE: 'تعديل', DELETE: 'حذف' };
        setRecentActivity(auditRes.data.map((a: any) => {
          const profile = a.profiles as any;
          const userName = profile?.name || profile?.email?.split('@')[0] || 'مستخدم';
          return { text: `${userName} — ${actionAr[a.action] || a.action} في ${tableAr[a.table_name] || a.table_name}`, time: formatDistanceToNow(new Date(a.created_at), { locale: ar, addSuffix: true }), icon: iconMap[a.table_name] || Activity };
        }));
      }

      setLoading(false);
    };

    fetchData();
  }, [lang]);

  // ── Derived ──
  const orderGrowth = kpis.prevMonthOrders > 0 ? ((kpis.totalOrders - kpis.prevMonthOrders) / kpis.prevMonthOrders) * 100 : 0;

  // Employee cross-filters
  const crossFilter = (city: string | null, license: string | null, sponsorship: string | null) =>
    empDetails.filter(e =>
      (city === null || e.city === city) &&
      (license === null || e.license_status === license) &&
      (sponsorship === null || e.sponsorship_status === sponsorship)
    ).length;

  // Top N riders overall and per platform
  const topRidersOverall = allRiders.slice(0, topN);
  const topRidersPerApp = apps.map(app => ({
    ...app,
    riders: allRiders.filter(r => r.appId === app.id).slice(0, topN),
  })).filter(a => a.riders.length > 0);
  const maxOrderOverall = topRidersOverall[0]?.orders || 1;

  return (
    <div className="space-y-5">

      {/* ── Header & Tabs ─────────────────────────────────────────────────── */}
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
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5',
                activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground/75'
              )}
            >
              {tab === 'analytics' && <TrendingUp size={13} />}
              {tab === 'overview' ? 'النظرة العامة' : 'التحليلات والتوقعات'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'analytics' ? <AnalyticsTab /> : (
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
            ].map((kpi, i) => <KpiCard key={i} {...kpi} loading={loading} />)}
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
                  {loading ? <div className="space-y-2">{[1,2].map(i=><Sk key={i} h="h-10"/>)}</div> : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">حالة الرخصة</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Chip label="لديه رخصة" value={crossFilter('makkah','has_license',null)} color="bg-emerald-50 text-emerald-700" />
                        <Chip label="قيد التقديم" value={crossFilter('makkah','applied',null)} color="bg-amber-50 text-amber-700" />
                        <Chip label="بدون رخصة" value={crossFilter('makkah','no_license',null)} color="bg-red-50 text-red-700" />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">الكفالة</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Chip label="مكفول" value={crossFilter('makkah',null,'sponsored')} color="bg-blue-50 text-blue-700" />
                        <Chip label="غير مكفول" value={crossFilter('makkah',null,'not_sponsored')} color="bg-muted/40 text-foreground/75" />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">مكة + رخصة + كفالة</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Chip label="رخصة + مكفول" value={crossFilter('makkah','has_license','sponsored')} color="bg-indigo-50 text-indigo-700" />
                        <Chip label="رخصة + غير مكفول" value={crossFilter('makkah','has_license','not_sponsored')} color="bg-sky-50 text-sky-700" />
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
                  {loading ? <div className="space-y-2">{[1,2].map(i=><Sk key={i} h="h-10"/>)}</div> : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">حالة الرخصة</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Chip label="لديه رخصة" value={crossFilter('jeddah','has_license',null)} color="bg-emerald-50 text-emerald-700" />
                        <Chip label="قيد التقديم" value={crossFilter('jeddah','applied',null)} color="bg-amber-50 text-amber-700" />
                        <Chip label="بدون رخصة" value={crossFilter('jeddah','no_license',null)} color="bg-red-50 text-red-700" />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">الكفالة</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Chip label="مكفول" value={crossFilter('jeddah',null,'sponsored')} color="bg-blue-50 text-blue-700" />
                        <Chip label="غير مكفول" value={crossFilter('jeddah',null,'not_sponsored')} color="bg-muted/40 text-foreground/75" />
                      </div>
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mt-2">جدة + رخصة + كفالة</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Chip label="رخصة + مكفول" value={crossFilter('jeddah','has_license','sponsored')} color="bg-indigo-50 text-indigo-700" />
                        <Chip label="رخصة + غير مكفول" value={crossFilter('jeddah','has_license','not_sponsored')} color="bg-sky-50 text-sky-700" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sponsorship global breakdown */}
              <Card title="توزيع الكفالة — جميع المناديب">
                {loading ? <div className="grid grid-cols-4 gap-3">{[1,2,3,4].map(i=><Sk key={i} h="h-14"/>)}</div> : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Chip label="مكفول" value={empDetails.filter(e=>e.sponsorship_status==='sponsored').length} color="bg-blue-50 text-blue-700" />
                    <Chip label="غير مكفول" value={empDetails.filter(e=>e.sponsorship_status==='not_sponsored').length} color="bg-muted/40 text-foreground/75" />
                    <Chip label="هارب" value={empDetails.filter(e=>e.sponsorship_status==='absconded').length} color="bg-red-50 text-red-700" />
                    <Chip label="منهي الكفالة" value={empDetails.filter(e=>e.sponsorship_status==='terminated').length} color="bg-orange-50 text-orange-700" />
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
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[1,2,3,4].map(i=><Sk key={i} h="h-28"/>)}</div>
                ) : ordersByApp.length === 0 ? (
                  <p className="text-sm text-muted-foreground/80 text-center py-8">لا توجد بيانات طلبات لهذا الشهر</p>
                ) : (
                  <div className={`grid gap-3 ${ordersByApp.length <= 2 ? 'grid-cols-2' : ordersByApp.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                    {ordersByApp.map(a => (
                      <TargetBar key={a.app} name={a.app} actual={a.orders} target={a.target}
                        brandColor={a.brandColor} textColor={a.textColor} riders={a.riders} />
                    ))}
                  </div>
                )}
              </div>

              {/* Orders by city */}
              {ordersByCity.length > 0 && (
                <Card title="الطلبات حسب المنطقة" subtitle={`إجمالي: ${kpis.totalOrders.toLocaleString()} طلب`}>
                  <div className="grid grid-cols-2 gap-4">
                    {ordersByCity.map(c => {
                      const pct = kpis.totalOrders > 0 ? Math.round((c.orders / kpis.totalOrders) * 100) : 0;
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
              )}

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
                      onBlur={() => { const n = parseInt(topNInput); if (!isNaN(n) && n >= 1) setTopN(n); else setTopNInput(String(topN)); }}
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
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{[1,2,3,4,5].map(i=><Sk key={i} h="h-16"/>)}</div>
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
          {recentActivity.length > 0 && (
            <Card title="آخر النشاطات" subtitle="آخر 6 إجراءات في النظام">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {recentActivity.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
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
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
