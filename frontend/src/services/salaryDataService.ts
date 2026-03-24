import { supabase } from '@/integrations/supabase/client';
import { attendanceService } from '@/services/attendanceService';

export const salaryDataService = {
  async calculateSalaryForEmployeeMonth(
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) {
    const { data, error } = await supabase.rpc('calculate_salary_for_employee_month', {
      p_employee_id: employeeId,
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
      p_manual_deduction: manualDeduction,
      p_manual_deduction_note: manualDeductionNote,
    } as any);
    return { data, error };
  },

  async calculateSalaryForMonth(monthYear: string, paymentMethod = 'cash') {
    const { data, error } = await supabase.rpc('calculate_salary_for_month', {
      p_month_year: monthYear,
      p_payment_method: paymentMethod,
    } as any);
    return { data, error };
  },

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
        attendanceService.getAttendanceByMonth(selectedMonth),
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
      attendanceRes: { data: attendanceRes.data || [], error: attendanceRes.error },
      fuelRes,
      savedRecords: savedRecordsRes.data || [],
      allAdvances: allAdvancesRes.data || [],
    };
  },

  async upsertSalaryRecord(record: Record<string, unknown>) {
    const { error } = await supabase
      .from('salary_records')
      .upsert(record, { onConflict: 'employee_id,month_year' });
    return { error };
  },

  async upsertSalaryRecords(records: Record<string, unknown>[]) {
    const { error } = await supabase
      .from('salary_records')
      .upsert(records, { onConflict: 'employee_id,month_year' });
    return { error };
  },

  async markInstallmentsDeducted(installmentIds: string[], deductedAtIso: string) {
    const { error } = await supabase
      .from('advance_installments')
      .update({ status: 'deducted', deducted_at: deductedAtIso })
      .in('id', installmentIds);
    return { error };
  },

  async getInstallmentsByIds(installmentIds: string[]) {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, status')
      .in('id', installmentIds);
    return { data: data || [], error };
  },

  async getAdvanceInstallmentStatuses(advanceId: string) {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('status')
      .eq('advance_id', advanceId);
    return { data: data || [], error };
  },

  async markAdvanceCompleted(advanceId: string) {
    const { error } = await supabase
      .from('advances')
      .update({ status: 'completed' })
      .eq('id', advanceId);
    return { error };
  },

  async getMonthInstallmentsForAdvances(selectedMonth: string, advanceIds: string[]) {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('id, advance_id, amount, status')
      .eq('month_year', selectedMonth)
      .in('advance_id', advanceIds);
    return { data: data || [], error };
  },

  async getPendingInstallmentsForAdvances(advanceIds: string[]) {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, status')
      .in('status', ['pending', 'deferred'])
      .in('advance_id', advanceIds);
    return { data: data || [], error };
  },
};

export default salaryDataService;
