import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export type AttendanceArchiveEmployee = {
  id: string;
  name: string;
  national_id: string | null;
  salary_type: string;
  base_salary: number;
};

export type AttendanceArchiveRow = { employee_id: string; status: string };

export type AttendanceBaseEmployee = { id: string; name: string; salary_type: string; job_title?: string | null };
export type AttendanceBaseApp = { id: string; name: string; logo_url?: string | null };
export type AttendanceEmployeeAppRow = { employee_id: string; app_id: string };

export type AttendanceDayRow = {
  employee_id: string;
  status: string | null;
  check_in: string | null;
  check_out: string | null;
  note: string | null;
};

export function useAttendanceArchiveMonth(params: { year: number; monthIndex0: number } | null) {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const authEnabled = !!session && !!user && !authLoading;
  return useQuery({
    queryKey: ['attendance', uid, 'archive', params?.year ?? null, params?.monthIndex0 ?? null] as const,
    enabled: authEnabled && !!params,
    queryFn: async () => {
      const monthStr = String(params!.monthIndex0 + 1).padStart(2, '0');
      const startDate = `${params!.year}-${monthStr}-01`;
      const daysInMonth = new Date(params!.year, params!.monthIndex0 + 1, 0).getDate();
      const endDate = `${params!.year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

      const [empRes, attRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, national_id, salary_type, base_salary')
          .eq('status', 'active')
          .not('sponsorship_status', 'in', '("absconded","terminated")')
          .order('name'),
        supabase
          .from('attendance')
          .select('employee_id, status')
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      if (empRes.error) throw new Error(empRes.error.message || 'تعذر تحميل الموظفين');
      if (attRes.error) throw new Error(attRes.error.message || 'تعذر تحميل الحضور');

      return {
        employees: (empRes.data ?? []) as AttendanceArchiveEmployee[],
        rows: (attRes.data ?? []) as AttendanceArchiveRow[],
      };
    },
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

export function useAttendanceBaseData() {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const authEnabled = !!session && !!user && !authLoading;
  return useQuery({
    queryKey: ['attendance', uid, 'base'] as const,
    enabled: authEnabled,
    queryFn: async () => {
      const [empRes, appRes, empAppsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, name, salary_type, job_title, sponsorship_status')
          .eq('status', 'active')
          .not('sponsorship_status', 'in', '("absconded","terminated")')
          .order('name'),
        supabase.from('apps').select('id, name, logo_url').eq('is_active', true).order('name'),
        supabase.from('employee_apps').select('employee_id, app_id'),
      ]);

      if (empRes.error) throw new Error(empRes.error.message || 'تعذر تحميل الموظفين');
      if (appRes.error) throw new Error(appRes.error.message || 'تعذر تحميل التطبيقات');
      if (empAppsRes.error) throw new Error(empAppsRes.error.message || 'تعذر تحميل ربط الموظفين بالتطبيقات');

      const employees = (empRes.data ?? []) as AttendanceBaseEmployee[];
      const apps = (appRes.data ?? []) as AttendanceBaseApp[];
      const employeeApps = (empAppsRes.data ?? []) as AttendanceEmployeeAppRow[];

      const map: Record<string, Set<string>> = {};
      for (const row of employeeApps) {
        if (!map[row.app_id]) map[row.app_id] = new Set();
        map[row.app_id].add(row.employee_id);
      }

      return { employees, apps, appEmployeeIds: map };
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useAttendanceDay(dateStr: string, enabled: boolean) {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const authEnabled = !!session && !!user && !authLoading;
  return useQuery({
    queryKey: ['attendance', uid, 'day', dateStr] as const,
    enabled: authEnabled && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance').select('*').eq('date', dateStr);
      if (error) throw new Error(error.message || 'تعذر تحميل حضور اليوم');
      return (data ?? []) as AttendanceDayRow[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

