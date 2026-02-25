import { Users, Wallet, CreditCard, UserCheck, TrendingUp, DollarSign } from 'lucide-react';
import StatCard from '@/components/StatCard';
import AlertsList from '@/components/AlertsList';
import { kpis, ordersByApp, attendanceWeek, plRecords } from '@/data/mock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['hsl(217,72%,45%)', 'hsl(152,60%,40%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(280,60%,50%)'];

const Dashboard = () => {
  const plChart = [...plRecords].reverse().map(r => ({
    month: r.month.split('-')[1],
    ربح: r.netProfit,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على النظام</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="المناديب النشطين" value={kpis.activeEmployees} icon={Users} color="primary" subtitle="من أصل 8" />
        <StatCard title="رواتب الشهر" value={`${kpis.totalSalaries.toLocaleString()} ر.س`} icon={Wallet} color="success" />
        <StatCard title="الحاضرين اليوم" value={kpis.presentToday} icon={UserCheck} color="info" subtitle={`غائب: ${kpis.absentToday}`} />
        <StatCard title="السلف القائمة" value={`${kpis.totalAdvancesAmount.toLocaleString()} ر.س`} icon={CreditCard} color="warning" subtitle={`${kpis.activeAdvances} سلف`} />
        <StatCard title="إيرادات الشهر" value={`${kpis.monthRevenue.toLocaleString()} ر.س`} icon={DollarSign} color="primary" />
        <StatCard title="صافي الربح" value={`${kpis.monthProfit.toLocaleString()} ر.س`} icon={TrendingUp} color="success" />
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl border border-border/50 shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">الحضور هذا الأسبوع</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={attendanceWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="present" name="حاضر" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="غائب" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leave" name="إجازة" fill="hsl(38,92%,50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <AlertsList />
      </div>

      {/* Orders + P&L */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">الطلبات حسب التطبيق</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={ordersByApp} dataKey="orders" nameKey="app" cx="50%" cy="50%" outerRadius={100} label={({ app, percent }) => `${app} ${(percent * 100).toFixed(0)}%`}>
                {ordersByApp.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
          <h3 className="font-semibold text-foreground mb-4">صافي الربح — آخر 6 شهور</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={plChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="ربح" stroke="hsl(152,60%,40%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
        <h3 className="font-semibold text-foreground mb-4">آخر النشاطات</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { text: 'تسجيل حضور 6 مناديب', time: 'منذ ساعة', icon: UserCheck },
            { text: 'إدخال طلبات هنقرستيشن', time: 'منذ 3 ساعات', icon: TrendingUp },
            { text: 'اعتماد خصومات كيتا', time: 'أمس', icon: CreditCard },
            { text: 'إضافة سلفة لأحمد العمري', time: 'أمس', icon: Wallet },
            { text: 'تعيين دراجة DRG-050', time: 'منذ يومين', icon: Users },
            { text: 'اعتماد رواتب فبراير', time: 'منذ يومين', icon: DollarSign },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><item.icon size={16} /></div>
              <div className="flex-1">
                <p className="text-sm text-foreground">{item.text}</p>
                <p className="text-xs text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
