import { useState } from 'react';
import { employees } from '@/data/mock';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const months = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Generate mock monthly data for each employee
const generateMonthlyData = () => {
  return employees.filter(e => e.status !== 'terminated').map((emp) => {
    const presentDays = Math.floor(Math.random() * 6) + 22;
    const absentDays = Math.floor(Math.random() * 3);
    const leaveDays = Math.floor(Math.random() * 3);
    const sickDays = Math.floor(Math.random() * 2);
    const lateDays = Math.floor(Math.random() * 4);
    const totalHours = presentDays * 8 + lateDays * 6;
    const baseSalary = emp.monthlySalary || 3000;
    const attendanceRatio = presentDays / 30;
    const earnedSalary = Math.round(baseSalary * attendanceRatio);

    return {
      id: emp.id,
      name: emp.name,
      nationalId: emp.nationalId,
      salaryType: emp.salaryType,
      presentDays,
      absentDays,
      leaveDays,
      sickDays,
      lateDays,
      totalHours,
      earnedSalary,
      baseSalary,
    };
  });
};

const MonthlyRecord = () => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const data = generateMonthlyData();

  const totals = data.reduce(
    (acc, d) => ({
      presentDays: acc.presentDays + d.presentDays,
      absentDays: acc.absentDays + d.absentDays,
      leaveDays: acc.leaveDays + d.leaveDays,
      sickDays: acc.sickDays + d.sickDays,
      lateDays: acc.lateDays + d.lateDays,
      totalHours: acc.totalHours + d.totalHours,
      earnedSalary: acc.earnedSalary + d.earnedSalary,
    }),
    { presentDays: 0, absentDays: 0, leaveDays: 0, sickDays: 0, lateDays: 0, totalHours: 0, earnedSalary: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex gap-3 items-center">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {months[Number(selectedMonth)]} {selectedYear}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-3 font-semibold text-muted-foreground sticky right-0 bg-muted/30">المندوب</th>
                <th className="text-right p-3 font-semibold text-muted-foreground">رقم الهوية</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">
                  <span className="badge-success">حضور</span>
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground">
                  <span className="badge-urgent">غياب</span>
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground">
                  <span className="badge-warning">إجازة</span>
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground">
                  <span className="badge-info">مرضية</span>
                </th>
                <th className="text-center p-3 font-semibold text-muted-foreground">تأخير</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">ساعات العمل</th>
                <th className="text-center p-3 font-semibold text-muted-foreground">المستحق</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="p-3 sticky right-0 bg-card">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {row.name.charAt(0)}
                      </div>
                      <span className="font-medium text-foreground whitespace-nowrap">{row.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground font-mono text-xs" dir="ltr">{row.nationalId}</td>
                  <td className="p-3 text-center font-semibold text-success">{row.presentDays}</td>
                  <td className="p-3 text-center font-semibold text-destructive">{row.absentDays}</td>
                  <td className="p-3 text-center font-semibold text-warning">{row.leaveDays}</td>
                  <td className="p-3 text-center font-semibold text-info">{row.sickDays}</td>
                  <td className="p-3 text-center text-muted-foreground">{row.lateDays}</td>
                  <td className="p-3 text-center text-muted-foreground">{row.totalHours} س</td>
                  <td className="p-3 text-center font-semibold text-foreground">{row.earnedSalary.toLocaleString()} ر.س</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40 font-semibold">
                <td className="p-3 sticky right-0 bg-muted/40 text-foreground">الإجمالي</td>
                <td className="p-3"></td>
                <td className="p-3 text-center text-success">{totals.presentDays}</td>
                <td className="p-3 text-center text-destructive">{totals.absentDays}</td>
                <td className="p-3 text-center text-warning">{totals.leaveDays}</td>
                <td className="p-3 text-center text-info">{totals.sickDays}</td>
                <td className="p-3 text-center text-muted-foreground">{totals.lateDays}</td>
                <td className="p-3 text-center text-muted-foreground">{totals.totalHours} س</td>
                <td className="p-3 text-center text-foreground">{totals.earnedSalary.toLocaleString()} ر.س</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MonthlyRecord;
