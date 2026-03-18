import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

const MONTHS_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Employee = { id: string; name: string; national_id: string | null; salary_type: string; base_salary: number };
type AttendanceRow = { employee_id: string; status: string };

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const MonthlyRecord = ({ selectedMonth, selectedYear }: Props) => {
  const { lang, isRTL } = useLanguage();
  const MONTHS = lang === "ar" ? MONTHS_AR : MONTHS_EN;

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const monthStr = String(selectedMonth + 1).padStart(2, "0");
      const startDate = `${selectedYear}-${monthStr}-01`;
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endDate = `${selectedYear}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      const [empRes, attRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, name, national_id, salary_type, base_salary")
          .eq("status", "active")
          .order("name"),
        supabase.from("attendance").select("employee_id, status").gte("date", startDate).lte("date", endDate),
      ]);

      if (empRes.data) setEmployees(empRes.data as Employee[]);
      if (attRes.data) setAttendanceRows(attRes.data as AttendanceRow[]);
      setLoading(false);
    };
    fetchData();
  }, [selectedMonth, selectedYear]);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const data = employees.map((emp) => {
    const rows = attendanceRows.filter((r) => r.employee_id === emp.id);
    const presentDays = rows.filter((r) => r.status === "present").length;
    const absentDays = rows.filter((r) => r.status === "absent").length;
    const leaveDays = rows.filter((r) => r.status === "leave").length;
    const sickDays = rows.filter((r) => r.status === "sick").length;
    const lateDays = rows.filter((r) => r.status === "late").length;
    const totalHours = (presentDays + lateDays) * 8;
    return { ...emp, presentDays, absentDays, leaveDays, sickDays, lateDays, totalHours };
  });

  const totals = data.reduce(
    (acc, d) => ({
      presentDays: acc.presentDays + d.presentDays,
      absentDays: acc.absentDays + d.absentDays,
      leaveDays: acc.leaveDays + d.leaveDays,
      sickDays: acc.sickDays + d.sickDays,
      lateDays: acc.lateDays + d.lateDays,
      totalHours: acc.totalHours + d.totalHours,
    }),
    { presentDays: 0, absentDays: 0, leaveDays: 0, sickDays: 0, lateDays: 0, totalHours: 0 },
  );

  const t = {
    employee: lang === "ar" ? "المندوب" : "Employee",
    nationalId: lang === "ar" ? "رقم الهوية" : "National ID",
    present: lang === "ar" ? "حضور" : "Present",
    absent: lang === "ar" ? "غياب" : "Absent",
    leave: lang === "ar" ? "إجازة" : "Leave",
    sick: lang === "ar" ? "مريض" : "Sick",
    late: lang === "ar" ? "متأخر" : "Late",
    hours: lang === "ar" ? "ساعات العمل" : "Work Hours",
    total: lang === "ar" ? "الإجمالي" : "Total",
    noData: lang === "ar" ? "لا توجد بيانات لهذا الشهر" : "No data for this month",
    hoursUnit: lang === "ar" ? "س" : "h",
    monthPeriod: `${MONTHS[selectedMonth]} ${selectedYear}`,
  };

  return (
    <div className="space-y-5">
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir={isRTL ? "rtl" : "ltr"}>
            <thead className="ta-thead">
              <tr>
                <th
                  className={`ta-th sticky ${isRTL ? "right-0" : "left-0"} ${isRTL ? "text-right" : "text-left"} bg-muted/40`}
                >
                  {t.employee}
                </th>
                <th className="ta-th">{t.nationalId}</th>
                <th className="ta-th-center">
                  <span className="badge-success">{t.present}</span>
                </th>
                <th className="ta-th-center">
                  <span className="badge-urgent">{t.absent}</span>
                </th>
                <th className="ta-th-center">
                  <span className="badge-warning">{t.leave}</span>
                </th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {t.sick}
                  </span>
                </th>
                <th className="ta-th-center">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    {t.late}
                  </span>
                </th>
                <th className="ta-th-center">{lang === "ar" ? "ساعات العمل" : "Work Hours"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="ta-tr">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="ta-td">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-muted-foreground">
                    {t.noData}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.id} className="ta-tr">
                    <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-card`}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {row.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground whitespace-nowrap">{row.name}</span>
                      </div>
                    </td>
                    <td className="ta-td text-muted-foreground font-mono text-xs" dir="ltr">
                      {row.national_id || "—"}
                    </td>
                    <td className="ta-td-center font-semibold text-green-600 dark:text-green-400">{row.presentDays}</td>
                    <td className="ta-td-center font-semibold text-destructive">{row.absentDays}</td>
                    <td className="ta-td-center font-semibold text-yellow-600 dark:text-yellow-400">{row.leaveDays}</td>
                    <td className="ta-td-center font-semibold text-purple-600 dark:text-purple-400">{row.sickDays}</td>
                    <td className="ta-td-center text-orange-600 dark:text-orange-400">{row.lateDays}</td>
                    <td className="ta-td-center text-muted-foreground">
                      {row.totalHours} {t.hoursUnit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && data.length > 0 && (
              <tfoot>
                <tr className="bg-muted/40 font-semibold border-t-2 border-border">
                  <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-muted/40 text-foreground`}>
                    {t.total}
                  </td>
                  <td className="ta-td" />
                  <td className="ta-td-center text-green-600 dark:text-green-400">{totals.presentDays}</td>
                  <td className="ta-td-center text-destructive">{totals.absentDays}</td>
                  <td className="ta-td-center text-yellow-600 dark:text-yellow-400">{totals.leaveDays}</td>
                  <td className="ta-td-center text-purple-600 dark:text-purple-400">{totals.sickDays}</td>
                  <td className="ta-td-center text-orange-600 dark:text-orange-400">{totals.lateDays}</td>
                  <td className="ta-td-center text-muted-foreground">
                    {totals.totalHours} {t.hoursUnit}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyRecord;
