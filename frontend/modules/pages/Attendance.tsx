import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Button } from '@shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { ClipboardCheck, CalendarDays, FolderOpen, BarChart2, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import DailyAttendance from '@shared/components/attendance/DailyAttendance';
import MonthlyRecord from '@shared/components/attendance/MonthlyRecord';
import AttendanceStats from '@shared/components/attendance/AttendanceStats';
import ArchiveAttendance from '@shared/components/attendance/ArchiveAttendance';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from '@e965/xlsx';
import { printHtmlTable } from '@shared/lib/printTable';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 2, currentYear - 1, currentYear];

const Attendance = () => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const MONTHS = MONTHS_AR;
  const importRef = useRef<HTMLInputElement>(null);

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const handleExportAttendance = () => {
    const ws = XLSX.utils.json_to_sheet([{ 'Note': `Attendance — ${MONTHS[Number(selectedMonth)]} ${selectedYear}` }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
    XLSX.writeFile(wb, `attendance_${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, '0')}.xlsx`);
  };

  const handleAttendanceTemplate = () => {
    const headers = [['اسم الموظف', 'التاريخ (YYYY-MM-DD)', 'الحالة (present/absent/leave/sick/late)', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قالب');
    XLSX.writeFile(wb, 'template_attendance.xlsx');
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Compact header: title+breadcrumb | filters+download ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: breadcrumb + title */}
        <div>
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>{t('attendance')}</span>
          </nav>
          <h1 className="page-title">{t('attendance')}</h1>
        </div>

        {/* Right: month/year filters + download */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={`month-${i}-${m}`} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-8 w-[80px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <FolderOpen size={14} />
                ملفات
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportAttendance}>
                📊 تصدير Excel (ملخص شهري)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAttendanceTemplate}>
                📋 تحميل قالب الاستيراد
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => importRef.current?.click()}>⬆️ استيراد Excel</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const table = document.querySelector('table');
                if (!table) return;
                printHtmlTable(table as HTMLTableElement, { title: 'سجل الحضور' });
              }}>🖨️ طباعة الجدول</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="daily" className="space-y-2">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="daily" className="gap-2">
            <ClipboardCheck size={15} />
            التسجيل اليومي
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarDays size={15} />
            السجل الشهري
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart2 size={15} />
            الإحصائيات
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <Archive size={15} />
            أرشيف
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyAttendance selectedMonth={Number(selectedMonth)} selectedYear={Number(selectedYear)} />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyRecord selectedMonth={Number(selectedMonth)} selectedYear={Number(selectedYear)} />
        </TabsContent>

        <TabsContent value="stats">
          <AttendanceStats selectedMonth={Number(selectedMonth)} selectedYear={Number(selectedYear)} />
        </TabsContent>

        <TabsContent value="archive">
          <ArchiveAttendance />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
