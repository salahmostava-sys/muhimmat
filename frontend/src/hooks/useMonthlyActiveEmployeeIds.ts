import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';

export type MonthlyActiveEmployeeIdsResult = {
  monthKey: string; // YYYY-MM
  employeeIds: Set<string>;
};

function toMonthKey(d: Date): string {
  return format(d, 'yyyy-MM');
}

function monthStartEnd(monthKey: string): { start: string; end: string } {
  const [yStr, mStr] = monthKey.split('-');
  const year = Number(yStr);
  const monthIndex0 = Number(mStr) - 1;
  const start = format(new Date(year, monthIndex0, 1), 'yyyy-MM-dd');
  const end = format(new Date(year, monthIndex0 + 1, 0), 'yyyy-MM-dd');
  return { start, end };
}

export function useMonthlyActiveEmployeeIds(monthKey?: string) {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const mk = monthKey ?? toMonthKey(new Date());
  const { start, end } = monthStartEnd(mk);

  const q = useQuery({
    queryKey: ['employees', uid, 'active-ids', mk] as const,
    queryFn: async (): Promise<MonthlyActiveEmployeeIdsResult> => {
      const [ordersRes, attendanceRes, salariesRes] = await Promise.all([
        supabase
          .from('daily_orders')
          .select('employee_id')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('attendance')
          .select('employee_id')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('salary_records')
          .select('employee_id')
          .eq('month_year', mk),
      ]);

      if (ordersRes.error) throw new Error(ordersRes.error.message || 'تعذر تحميل نشاط الطلبات');
      if (attendanceRes.error) throw new Error(attendanceRes.error.message || 'تعذر تحميل نشاط الحضور');
      if (salariesRes.error) throw new Error(salariesRes.error.message || 'تعذر تحميل نشاط الرواتب');

      const ids = new Set<string>();
      (ordersRes.data ?? []).forEach((r) => { if (r.employee_id) ids.add(r.employee_id); });
      (attendanceRes.data ?? []).forEach((r) => { if (r.employee_id) ids.add(r.employee_id); });
      (salariesRes.data ?? []).forEach((r) => { if (r.employee_id) ids.add(r.employee_id); });

      return { monthKey: mk, employeeIds: ids };
    },
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
}

