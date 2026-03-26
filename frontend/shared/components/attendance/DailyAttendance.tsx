import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarIcon, UserCheck, Save } from "lucide-react";
import { Button } from "@shared/components/ui/button";
import { Input } from "@shared/components/ui/input";
import { Calendar } from "@shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/components/ui/select";
import { cn } from "@shared/lib/utils";
import { toast } from "@shared/hooks/use-toast";
import { useLanguage } from "@app/providers/LanguageContext";
import { usePermissions } from "@shared/hooks/usePermissions";
import attendanceService from "@services/attendanceService";
import { useMonthlyActiveEmployeeIds } from "@shared/hooks/useMonthlyActiveEmployeeIds";
import { filterVisibleEmployeesInMonth } from "@shared/lib/employeeVisibility";

type AttendanceStatus = "present" | "absent" | "leave" | "sick" | "late";

interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus | string | null;
  checkIn: string;
  checkOut: string;
  note: string;
}

type Employee = { id: string; name: string; salary_type: string; job_title?: string | null };
type App = { id: string; name: string; logo_url?: string | null };

const toShortEmployeeName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1]}`;
};

const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-800 border-green-300",
  absent:  "bg-red-100 text-red-800 border-red-300",
  leave:   "bg-yellow-100 text-yellow-800 border-yellow-300",
  sick:    "bg-purple-100 text-purple-800 border-purple-300",
  late:    "bg-orange-100 text-orange-800 border-orange-300",
};
const DEFAULT_COLOR = "bg-primary/10 text-primary border-primary/30";

const STATUS_LABELS_AR: Record<string, string> = {
  present: "حاضر",
  absent:  "غائب",
  leave:   "إجازة",
  sick:    "مريض",
  late:    "متأخر",
};

const BUILT_IN_STATUSES: AttendanceStatus[] = ["present", "absent", "leave", "sick", "late"];

interface Props {
  selectedMonth: number;
  selectedYear: number;
}

const mapAttendanceData = (
  employees: Employee[],
  data: Array<{ employee_id: string; status?: string | null; check_in?: string | null; check_out?: string | null; note?: string | null }> | null | undefined
): Record<string, AttendanceRecord> => {
  const initial: Record<string, AttendanceRecord> = {};
  employees.forEach((emp) => {
    const existing = data?.find((r) => r.employee_id === emp.id);
    initial[emp.id] = {
      employeeId: emp.id,
      status: (existing?.status as AttendanceStatus) ?? null,
      checkIn: existing?.check_in ?? "",
      checkOut: existing?.check_out ?? "",
      note: existing?.note ?? "",
    };
  });
  return initial;
};

const DailyAttendance = ({ selectedMonth, selectedYear }: Props) => {
  const { isRTL } = useLanguage();
  const { permissions } = usePermissions("attendance");
  const dateLocale = ar;
  const statusLabels = STATUS_LABELS_AR;
  const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(monthKey);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setMonth(selectedMonth);
    d.setFullYear(selectedYear);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (d.getDate() > lastDay) d.setDate(lastDay);
    return d;
  });

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [apps, setApps]                 = useState<App[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  // Map: appId → Set of employee IDs registered in that app
  const [appEmployeeIds, setAppEmployeeIds] = useState<Record<string, Set<string>>>({});

  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);

  // Custom statuses from localStorage
  const [customStatuses, setCustomStatuses] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("custom_attendance_statuses") || "[]"); }
    catch (e) {
      console.warn('[DailyAttendance] invalid custom_attendance_statuses in storage', e);
      return [];
    }
  });
  const [addingCustomFor, setAddingCustomFor] = useState<string | null>(null);
  const [customInput, setCustomInput]         = useState("");

  // ── Sync date when month/year props change ──
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

  // ── Fetch employees (active, NOT absconded/terminated) + apps ──
  useEffect(() => {
    const fetchBase = async () => {
      setLoading(true);
      try {
        const [empRes, appRes, empAppsRes] = await Promise.all([
          supabase
            .from("employees")
            .select("id, name, salary_type, job_title, sponsorship_status")
            .eq("status", "active")
            .order("name"),
          supabase
            .from("apps")
            .select("id, name, logo_url")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("employee_apps")
            .select("employee_id, app_id"),
        ]);

        if (empRes.data) {
          const rows = empRes.data as Employee[];
          setAllEmployees(filterVisibleEmployeesInMonth(rows, activeEmployeeIdsInMonth));
        }
        if (appRes.data) setApps(appRes.data as App[]);

        // Build map: appId → Set<employeeId>
        if (empAppsRes.data) {
          const map: Record<string, Set<string>> = {};
          for (const row of empAppsRes.data) {
            if (!map[row.app_id]) map[row.app_id] = new Set();
            map[row.app_id].add(row.employee_id);
          }
          setAppEmployeeIds(map);
        }
      } catch (e) {
        console.error('[DailyAttendance] fetchBase failed', e);
      } finally {
        setLoading(false);
      }
    };
    fetchBase();
  }, [activeEmployeeIdsInMonth]);

  // ── Derive displayed employees based on platform filter ──
  const employees = selectedAppId
    ? allEmployees.filter(e => appEmployeeIds[selectedAppId]?.has(e.id))
    : allEmployees;

  // ── Load attendance records for selected date ──
  useEffect(() => {
    if (allEmployees.length === 0) return;
    const dateStr = format(date, "yyyy-MM-dd");
    supabase
      .from("attendance")
      .select("*")
      .eq("date", dateStr)
      .then(({ data }) => {
        setRecords(mapAttendanceData(allEmployees, data as Array<{ employee_id: string; status?: string | null; check_in?: string | null; check_out?: string | null; note?: string | null }>));
      });
  }, [date, allEmployees]);

  const updateRecord = (empId: string, field: keyof AttendanceRecord, value: string | null) => {
    setRecords(prev => ({ ...prev, [empId]: { ...prev[empId], [field]: value } }));
  };

  const markAllPresent = () => {
    setRecords(prev => {
      const updated = { ...prev };
      // Mark all currently displayed employees as present
      employees.forEach(emp => {
        updated[emp.id] = { ...updated[emp.id], status: "present" };
      });
      return updated;
    });
    toast({ title: "تم تسجيل الكل حاضرين ✅" });
  };

  const addCustomStatus = (empId: string) => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (!customStatuses.includes(trimmed)) {
      const updated = [...customStatuses, trimmed];
      setCustomStatuses(updated);
      localStorage.setItem("custom_attendance_statuses", JSON.stringify(updated));
    }
    updateRecord(empId, "status", trimmed);
    setAddingCustomFor(null);
    setCustomInput("");
  };

  // ── Save (unchanged logic) ──
  const handleSave = async () => {
    setSaving(true);
    const dateStr = format(date, "yyyy-MM-dd");
    const toSave = Object.values(records).filter(r => r.status !== null);
    let saved = 0;
    const validDbStatuses = new Set<AttendanceStatus>(["present", "absent", "leave", "sick", "late"]);

    for (const r of toSave) {
      const dbStatus: AttendanceStatus = validDbStatuses.has(r.status as AttendanceStatus)
        ? (r.status as AttendanceStatus)
        : "present";
      const noteText =
        [r.note, !validDbStatuses.has(r.status as AttendanceStatus) ? r.status : ""]
          .filter(Boolean).join(" | ") || null;

      const payload = {
        employee_id: r.employeeId,
        date:        dateStr,
        status:      dbStatus,
        check_in:    r.checkIn  || null,
        check_out:   r.checkOut || null,
        note:        noteText,
      };
      const { error } = await attendanceService.upsertDailyAttendance(payload);
      if (!error) saved++;
    }

    setSaving(false);
    toast({
      title: `تم حفظ حضور ${saved} مندوب بنجاح ✅`,
      description: format(date, "dd MMMM yyyy", { locale: dateLocale }),
    });
  };

  // ── Summary (of displayed employees only) ──
  const summary = employees.reduce((acc, emp) => {
    const r = records[emp.id];
    if (r?.status) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const savedCount = Object.values(records).filter(r => r.status !== null).length;

  const allStatuses = [
    ...BUILT_IN_STATUSES.map(k => ({ value: k, label: statusLabels[k] })),
    ...customStatuses.map(s => ({ value: s, label: s })),
  ];
  let tableBodyRows: React.ReactNode;
  if (loading) {
    tableBodyRows = Array.from({ length: 5 }).map((_, i) => (
      <tr key={`skeleton-row-${i}`} className="ta-tr">
        {Array.from({ length: 5 }).map((_, j) => (
          <td key={`skeleton-cell-${i}-${j}`} className="ta-td">
            <div className="h-4 bg-muted rounded animate-pulse" />
          </td>
        ))}
      </tr>
    ));
  } else if (employees.length === 0) {
    tableBodyRows = (
      <tr>
        <td colSpan={5} className="ta-td text-center py-12 text-muted-foreground">
          {selectedAppId ? 'لا يوجد مناديب مسجّلون في هذه المنصة' : 'لا يوجد مناديب نشطون'}
        </td>
      </tr>
    );
  } else {
    tableBodyRows = employees.map(emp => {
      const record = records[emp.id] ?? {
        status: null, checkIn: "", checkOut: "", note: "", employeeId: emp.id,
      };
      const currentStatus = record.status;
      const selectColor = currentStatus ? STATUS_COLORS[currentStatus] || DEFAULT_COLOR : "";
      const isAddingCustom = addingCustomFor === emp.id;

      return (
        <tr key={emp.id} className="ta-tr">
          {/* Name */}
          <td className={`ta-td sticky ${isRTL ? "right-0" : "left-0"} bg-card max-w-[130px]`}>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm font-medium text-foreground whitespace-nowrap truncate" title={emp.name}>
                  {toShortEmployeeName(emp.name)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {emp.job_title || (emp.salary_type === "orders" ? "طلبات" : "دوام")}
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
                      if (e.key === "Enter") addCustomStatus(emp.id);
                      if (e.key === "Escape") { setAddingCustomFor(null); setCustomInput(""); }
                    }}
                    placeholder="اسم الحالة..."
                    className="h-8 text-xs w-32"
                  />
                  <Button size="sm" className="h-8 text-xs px-2" onClick={() => addCustomStatus(emp.id)}>
                    إضافة
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-8 text-xs px-2"
                    onClick={() => { setAddingCustomFor(null); setCustomInput(""); }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select
                  value={currentStatus || ""}
                  disabled={!permissions.can_edit}
                  onValueChange={v => {
                    if (v === "__add_custom__") {
                      setAddingCustomFor(emp.id);
                      setCustomInput("");
                    } else {
                      updateRecord(emp.id, "status", v || null);
                    }
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "h-8 text-xs w-40 border",
                      currentStatus ? selectColor : "text-muted-foreground",
                    )}
                  >
                    <SelectValue placeholder="اختر الحالة..." />
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
                      + إضافة حالة جديدة...
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
              onChange={e => updateRecord(emp.id, "checkIn", e.target.value)}
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
              onChange={e => updateRecord(emp.id, "checkOut", e.target.value)}
              className="w-28 text-sm"
              dir="ltr"
            />
          </td>

          {/* Note */}
          <td className="ta-td">
            <Input
              disabled={!permissions.can_edit}
              placeholder="ملاحظة اختيارية..."
              value={record.note}
              onChange={e => updateRecord(emp.id, "note", e.target.value)}
              className="text-sm min-w-[160px]"
            />
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Sub-header: التاريخ اليومي + المندوبين + المنصات + أزرار الحفظ ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground shrink-0">التاريخ اليومي</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 min-w-[160px] max-w-[200px] justify-start gap-2 font-normal text-sm px-2")}>
                <CalendarIcon size={15} className="shrink-0" />
                <span className="truncate">{format(date, "dd MMMM yyyy", { locale: dateLocale })}</span>
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
          <span className="text-xs text-muted-foreground shrink-0">
            · {employees.length} مندوب{selectedAppId ? ' (مصفّى بالمنصة)' : ' نشط'}
          </span>
          {apps.length > 0 && (
            <>
              <span className="hidden sm:inline text-border mx-0.5 select-none">|</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedAppId(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors leading-tight",
                    selectedAppId === null
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  الكل ({allEmployees.length})
                </button>
                {apps.map(app => {
                  const count = appEmployeeIds[app.id]
                    ? allEmployees.filter(e => appEmployeeIds[app.id]?.has(e.id)).length
                    : 0;
                  const isSelected = selectedAppId === app.id;
                  return (
                    <button
                      type="button"
                      key={app.id}
                      onClick={() => setSelectedAppId(isSelected ? null : app.id)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[140px] leading-tight",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                      )}
                      title={app.name}
                    >
                      {app.logo_url && (
                        <img src={app.logo_url} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="" />
                      )}
                      <span className="truncate">{app.name}</span>
                      <span className="shrink-0">({count})</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {permissions.can_edit && (
            <Button variant="outline" onClick={markAllPresent} className="gap-2 h-9 text-sm">
              <UserCheck size={16} />
              تسجيل الكل حاضرين
            </Button>
          )}
          {permissions.can_edit && (
            <Button onClick={handleSave} disabled={saving || savedCount === 0} className="gap-2 h-9 text-sm">
              <Save size={16} />
              {saving ? "جاري الحفظ..." : `حفظ (${savedCount})`}
            </Button>
          )}
        </div>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(summary).map(([key, count]) =>
          count > 0 ? (
            <span
              key={key}
              className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[key] || DEFAULT_COLOR}`}
            >
              {statusLabels[key] || key}: {count}
            </span>
          ) : null,
        )}
        {Object.values(summary).every(v => v === 0) && (
          <span className="text-xs text-muted-foreground">لم يُحدَّد أي حضور بعد</span>
        )}
      </div>

      {/* ── Table ── */}
      <div className="ta-table-wrap shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" dir={isRTL ? "rtl" : "ltr"}>
            <thead className="ta-thead">
              <tr>
                <th className={`ta-th sticky ${isRTL ? "right-0" : "left-0"} bg-muted/40 min-w-[88px] max-w-[130px] text-start`}>
                  المندوب
                </th>
                <th className="ta-th min-w-[200px]">الحالة</th>
                <th className="ta-th-center">وقت الحضور</th>
                <th className="ta-th-center">وقت الانصراف</th>
                <th className="ta-th min-w-[180px]">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {tableBodyRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyAttendance;
