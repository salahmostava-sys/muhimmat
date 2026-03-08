import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, CalendarDays, Download } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DailyAttendance from '@/components/attendance/DailyAttendance';
import MonthlyRecord from '@/components/attendance/MonthlyRecord';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const handleExportAttendance = () => {
  const ws = XLSX.utils.json_to_sheet([{ 'ملاحظة': 'يتم تصدير بيانات الحضور من شاشة السجل الشهري' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الحضور');
  XLSX.writeFile(wb, `الحضور_${format(new Date(), 'yyyy-MM')}.xlsx`);
};

const Attendance = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الحضور والانصراف</h1>
          <p className="text-sm text-muted-foreground mt-1">تسجيل ومتابعة حضور المناديب</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2"><Download size={15} /> 📥 تحميل تقرير ▾</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportAttendance}>📊 تصدير Excel (ملخص شهري)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Tabs defaultValue="daily" className="space-y-5">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="daily" className="gap-2">
            <ClipboardCheck size={16} />
            التسجيل اليومي
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarDays size={16} />
            السجل الشهري
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <DailyAttendance />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlyRecord />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
