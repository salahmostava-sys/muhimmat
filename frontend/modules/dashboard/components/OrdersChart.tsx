type OrdersByAppRow = {
  app: string;
  orders: number;
  target: number;
  brandColor: string;
  textColor: string;
  riders: number;
};

export function OrdersChart(props: Readonly<{
  loading: boolean;
  ordersByApp: OrdersByAppRow[];
  ordersByCity: { city: string; orders: number }[];
  totalOrders: number;
}>) {
  const { loading, ordersByApp, ordersByCity, totalOrders } = props;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-foreground">إجمالي طلبات الشهر (كل المنصات)</p>
        <p className="text-2xl font-black tabular-nums">{loading ? '—' : totalOrders.toLocaleString()}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground/80 mb-2">طلبات كل منصة على حدة — مع نسبة تحقيق الهدف</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['o1', 'o2', 'o3', 'o4'].map((k) => <div key={k} className="h-28 bg-muted/40 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ordersByApp.map((a) => {
              const pct = a.target > 0 ? Math.min(Math.round((a.orders / a.target) * 100), 100) : 0;
              return (
                <div key={a.app} className="bg-card rounded-2xl p-4 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: a.brandColor, color: a.textColor }}>{a.app}</span>
                    <span className="text-xs font-bold">{pct}%</span>
                  </div>
                  <p className="text-2xl font-black">{a.orders.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">هدف: {a.target.toLocaleString()} | {a.riders} مندوب</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="bg-card rounded-2xl shadow-card p-5">
        <h3 className="text-sm font-bold mb-2">الطلبات حسب المنطقة</h3>
        <p className="text-xs text-muted-foreground mb-3">إجمالي: {totalOrders.toLocaleString()} طلب</p>
        <div className="grid grid-cols-2 gap-4">
          {ordersByCity.map((c) => (
            <div key={c.city} className="rounded-xl bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">{c.city}</p>
              <p className="text-2xl font-black">{c.orders.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
