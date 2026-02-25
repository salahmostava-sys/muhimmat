import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { plRecords } from '@/data/mock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const MonthlyPL = () => {
  const current = plRecords[0];
  const items = [
    { label: 'إيرادات المناديب', value: current.driverRevenue, type: 'revenue' },
    { label: 'إيرادات أخرى', value: current.otherRevenue, type: 'revenue' },
    { label: 'إجمالي الإيرادات', value: current.totalRevenue, type: 'total-revenue' },
    { label: 'رواتب المناديب', value: current.driverSalaries, type: 'cost' },
    { label: 'تكاليف المركبات', value: current.vehicleCosts, type: 'cost' },
    { label: 'الخصومات الخارجية', value: current.externalDeductions, type: 'cost' },
    { label: 'تكاليف أخرى', value: current.otherCosts, type: 'cost' },
    { label: 'إجمالي التكاليف', value: current.totalCosts, type: 'total-cost' },
    { label: 'صافي الربح', value: current.netProfit, type: 'profit' },
    { label: 'هامش الربح', value: current.profitMargin, type: 'margin' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-success"><TrendingUp size={18} /><span className="text-sm text-muted-foreground">الإيرادات</span></div>
          <p className="text-2xl font-bold mt-2">{current.totalRevenue.toLocaleString()} ر.س</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-destructive"><TrendingDown size={18} /><span className="text-sm text-muted-foreground">التكاليف</span></div>
          <p className="text-2xl font-bold mt-2">{current.totalCosts.toLocaleString()} ر.س</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-primary"><BarChart3 size={18} /><span className="text-sm text-muted-foreground">صافي الربح</span></div>
          <p className={`text-2xl font-bold mt-2 ${current.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{current.netProfit.toLocaleString()} ر.س</p>
          <p className="text-sm text-muted-foreground">هامش {current.profitMargin}%</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">البند</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">النوع</th>
                <th className="text-left p-4 text-sm font-semibold text-muted-foreground">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isTotal = item.type.startsWith('total') || item.type === 'profit';
                const colorClass = item.type === 'revenue' ? 'text-success' : item.type === 'cost' ? 'text-destructive' : item.type === 'profit' ? (item.value >= 0 ? 'text-success' : 'text-destructive') : 'text-foreground';
                return (
                  <tr key={i} className={`border-b border-border/30 ${isTotal ? 'bg-muted/30 font-bold' : 'hover:bg-muted/20'}`}>
                    <td className="p-4 text-sm text-foreground">{item.label}</td>
                    <td className="p-4 text-sm text-muted-foreground">{item.type.includes('revenue') ? 'إيراد' : item.type.includes('cost') ? 'تكلفة' : item.type === 'profit' ? 'نتيجة' : 'نسبة'}</td>
                    <td className={`p-4 text-sm ${colorClass}`}>{item.type === 'margin' ? `${item.value}%` : `${item.value.toLocaleString()} ر.س`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MonthComparison = () => {
  const chartData = [...plRecords].reverse().map(r => ({
    month: r.month.split('-')[1] + '/' + r.month.split('-')[0].slice(2),
    إيرادات: r.totalRevenue,
    تكاليف: r.totalCosts,
    ربح: r.netProfit,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
        <h3 className="font-semibold text-foreground mb-4">الإيرادات vs التكاليف</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="إيرادات" fill="hsl(152,60%,40%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="تكاليف" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5">
        <h3 className="font-semibold text-foreground mb-4">صافي الربح</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,90%)" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="ربح" stroke="hsl(217,72%,45%)" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-3 text-sm font-semibold text-muted-foreground">البند</th>
                {plRecords.map(r => <th key={r.month} className="text-center p-3 text-sm font-semibold text-muted-foreground">{r.month}</th>)}
              </tr>
            </thead>
            <tbody>
              {['totalRevenue', 'totalCosts', 'netProfit', 'profitMargin'].map(key => (
                <tr key={key} className="border-b border-border/30">
                  <td className="p-3 text-sm font-medium text-foreground">
                    {key === 'totalRevenue' ? 'إجمالي الإيرادات' : key === 'totalCosts' ? 'إجمالي التكاليف' : key === 'netProfit' ? 'صافي الربح' : 'هامش الربح %'}
                  </td>
                  {plRecords.map(r => (
                    <td key={r.month} className={`p-3 text-center text-sm ${key === 'netProfit' ? (r[key] >= 0 ? 'text-success font-semibold' : 'text-destructive font-semibold') : ''}`}>
                      {key === 'profitMargin' ? `${r[key]}%` : r[key as keyof typeof r].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ProfitLoss = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BarChart3 size={24} /> الأرباح والخسائر</h1>
      <p className="text-sm text-muted-foreground mt-1">P&L الشهري ومقارنة الأداء</p>
    </div>
    <Tabs defaultValue="monthly" dir="rtl">
      <TabsList>
        <TabsTrigger value="monthly">P&L الشهري</TabsTrigger>
        <TabsTrigger value="comparison">مقارنة الشهور</TabsTrigger>
      </TabsList>
      <TabsContent value="monthly"><MonthlyPL /></TabsContent>
      <TabsContent value="comparison"><MonthComparison /></TabsContent>
    </Tabs>
  </div>
);

export default ProfitLoss;
