import { useState, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardCheck, CalendarDays, FolderOpen, Upload, BarChart2, Archive } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DailyAttendance from '@/components/attendance/DailyAttendance';
import MonthlyRecord from '@/components/attendance/MonthlyRecord';
import AttendanceStats from '@/components/attendance/AttendanceStats';
import ArchiveAttendance from '@/components/attendance/ArchiveAttendance';
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
              <DropdownMenuItem onClick={() => importRef.current?.click()}>
                <Upload size={14} className="ms-2" /> استيراد Excel
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const table = document.querySelector('table');
                if (!table) return;
                const win = globalThis.open('', '_blank');
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/><title>الحضور</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;direction:rtl;color:#111;background:#fff}h2{text-align:center;margin-bottom:12px;font-size:15px}table{width:100%;border-collapse:collapse}th{background:#1e3a5f;color:#fff;padding:6px 8px;text-align:right;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right}tr:nth-child(even) td{background:#f9f9f9}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><h2>سجل الحضور</h2>`);
                if (!win.document.body) return;
                // Append the live DOM table node to avoid string-interpolating table HTML.
                win.document.body.appendChild(table.cloneNode(true));
                win.document.write(`<script>globalThis.onload=()=>{globalThis.print();globalThis.onafterprint=()=>globalThis.close()}</script></body></html>`);
                win.document.close();
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
