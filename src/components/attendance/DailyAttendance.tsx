import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  CalendarIcon, UserCheck, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions } from '@/hooks/usePermissions';

type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'late';

interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus | string | null;
  checkIn: string;
  checkOut: string;
  note: string;
}

type Employee = { id: string; name: string; salary_type: string; job_title?: string | null };

// Color mapping per status key (for built-in statuses)
const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800 border-green-300',
  absent:  'bg-red-100 text-red-800 border-red-300',
  leave:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  sick:    'bg-purple-100 text-purple-800 border-purple-300',
  late:    'bg-orange-100 text-orange-800 border-orange-300',
};
const DEFAULT_COLOR = 'bg-primary/10 text-primary border-primary/30';

const STATUS_LABELS_AR: Record<string, string> = {
  present: 'حاضر',
  absent:  'غائب',
  leave:   'إجازة',
  sick:    'مريض',
  late:    'متأخر',
};
const STATUS_LABELS_EN: Record<string, string> = {
  present: 'Present',
  absent:  'Absent',
  leave:   'Leave',
  sick:    'Sick',
  late:    'Late',
};

const BUILT_IN_STATUSES: AttendanceStatus[] = ['present', 'absent', 'leave', 'sick', 'late'];

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const DailyAttendance = ({ selectedMonth, selectedYear }: Props) => {
  const { lang, isRTL } = useLanguage();
  const { permissions } = usePermissions('attendance');
  const dateLocale = lang === 'ar' ? ar : enUS;
  const statusLabels = lang === 'ar' ? STATUS_LABELS_AR : STATUS_LABELS_EN;

  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(selectedMonth);
    d.setFullYear(selectedYear);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (d.getDate() > lastDay) d.setDate(lastDay);
    return d;
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Custom statuses from localStorage
  const [customStatuses, setCustomStatuses] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('custom_attendance_statuses') || '[]'); } catch { return []; }
  });

  // Per-row "adding custom status" input
  const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    setDate(prev => {
      const d = new Date(prev);
      d.setFullYear(selectedYear);
      d.setMonth(selectedMonth);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      if (d.getDate() > lastDay) d.setDate(lastDay);
      return d;
    });
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    supabase.from('employees').select('id, name, salary_type, job_title')
      .eq('status', 'active').order('name')
      .then(({ data }) => {
        if (data) setEmployees(data as Employee[]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (employees.length === 0) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    supabase.from('attendance').select('*').eq('date', dateStr)
      .then(({ data }) => {
        const initial: Record<string, AttendanceRecord> = {};
        employees.forEach(emp => {
          const existing = data?.find(r => r.employee_id === emp.id);
          initial[emp.id] = {
            employeeId: emp.id,
            status: (existing?.status as AttendanceStatus) ?? null,
            checkIn: existing?.check_in ?? '',
            checkOut: existing?.check_out ?? '',
            note: existing?.note ?? '',
          };
        });
        setRecords(initial);
      });
  }, [date, employees]);

  const updateRecord = (empId: string, field: keyof AttendanceRecord, value: string | null) => {
    setRecords(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const markAllPresent = () => {
    setRecords(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => { updated[id] = { ...updated[id], status: 'present' }; });
      return updated;
    });
    toast({ title: lang === 'ar' ? 'تم تسجيل الكل حاضرين ✅' : 'All marked as present ✅' });
  };

  const addCustomStatus = (empId: string) => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    // Save to localStorage pool
    if (!customStatuses.includes(trimmed)) {
      const updated = [...customStatuses, trimmed];
      setCustomStatuses(updated);
      localStorage.setItem('custom_attendance_statuses', JSON.stringify(updated));
    }
    updateRecord(empId, 'status', trimmed);
    setAddingCustomFor(null);
    setCustomInput('');
  };

  const handleSave = async () => {
    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const toSave = Object.values(records).filter(r => r.status !== null);
    let saved = 0;

    const validDbStatuses: AttendanceStatus[] = ['present', 'absent', 'leave', 'sick', 'late'];

    for (const r of toSave) {
      const dbStatus: AttendanceStatus = validDbStatuses.includes(r.status as AttendanceStatus)
        ? (r.status as AttendanceStatus)
        : 'present'; // fallback for custom

      const noteText = [r.note, !validDbStatuses.includes(r.status as AttendanceStatus) ? r.status : ''].filter(Boolean).join(' | ') || null;

      const payload = {
        employee_id: r.employeeId,
        date: dateStr,
        status: dbStatus,
        check_in: r.checkIn || null,
        check_out: r.checkOut || null,
        note: noteText,
      };
      const { error } = await supabase.from('attendance').upsert([payload], {
        onConflict: 'employee_id,date',
      });
      if (!error) saved++;
    }

    setSaving(false);
    toast({
      title: lang === 'ar'
        ? `تم حفظ حضور ${saved} مندوب بنجاح ✅`
        : `Saved attendance for ${saved} employees ✅`,
      description: format(date, 'dd MMMM yyyy', { locale: dateLocale }),
    });
  };

  // Summary
  const summary = Object.values(records).reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const savedCount = Object.values(records).filter(r => r.status !== null).length;

  const allStatuses = [
    ...BUILT_IN_STATUSES.map(k => ({ value: k, label: statusLabels[k] })),
    ...customStatuses.map(s => ({ value: s, label: s })),
  ];

  const colHeaders = {
    employee: lang === 'ar' ? 'المندوب' : 'Employee',
    status:   lang === 'ar' ? 'الحالة' : 'Status',
    checkIn:  lang === 'ar' ? 'وقت الحضور' : 'Check In',
    checkOut: lang === 'ar' ? 'وقت الانصراف' : 'Check Out',
    note:     lang === 'ar' ? 'ملاحظة' : 'Note',
  };

  return (
    <div className="space-y-4">
      {/* Sub-header: date picker + action buttons */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn('w-[210px] justify-start gap-2 font-normal')}>
                <CalendarIcon size={16} />
                {format(date, 'dd MMMM yyyy', { locale: dateLocale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={d => d && setDate(d)}
                initialFocus
                className="p-3 pointer-events-auto"
                fromDate={new Date(selectedYear, selectedMonth, 1)}
                toDate={new Date(selectedYear, selectedMonth + 1, 0)}
              />
            </PopoverContent>
          </Popover>
          <span className="text-sm text-muted-foreground">
            {employees.length} {lang === 'ar' ? 'مندوب نشط' : 'active employees'}
          </span>
        </div>
        <div className="flex gap-2">
          {permissions.can_edit && (
            <Button variant="outline" onClick={markAllPresent} className="gap-2">
              <UserCheck size={16} />
              {lang === 'ar' ? 'تسجيل الكل حاضرين' : 'Mark All Present'}
            </Button>
          )}
          {permissions.can_edit && (
            <Button onClick={handleSave} disabled={saving || savedCount === 0} className="gap-2">
              <Save size={16} />
              {saving
                ? (lang === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                : `${lang === 'ar' ? 'حفظ الحضور' : 'Save'} (${savedCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(summary).map(([key, count]) => count > 0 ? (
          <span key={key} className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[key] || DEFAULT_COLOR}`}>
            {statusLabels[key] || key}: {count}
          </span>
        ) : null)}
        {savedCount === 0 && (
          <span className="text-xs text-muted-foreground">
            {lang === 'ar' ? 'لم يُحدَّد أي حضور بعد' : 'No attendance recorded yet'}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="ta-thead">
              <tr>
                <th className={`ta-th sticky ${isRTL ? 'right-0' : 'left-0'} bg-muted/40 min-w-[160px] text-start`}>
                  {colHeaders.employee}
                </th>
                <th className="ta-th min-w-[200px]">{colHeaders.status}</th>
                <th className="ta-th-center">{colHeaders.checkIn}</th>
                <th className="ta-th-center">{colHeaders.checkOut}</th>
                <th className="ta-th min-w-[180px]">{colHeaders.note}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="ta-tr">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="ta-td"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : employees.map(emp => {
                const record = records[emp.id] ?? { status: null, checkIn: '', checkOut: '', note: '', employeeId: emp.id };
                const currentStatus = record.status;
                const selectColor = currentStatus ? (STATUS_COLORS[currentStatus] || DEFAULT_COLOR) : '';
                const isAddingCustom = addingCustomFor === emp.id;

                return (
                  <tr key={emp.id} className="ta-tr">
                    {/* Name — always start-aligned per layout dir */}
                    <td className={`ta-td sticky ${isRTL ? 'right-0' : 'left-0'} bg-card`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground whitespace-nowrap">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {emp.job_title || (emp.salary_type === 'orders'
                              ? (lang === 'ar' ? 'طلبات' : 'Orders')
                              : (lang === 'ar' ? 'دوام' : 'Shift'))}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Status dropdown */}
                    <td className="ta-td">
                      <div className="flex items-center gap-2">
                        {isAddingCustom ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={customInput}
                              onChange={e => setCustomInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') addCustomStatus(emp.id);
                                if (e.key === 'Escape') { setAddingCustomFor(null); setCustomInput(''); }
                              }}
                              placeholder={lang === 'ar' ? 'اسم الحالة...' : 'Status name...'}
                              className="h-8 text-xs w-32"
                            />
                            <Button size="sm" className="h-8 text-xs px-2" onClick={() => addCustomStatus(emp.id)}>
                              {lang === 'ar' ? 'إضافة' : 'Add'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs px-2"
                              onClick={() => { setAddingCustomFor(null); setCustomInput(''); }}>
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <Select
                            value={currentStatus || ''}
                            disabled={!permissions.can_edit}
                            onValueChange={v => {
                              if (v === '__add_custom__') {
                                setAddingCustomFor(emp.id);
                                setCustomInput('');
                              } else {
                                updateRecord(emp.id, 'status', v || null);
                              }
                            }}
                          >
                            <SelectTrigger className={cn(
                              'h-8 text-xs w-40 border',
                              currentStatus ? selectColor : 'text-muted-foreground'
                            )}>
                              <SelectValue placeholder={lang === 'ar' ? 'اختر الحالة...' : 'Select status...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {allStatuses.map(s => (
                                <SelectItem key={s.value} value={s.value}>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[s.value] || DEFAULT_COLOR}`}>
                                    {s.label}
                                  </span>
                                </SelectItem>
                              ))}
                              <SelectItem value="__add_custom__" className="text-primary font-medium border-t mt-1">
                                + {lang === 'ar' ? 'إضافة حالة جديدة...' : 'Add new status...'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>

                    {/* Check in */}
                    <td className="ta-td-center">
                      <Input
                        type="time"
                        disabled={!permissions.can_edit}
                        value={record.checkIn}
                        onChange={e => updateRecord(emp.id, 'checkIn', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>

                    {/* Check out */}
                    <td className="ta-td-center">
                      <Input
                        type="time"
                        disabled={!permissions.can_edit}
                        value={record.checkOut}
                        onChange={e => updateRecord(emp.id, 'checkOut', e.target.value)}
                        className="w-28 text-sm"
                        dir="ltr"
                      />
                    </td>

                    {/* Note */}
                    <td className="ta-td">
                      <Input
                        disabled={!permissions.can_edit}
                        placeholder={lang === 'ar' ? 'ملاحظة اختيارية...' : 'Optional note...'}
                        value={record.note}
                        onChange={e => updateRecord(emp.id, 'note', e.target.value)}
                        className="text-sm min-w-[160px]"
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
