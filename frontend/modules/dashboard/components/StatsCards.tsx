import { Users, UserCheck, Package, Award, Bike, Bell, ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';

type StatsCardsProps = Readonly<{
  loading: boolean;
  kpis: {
    activeRiders: number;
    totalMonthTarget: number;
    targetAchievementPct: number;
    presentToday: number;
    absentToday: number;
    totalOrders: number;
    activeVehicles: number;
    activeAlerts: number;
  };
  orderGrowth: number;
}>;

function StatCard(props: Readonly<{ label: string; value: string | number; icon: LucideIcon; sub?: string; trend?: { value: number; positive: boolean }; loading: boolean }>) {
  const { label, value, icon: Icon, sub, trend, loading } = props;
  return (
    <div className="bg-card rounded-2xl p-4 shadow-card flex flex-col gap-3 hover:shadow-card-hover transition-shadow">
      {loading ? (
        <>
          <div className="h-9 w-9 rounded-xl bg-muted/40 animate-pulse" />
          <div className="h-7 w-20 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-3 w-28 bg-muted/40 animate-pulse rounded" />
        </>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/40"><Icon size={18} /></div>
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
}

export function StatsCards({ loading, kpis, orderGrowth }: StatsCardsProps) {
  const avgPerRider = kpis.activeRiders > 0 ? Math.round(kpis.totalOrders / kpis.activeRiders) : 0;
  const ordersSub =
    kpis.totalMonthTarget > 0
      ? `هذا الشهر · ${kpis.targetAchievementPct}% من هدف المنصات (${kpis.totalMonthTarget.toLocaleString()})`
      : 'هذا الشهر';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
      <StatCard label="المناديب النشطون" value={kpis.activeRiders} icon={Users} sub="مرتبطون بمنصة توصيل" loading={loading} />
      <StatCard label="حاضرون اليوم" value={kpis.presentToday} icon={UserCheck} sub={`${kpis.absentToday} غائب`} loading={loading} />
      <StatCard label="إجمالي طلبات الشهر" value={kpis.totalOrders.toLocaleString()} icon={Package} trend={{ value: orderGrowth, positive: orderGrowth >= 0 }} sub={ordersSub} loading={loading} />
      <StatCard label="متوسط طلبات/مندوب" value={avgPerRider} icon={Award} sub="على المناديب المرتبطين بالمنصات" loading={loading} />
      <StatCard label="المركبات النشطة" value={kpis.activeVehicles} icon={Bike} loading={loading} />
      <StatCard label="التنبيهات" value={kpis.activeAlerts} icon={Bell} sub="غير محلولة" loading={loading} />
    </div>
  );
}
