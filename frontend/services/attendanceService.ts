import { supabase } from '@services/supabase/client';

const throwIfSupabaseError = (error: unknown) => {
  if (!error) return;
  console.error(error);
  throw error;
};

export const attendanceService = {
  checkIn: async (employeeId: string, checkinAt?: string) => {
    const { data, error } = await supabase.rpc('check_in', {
      p_employee_id: employeeId,
      p_checkin_at: checkinAt ?? new Date().toISOString(),
    });
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  checkOut: async (employeeId: string, checkoutAt?: string) => {
    const { data, error } = await supabase.rpc('check_out', {
      p_employee_id: employeeId,
      p_checkout_at: checkoutAt ?? new Date().toISOString(),
    });
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getAttendanceStatusRange: async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .gte('date', from)
      .lte('date', to);
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getActiveEmployeesCount: async () => {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    throwIfSupabaseError(error);
    return { count: count || 0, error: null };
  },

  upsertDailyAttendance: async (payload: {
    employee_id: string;
    date: string;
    status: 'present' | 'absent' | 'leave' | 'sick' | 'late';
    check_in: string | null;
    check_out: string | null;
    note: string | null;
  }) => {
    // Keep compatibility with existing grid editor flow.
    // For explicit check-in/out actions, prefer attendanceService.checkIn/checkOut RPCs.
    const { error } = await supabase.from('attendance').upsert([payload], {
      onConflict: 'employee_id,date',
    });
    throwIfSupabaseError(error);
    return { error: null };
  },

  getMonthlyEmployeesAndAttendance: async (startDate: string, endDate: string) => {
    const [employeesRes, attendanceRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, national_id, salary_type, base_salary, sponsorship_status')
        .eq('status', 'active')
        .order('name'),
      supabase
        .from('attendance')
        .select('employee_id, status')
        .gte('date', startDate)
        .lte('date', endDate),
    ]);
    throwIfSupabaseError(employeesRes.error);
    throwIfSupabaseError(attendanceRes.error);
    return {
      employeesRes: { ...employeesRes, error: null },
      attendanceRes: { ...attendanceRes, error: null },
    };
  },

  getAttendanceByMonth: async (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .gte('date', from)
      .lte('date', to)
      .in('status', ['present', 'late']);

    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getAttendanceByEmployeeMonth: async (employeeId: string, monthYear: string) => {
    const [year, month] = monthYear.split('-');
    const from = `${year}-${month}-01`;
    const to = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    throwIfSupabaseError(error);
    return { data, error: null };
  },
};

export default attendanceService;
