import { supabase } from '@/integrations/supabase/client';

export const salaryDataService = {
  async getMonthlyContext(selectedMonth: string) {
    const [y, m] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    const startDate = `${selectedMonth}-01`;
    const endDate = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;

    const [empRes, extRes, ordersRes, appsWithSchemeRes, attendanceRes, fuelRes, savedRecordsRes, allAdvancesRes] =
      await Promise.all([
        supabase
          .from('employees')
          .select('id, name, job_title, national_id, salary_type, base_salary, iban, city, preferred_language, phone')
          .eq('status', 'active')
          .order('name'),
        supabase
          .from('external_deductions')
          .select('employee_id, amount')
          .eq('apply_month', selectedMonth)
          .eq('approval_status', 'approved'),
        supabase
          .from('daily_orders')
          .select('employee_id, app_id, orders_count, apps(name, id)')
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('apps')
          .select('id, name, scheme_id, salary_schemes(id, name, name_en, status, scheme_type, monthly_amount, target_orders, target_bonus, salary_scheme_tiers(id, from_orders, to_orders, price_per_order, tier_order, tier_type, incremental_threshold, incremental_price))')
          .eq('is_active', true),
        supabase
          .from('attendance')
          .select('employee_id, status')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('status', ['present', 'late']),
        supabase
          .from('vehicle_mileage')
          .select('employee_id, fuel_cost')
          .eq('month_year', selectedMonth),
        supabase
          .from('salary_records')
          .select('employee_id, is_approved, advance_deduction, net_salary, manual_deduction, attendance_deduction, external_deduction')
          .eq('month_year', selectedMonth),
        supabase
          .from('advances')
          .select('id, employee_id, status, amount, monthly_amount')
          .in('status', ['active', 'paused']),
      ]);

    return {
      empRes,
      extRes,
      ordersRes,
      appsWithSchemeRes,
      attendanceRes,
      fuelRes,
      savedRecords: savedRecordsRes.data || [],
      allAdvances: allAdvancesRes.data || [],
    };
  },
};

export default salaryDataService;
