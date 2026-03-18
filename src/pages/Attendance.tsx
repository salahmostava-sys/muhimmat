import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, CalendarDays, Download, Upload, BarChart2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DailyAttendance from '@/components/attendance/DailyAttendance';
import MonthlyRecord from '@/components/attendance/MonthlyRecord';
import AttendanceStats from '@/components/attendance/AttendanceStats';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from 'react-i18next';
import * as XLSX from '@e965/xlsx';

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
  const { lang, isRTL } = useLanguage();
  const { t } = useTranslation();
  const MONTHS = lang === 'ar' ? MONTHS_AR : MONTHS_EN;
  const importRef = useRef<HTMLInputElement>(null);

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const handleExportAttendance = () => {
    const ws = XLSX.utils.json_to_sheet([{ 'Note': `Attendance — ${MONTHS[Number(selectedMonth)]} ${selectedYear}` }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'الحضور' : 'Attendance');
    XLSX.writeFile(wb, `attendance_${selectedYear}-${String(Number(selectedMonth) + 1).padStart(2, '0')}.xlsx`);
  };

  const handleAttendanceTemplate = () => {
    const headers = [['اسم الموظف', 'التاريخ (YYYY-MM-DD)', 'الحالة (present/absent/leave/sick/late)', 'ملاحظات']];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, lang === 'ar' ? 'قالب' : 'Template');
    XLSX.writeFile(wb, 'template_attendance.xlsx');
  };

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Compact header: title+breadcrumb | filters+download ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left: breadcrumb + title */}
        <div>
          <nav className="page-breadcrumb">
            <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
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
                <SelectItem key={i} value={String(i)}>{m}</SelectItem>
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
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <Download size={13} />
                {lang === 'ar' ? 'تحميل ▾' : 'Export ▾'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportAttendance}>
                📊 {lang === 'ar' ? 'تصدير Excel (ملخص شهري)' : 'Export Excel (Monthly Summary)'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => importRef.current?.click()}>
                <Upload size={14} className="ms-2" /> {lang === 'ar' ? 'استيراد Excel' : 'Import Excel'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAttendanceTemplate}>
                📋 {lang === 'ar' ? 'تحميل القالب' : 'Download Template'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="daily" className="space-y-2">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="daily" className="gap-2">
            <ClipboardCheck size={15} />
            {lang === 'ar' ? 'التسجيل اليومي' : 'Daily Record'}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarDays size={15} />
            {lang === 'ar' ? 'السجل الشهري' : 'Monthly Record'}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart2 size={15} />
            {lang === 'ar' ? 'الإحصائيات' : 'Statistics'}
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
      </Tabs>
    </div>
  );
};

export default Attendance;
