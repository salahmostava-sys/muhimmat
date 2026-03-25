/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import attendanceService from '@/services/attendanceService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

interface DayStats {
  day: string;
  dayNum: number;
  present: number;
  absent: number;
  leave: number;
  sick: number;
  late: number;
}

const COLORS = {
  present: '#12B76A',
  absent:  '#F04438',
  leave:   '#F79009',
  sick:    '#9B59B6',
  late:    '#F97316',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 text-xs min-w-[130px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const AttendanceStats = ({ selectedMonth, selectedYear }: Props) => {
  const { isRTL } = useLanguage();
  const [data, setData] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const labels = {
    present: 'حاضر',
    absent:  'غائب',
    leave:   'إجازة',
    sick:    'مريض',
    late:    'متأخر',
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const pad = (n: number) => String(n).padStart(2, '0');
      const from = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const to = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(daysInMonth)}`;

      const [attRes, empRes] = await Promise.all([
        attendanceService.getAttendanceStatusRange(from, to),
        attendanceService.getActiveEmployeesCount(),
      ]);

      setTotalEmployees(empRes.count || 0);

      if (!attRes.data) { setLoading(false); return; }

      // Group by day
      const byDay: Record<number, Record<string, number>> = {};
      for (let d = 1; d <= daysInMonth; d++) byDay[d] = { present: 0, absent: 0, leave: 0, sick: 0, late: 0 };

      attRes.data.forEach(r => {
        const d = new Date(r.date).getDate();
        const s = r.status;
        if (byDay[d] && s && s in byDay[d]) byDay[d][s]++;
      });

      const result: DayStats[] = Array.from({ length: daysInMonth }, (_, i) => ({
        day: String(i + 1),
        dayNum: i + 1,
        present: byDay[i + 1].present,
        absent:  byDay[i + 1].absent,
        leave:   byDay[i + 1].leave,
        sick:    byDay[i + 1].sick,
        late:    byDay[i + 1].late,
      })).filter(d => d.present + d.absent + d.leave + d.sick + d.late > 0);

      setData(result);
      setLoading(false);
    };
    fetch();
  }, [selectedMonth, selectedYear]);

  // Summary totals
  const totals = data.reduce(
    (acc, d) => ({ present: acc.present + d.present, absent: acc.absent + d.absent, leave: acc.leave + d.leave, sick: acc.sick + d.sick, late: acc.late + d.late }),
    { present: 0, absent: 0, leave: 0, sick: 0, late: 0 }
  );
  const totalRecorded = Object.values(totals).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}
        </div>
        <div className="h-72 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['present', 'absent', 'leave', 'sick', 'late'] as const).map(key => {
          const count = totals[key];
          const pct = totalRecorded > 0 ? Math.round((count / totalRecorded) * 100) : 0;
          return (
            <div key={key} className="bg-card border border-border/50 rounded-xl p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[key] }} />
                <span className="text-xs text-muted-foreground">{labels[key]}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{pct}%</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart */}
      <div className="bg-card border border-border/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">
            توزيع الحضور يومياً
          </h3>
          {totalEmployees > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {totalEmployees} مندوب نشط
            </span>
          )}
        </div>

        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            لا توجد بيانات حضور لهذا الشهر
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                formatter={(value) => <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>}
              />
              <Bar dataKey="present" name={labels.present} fill={COLORS.present} radius={[3, 3, 0, 0]} maxBarSize={16} />
              <Bar dataKey="absent"  name={labels.absent}  fill={COLORS.absent}  radius={[3, 3, 0, 0]} maxBarSize={16} />
              <Bar dataKey="leave"   name={labels.leave}   fill={COLORS.leave}   radius={[3, 3, 0, 0]} maxBarSize={16} />
              <Bar dataKey="sick"    name={labels.sick}    fill={COLORS.sick}    radius={[3, 3, 0, 0]} maxBarSize={16} />
              <Bar dataKey="late"    name={labels.late}    fill={COLORS.late}    radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default AttendanceStats;
