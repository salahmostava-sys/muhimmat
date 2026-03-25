import { supabase } from '@/integrations/supabase/client';

export const attendanceService = {
  getAttendanceStatusRange: async (from: string, to: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('date, status')
      .gte('date', from)
      .lte('date', to);
    return { data, error };
  },

  getActiveEmployeesCount: async () => {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    return { count: count || 0, error };
  },

  upsertDailyAttendance: async (payload: {
    employee_id: string;
    date: string;
    status: 'present' | 'absent' | 'leave' | 'sick' | 'late';
    check_in: string | null;
    check_out: string | null;
    note: string | null;
  }) => {
    const { error } = await supabase.from('attendance').upsert([payload], {
      onConflict: 'employee_id,date',
    });
    return { error };
  },

  getMonthlyEmployeesAndAttendance: async (startDate: string, endDate: string) => {
    const [employeesRes, attendanceRes] = await Promise.all([
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
    return { employeesRes, attendanceRes };
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

    return { data, error };
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

    return { data, error };
  },
};

export default attendanceService;
