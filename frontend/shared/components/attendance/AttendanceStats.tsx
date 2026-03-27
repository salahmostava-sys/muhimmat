import { useState, useEffect } from 'react';
import attendanceService from '@services/attendanceService';
import { logError } from '@shared/lib/logger';

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5'] as const;

const COLORS = {
  present: '#12B76A',
  absent: '#F04438',
  leave: '#F79009',
  sick: '#9B59B6',
  late: '#F97316',
};

const AttendanceStats = ({ selectedMonth, selectedYear }: Props) => {
  const [totals, setTotals] = useState({
    present: 0,
    absent: 0,
    leave: 0,
    sick: 0,
    late: 0,
  });
  const [loading, setLoading] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [hasNoRecords, setHasNoRecords] = useState(false);

  const labels = {
    present: 'حاضر',
    absent: 'غائب',
    leave: 'إجازة',
    sick: 'مريض',
    late: 'متأخر',
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const pad = (n: number) => String(n).padStart(2, '0');
        const from = `${selectedYear}-${pad(selectedMonth + 1)}-01`;
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const to = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(daysInMonth)}`;

        const [attRows, activeCount] = await Promise.all([
          attendanceService.getAttendanceStatusRange(from, to),
          attendanceService.getActiveEmployeesCount(),
        ]);

        setTotalEmployees(activeCount);
        setHasNoRecords(attRows.length === 0);

        const next: typeof totals = { present: 0, absent: 0, leave: 0, sick: 0, late: 0 };
        attRows.forEach((r) => {
          const s = r.status;
          if (s && s in next) next[s as keyof typeof next]++;
        });
        setTotals(next);
      } catch (err) {
        logError('[AttendanceStats] fetch failed', err);
        setTotals({ present: 0, absent: 0, leave: 0, sick: 0, late: 0 });
        setHasNoRecords(true);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [selectedMonth, selectedYear]);

  const totalRecorded = Object.values(totals).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 bg-muted/40 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {SKELETON_KEYS.map((k) => (
            <div key={k} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="space-y-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-tight">ملخص الحضور الشهري</h2>
            <p className="text-xs text-muted-foreground">
              توزيع السجلات حسب الحالة لهذا الشهر
            </p>
          </div>
          {totalEmployees > 0 && (
            <span className="inline-flex items-center shrink-0 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground">
              {totalEmployees} مندوب نشط
            </span>
          )}
        </div>

        {hasNoRecords && (
          <p className="mt-3 text-sm text-muted-foreground border-t border-border/40 pt-3">
            لا توجد بيانات حضور لهذا الشهر
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['present', 'absent', 'leave', 'sick', 'late'] as const).map((key) => {
          const count = totals[key];
          const pct = totalRecorded > 0 ? Math.round((count / totalRecorded) * 100) : 0;
          return (
            <div key={key} className="bg-card border border-border/50 rounded-xl p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: COLORS[key] }}
                />
                <span className="text-xs text-muted-foreground">{labels[key]}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AttendanceStats;
