import { useState, useEffect } from "react";
import { supabase } from "@services/supabase/client";
import { useLanguage } from "@app/providers/LanguageContext";
import { ChevronLeft, Archive } from "lucide-react";
import { Skeleton } from "@shared/components/ui/skeleton";
import { useMonthlyActiveEmployeeIds } from "@shared/hooks/useMonthlyActiveEmployeeIds";
import { filterVisibleEmployeesInMonth } from "@shared/lib/employeeVisibility";

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

type Employee = {
  id: string;
  name: string;
  national_id: string | null;
  salary_type: string;
  base_salary: number;
};
type AttendanceRow = { employee_id: string; status: string };
type MonthOption  = { year: number; month: number; label: string; key: string };

// Build list of past 24 months (not including current month)
const buildPastMonths = (): MonthOption[] => {
  const now = new Date();
  const result: MonthOption[] = [];
  for (let i = 1; i <= 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year:  d.getFullYear(),
      month: d.getMonth(),
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTHS_AR[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return result;
};

const PAST_MONTHS = buildPastMonths();

const ArchiveAttendance = () => {
  const { isRTL } = useLanguage();
  const [selected, setSelected]         = useState<MonthOption | null>(null);
  const [employees, setEmployees]       = useState<Employee[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading]           = useState(false);
  const monthKey = selected
    ? `${selected.year}-${String(selected.month + 1).padStart(2, "0")}`
    : null;
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey ?? undefined);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  useEffect(() => {
    if (!selected) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const monthStr = String(selected.month + 1).padStart(2, "0");
        const startDate = `${selected.year}-${monthStr}-01`;
        const daysInMonth = new Date(selected.year, selected.month + 1, 0).getDate();
        const endDate = `${selected.year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

        const [empRes, attRes] = await Promise.all([
          supabase
            .from("employees")
            .select("id, name, national_id, salary_type, base_salary")
            .eq("status", "active")
            .order("name"),
          supabase
            .from("attendance")
            .select("employee_id, status")
            .gte("date", startDate)
            .lte("date", endDate),
        ]);

        if (empRes.data) {
          const rows = empRes.data as Employee[];
          setEmployees(filterVisibleEmployeesInMonth(rows, activeEmployeeIdsInMonth));
        }
        if (attRes.data) setAttendanceRows(attRes.data as AttendanceRow[]);
      } catch (err) {
        console.error('[ArchiveAttendance] fetch failed', err);
        setEmployees([]);
        setAttendanceRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selected, activeEmployeeIdsInMonth]);

  const tableData = employees.map(emp => {
    const rows        = attendanceRows.filter(r => r.employee_id === emp.id);
    const presentDays = rows.filter(r => r.status === "present").length;
    const absentDays  = rows.filter(r => r.status === "absent").length;
    const leaveDays   = rows.filter(r => r.status === "leave").length;
    const sickDays    = rows.filter(r => r.status === "sick").length;
    const lateDays    = rows.filter(r => r.status === "late").length;
    const totalHours  = (presentDays + lateDays) * 8;
    return { ...emp, presentDays, absentDays, leaveDays, sickDays, lateDays, totalHours };
  });

  const totals = tableData.reduce(
    (acc, d) => ({
      presentDays: acc.presentDays + d.presentDays,
      absentDays:  acc.absentDays  + d.absentDays,
      leaveDays:   acc.leaveDays   + d.leaveDays,
      sickDays:    acc.sickDays    + d.sickDays,
      lateDays:    acc.lateDays    + d.lateDays,
      totalHours:  acc.totalHours  + d.totalHours,
    }),
    { presentDays: 0, absentDays: 0, leaveDays: 0, sickDays: 0, lateDays: 0, totalHours: 0 },
  );

  // ── Month list view ──
  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Archive size={16} />
          <span className="text-sm">اختر شهراً لعرض سجل الحضور (للقراءة فقط)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {PAST_MONTHS.map(m => (
            <button
              key={m.key}
              onClick={() => setSelected(m)}
              className="flex flex-col items-center justify-center gap-1 p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
            >
              <span className="text-sm font-semibold text-foreground">
                {MONTHS_AR[m.month]}
              </span>
              <span className="text-xs text-muted-foreground">{m.year}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Selected month detail view ──
  return (
    <div className="space-y-4">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setSelected(null); setEmployees([]); setAttendanceRows([]); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          الأرشيف
        </button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-semibold text-foreground">{selected.label}</span>
        <span className="text-xs text-muted-foreground bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 ms-auto">
          🔒 للقراءة فقط
        </span>
      </div>

      {/* Summary stats */}
      {!loading && tableData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'إجمالي الحضور',  value: totals.presentDays, cls: 'text-green-600 dark:text-green-400'  },
            { label: 'إجمالي الغياب',  value: totals.absentDays,  cls: 'text-destructive'                    },
            { label: 'إجمالي الإجازات', value: totals.leaveDays,  cls: 'text-yellow-600 dark:text-yellow-400' },
            { label: 'إجمالي المرض',   value: totals.sickDays,    cls: 'text-purple-600 dark:text-purple-400' },
            { label: 'إجمالي التأخير', value: totals.lateDays,    cls: 'text-orange-600 dark:text-orange-400' },
          ].map(s => (
            <div key={s.label} className="ds-card p-3 text-center">
              <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
            <thead className="ta-thead">
              <tr>
                <th className={`ta-th sticky ${isRTL ? "right-0" : "left-0"} text-center bg-muted/40`}>
                  المندوب
                </th>
                <th className="ta-th">رقم الهوية</th>
                <th className="ta-th-center"><span className="badge-success">حضور</span></th>
                <th className="ta-th-center"><span className="badge-urgent">غياب</span></th>
                <th className="ta-th-center"><span className="badge-warning">إجازة</span></th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">مريض</span>
                </th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">متأخر</span>
                </th>
                <th className="ta-th-center">ساعات العمل</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`archive-skeleton-${i}`} className="ta-tr">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={`archive-skeleton-cell-${i}-${j}`} className="ta-td"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : tableData.length === 0
                ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-muted-foreground">
                      لا توجد بيانات لشهر {selected.label}
                    </td>
                  </tr>
                )
                : tableData.map(row => (
                    <tr key={row.id} className="ta-tr">
                      <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-card`}>
                        <span className="font-medium text-foreground whitespace-nowrap">{row.name}</span>
                      </td>
                      <td className="ta-td text-muted-foreground font-mono text-xs" dir="ltr">
                        {row.national_id || "—"}
                      </td>
                      <td className="ta-td-center font-semibold text-green-600 dark:text-green-400">{row.presentDays}</td>
                      <td className="ta-td-center font-semibold text-destructive">{row.absentDays}</td>
                      <td className="ta-td-center font-semibold text-yellow-600 dark:text-yellow-400">{row.leaveDays}</td>
                      <td className="ta-td-center font-semibold text-purple-600 dark:text-purple-400">{row.sickDays}</td>
                      <td className="ta-td-center text-orange-600 dark:text-orange-400">{row.lateDays}</td>
                      <td className="ta-td-center text-muted-foreground">{row.totalHours} س</td>
                    </tr>
                  ))
              }
            </tbody>
            {!loading && tableData.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                  <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-muted/40 text-foreground`}>الإجمالي</td>
                  <td className="ta-td" />
                  <td className="ta-td-center text-green-600 dark:text-green-400">{totals.presentDays}</td>
                  <td className="ta-td-center text-destructive">{totals.absentDays}</td>
                  <td className="ta-td-center text-yellow-600 dark:text-yellow-400">{totals.leaveDays}</td>
                  <td className="ta-td-center text-purple-600 dark:text-purple-400">{totals.sickDays}</td>
                  <td className="ta-td-center text-orange-600 dark:text-orange-400">{totals.lateDays}</td>
                  <td className="ta-td-center text-muted-foreground">{totals.totalHours} س</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArchiveAttendance;
