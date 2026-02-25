import { useState } from 'react';
import { employees } from '@/data/mock';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, CheckCircle2, XCircle, Clock, Palmtree, Stethoscope, UserCheck, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'late';

interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  note: string;
}

const statusConfig: Record<AttendanceStatus, { label: string; icon: typeof CheckCircle2; className: string; activeClass: string }> = {
  present: { label: 'حاضر', icon: CheckCircle2, className: 'hover:bg-success/10 hover:text-success hover:border-success/30', activeClass: 'bg-success/15 text-success border-success/40' },
  absent: { label: 'غائب', icon: XCircle, className: 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30', activeClass: 'bg-destructive/15 text-destructive border-destructive/40' },
  leave: { label: 'إجازة', icon: Palmtree, className: 'hover:bg-warning/10 hover:text-warning hover:border-warning/30', activeClass: 'bg-warning/15 text-warning border-warning/40' },
  sick: { label: 'مرضية', icon: Stethoscope, className: 'hover:bg-info/10 hover:text-info hover:border-info/30', activeClass: 'bg-info/15 text-info border-info/40' },
  late: { label: 'تأخير', icon: Clock, className: 'hover:bg-warning/10 hover:text-warning hover:border-warning/30', activeClass: 'bg-warning/15 text-warning border-warning/40' },
};

const DailyAttendance = () => {
  const [date, setDate] = useState<Date>(new Date());
  const activeEmployees = employees.filter((e) => e.status === 'active');

  const [records, setRecords] = useState<Record<string, AttendanceRecord>>(() => {
    const initial: Record<string, AttendanceRecord> = {};
    activeEmployees.forEach((emp) => {
      initial[emp.id] = { employeeId: emp.id, status: 'present', checkIn: '', checkOut: '', note: '' };
    });
    return initial;
  });

  const updateRecord = (empId: string, field: keyof AttendanceRecord, value: string) => {
    setRecords((prev) => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const markAllPresent = () => {
    setRecords((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], status: 'present' };
      });
      return updated;
    });
    toast({ title: 'تم تسجيل الكل حاضرين ✅' });
  };

  const handleSave = () => {
    toast({ title: 'تم الحفظ بنجاح ✅', description: `حضور يوم ${format(date, 'yyyy-MM-dd')}` });
  };

  const summary = Object.values(records).reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[200px] justify-start gap-2 font-normal')}>
                <CalendarIcon size={16} />
                {format(date, 'dd MMMM yyyy', { locale: ar })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllPresent} className="gap-2">
            <UserCheck size={16} />
            تسجيل الكل حاضرين
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save size={16} />
            حفظ الحضور
          </Button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusConfig).map(([key, cfg]) => (
          <span key={key} className={`px-3 py-1 rounded-full text-xs font-medium border ${cfg.activeClass}`}>
            {cfg.label}: {summary[key] || 0}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">المندوب</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">الحالة</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">وقت الحضور</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">وقت الانصراف</th>
                <th className="text-right p-4 text-sm font-semibold text-muted-foreground">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp) => {
                const record = records[emp.id];
                return (
                  <tr key={emp.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.salaryType === 'orders' ? 'طلبات' : 'دوام'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5 flex-wrap">
                        {(Object.entries(statusConfig) as [AttendanceStatus, typeof statusConfig.present][]).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const isActive = record.status === key;
                          return (
                            <button
                              key={key}
                              onClick={() => updateRecord(emp.id, 'status', key)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-all ${
                                isActive ? cfg.activeClass : `border-border/50 text-muted-foreground ${cfg.className}`
                              }`}
                            >
                              <Icon size={12} />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3">
                      <Input
                        type="time"
                        value={record.checkIn}
                        onChange={(e) => updateRecord(emp.id, 'checkIn', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        type="time"
                        value={record.checkOut}
                        onChange={(e) => updateRecord(emp.id, 'checkOut', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>
                    <td className="p-3">
                      <Input
                        placeholder="ملاحظة..."
                        value={record.note}
                        onChange={(e) => updateRecord(emp.id, 'note', e.target.value)}
                        className="text-sm min-w-[140px]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyAttendance;
