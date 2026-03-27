type Rider = { name: string; orders: number; app: string; appColor: string; appId: string };
type AppTop = { id: string; name: string; brand_color: string; riders: Rider[] };
type AtRiskRider = Rider & { projected: number; share: number; gap: number };

export function TopEmployees(props: Readonly<{
  loading: boolean;
  topNInput: string;
  setTopNInput: (value: string) => void;
  handleTopNBlur: () => void;
  topRidersOverall: Rider[];
  topRidersPerApp: AppTop[];
  bottomRidersPerApp: AppTop[];
  atRiskRiders: AtRiskRider[];
}>) {
  const { loading, topNInput, setTopNInput, handleTopNBlur, topRidersOverall, topRidersPerApp, bottomRidersPerApp, atRiskRiders } = props;
  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <div>
          <h3 className="text-sm font-bold text-foreground">أفضل وأضعف المناديب</h3>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">حسب طلبات الشهر؛ العدد أدناه يحدد كم مندوب يظهر في كل قائمة</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/80">عدد المناديب:</span>
          <input
            type="number" min={1} max={50} value={topNInput}
            onChange={e => setTopNInput(e.target.value)}
            onBlur={handleTopNBlur}
            className="w-14 text-center border border-border rounded-lg text-sm font-bold py-1 bg-background text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>
      <div className="p-5 space-y-4">
        {loading ? (
          ['t1', 't2', 't3'].map((k) => <div key={k} className="h-12 bg-muted/40 rounded-xl animate-pulse" />)
        ) : (
          <>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-2">الإجمالي</p>
              <div className="space-y-2">
                {topRidersOverall.map((r, idx) => (
                  <div key={`${r.appId}-${r.name}-${idx}`} className="flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-muted/40">
                    <span className="text-sm font-semibold truncate">{r.name}</span>
                    <span className="text-sm font-black">{r.orders.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            {topRidersPerApp.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-2">حسب المنصة</p>
                <div className={`grid grid-cols-1 ${topRidersPerApp.length >= 2 ? 'md:grid-cols-2' : ''} gap-5`}>
                  {topRidersPerApp.map((app) => (
                    <div key={app.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: app.brand_color }} />
                        <span className="text-xs font-bold text-foreground/75">{app.name}</span>
                      </div>
                      <div className="space-y-2">
                        {app.riders.map((r, idx) => (
                          <div key={`${app.id}-${r.name}-${idx}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-muted/40">
                            <span className="text-sm truncate">{r.name}</span>
                            <span className="text-sm font-black">{r.orders.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {bottomRidersPerApp.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-2">أضعف المناديب — حسب المنصة</p>
                <div className={`grid grid-cols-1 ${bottomRidersPerApp.length >= 2 ? 'md:grid-cols-2' : ''} gap-5`}>
                  {bottomRidersPerApp.map((app) => (
                    <div key={`bottom-${app.id}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: app.brand_color }} />
                        <span className="text-xs font-bold text-foreground/75">{app.name}</span>
                      </div>
                      <div className="space-y-2">
                        {app.riders.map((r, idx) => (
                          <div key={`bottom-${app.id}-${r.name}-${idx}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-rose-50/50 border border-rose-100/60">
                            <span className="text-sm truncate">{r.name}</span>
                            <span className="text-sm font-black text-rose-700">{r.orders.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {atRiskRiders.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest mb-2">يحتاج تحسين — الإسقاط أقل من حصة التارجت في المنصة</p>
                <p className="text-[11px] text-muted-foreground/80 mb-3">
                  الحصة = هدف المنصة ÷ عدد المناديب النشطين عليها؛ الإسقاط = معدّل الشهر حتى اليوم ممتد لنهاية الشهر.
                </p>
                <div className="space-y-2">
                  {atRiskRiders.map((r, idx) => (
                    <div key={`risk-${r.appId}-${r.name}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 bg-amber-50/60 border border-amber-100">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-foreground">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground mr-2 inline-flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: r.appColor }} />
                          {r.app}
                        </span>
                      </div>
                      <div className="text-[11px] text-left sm:text-right tabular-nums">
                        <span className="font-bold text-foreground">{r.orders.toLocaleString()}</span>
                        <span className="text-muted-foreground mx-1">←</span>
                        <span className="text-amber-800">إسقاط {r.projected.toLocaleString()}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span>حصة {Math.round(r.share).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
