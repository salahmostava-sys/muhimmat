import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, CalendarDays } from 'lucide-react';
import DailyAttendance from '@/components/attendance/DailyAttendance';
import MonthlyRecord from '@/components/attendance/MonthlyRecord';

const Attendance = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الحضور والانصراف</h1>
        <p className="text-sm text-muted-foreground mt-1">تسجيل ومتابعة حضور المناديب</p>
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
