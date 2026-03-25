import { supabase } from '@/integrations/supabase/client';

export interface AdvancePayload {
  employee_id: string;
  amount: number;
  monthly_amount: number;
  total_installments: number;
  disbursement_date: string;
  first_deduction_month: string;
  note?: string | null;
  status?: string;
}

export interface InstallmentUpdate {
  status?: string;
  paid_date?: string | null;
  notes?: string | null;
}

export interface MarkInstallmentDeductedPayload {
  status: 'deducted';
  deducted_at: string;
}

export const advanceService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('*, employees(name, national_id), advance_installments(*)')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return { data, error };
  },

  create: async (payload: AdvancePayload) => {
    const { data, error } = await supabase
      .from('advances')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as unknown as any)
      .select()
      .single();
    return { data, error };
  },

  insertMany: async (rows: AdvancePayload[]) => {
    const { error } = await supabase
      .from('advances')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as unknown as any);
    return { error };
  },

  update: async (id: string, payload: Partial<AdvancePayload>) => {
    const { error } = await supabase
      .from('advances')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    return { error };
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status } as Record<string, unknown>)
      .eq('id', id);
    return { error };
  },

  delete: async (id: string) => {
    await supabase.from('advance_installments').delete().eq('advance_id', id);
    const { error } = await supabase.from('advances').delete().eq('id', id);
    return { error };
  },

  deleteMany: async (ids: string[]) => {
    await supabase.from('advance_installments').delete().in('advance_id', ids);
    const { error } = await supabase.from('advances').delete().in('id', ids);
    return { error };
  },

  writeOffMany: async (ids: string[], reason: string) => {
    const { error } = await supabase
      .from('advances')
      .update({
        is_written_off: true,
        written_off_at: new Date().toISOString(),
        written_off_reason: reason,
      } as Record<string, unknown>)
      .in('id', ids);
    return { error };
  },

  restoreWrittenOffMany: async (ids: string[]) => {
    const { error } = await supabase
      .from('advances')
      .update({
        is_written_off: false,
        written_off_at: null,
        written_off_reason: null,
      } as Record<string, unknown>)
      .in('id', ids);
    return { error };
  },

  getInstallments: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('*')
      .eq('advance_id', advanceId)
      .order('month_year');
    return { data, error };
  },

  createInstallments: async (installments: Record<string, unknown>[]) => {
    const { error } = await supabase.from('advance_installments').insert(installments as unknown[]);
    return { error };
  },

  updateInstallment: async (id: string, payload: InstallmentUpdate) => {
    const { error } = await supabase
      .from('advance_installments')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    return { error };
  },

  updateInstallmentNote: async (id: string, notes: string | null) => {
    const { error } = await supabase
      .from('advance_installments')
      .update({ notes })
      .eq('id', id);
    return { error };
  },

  deleteInstallment: async (id: string) => {
    const { error } = await supabase.from('advance_installments').delete().eq('id', id);
    return { error };
  },

  deletePendingInstallments: async (advanceId: string) => {
    const { error } = await supabase
      .from('advance_installments')
      .delete()
      .eq('advance_id', advanceId)
      .eq('status', 'pending');
    return { error };
  },

  markInstallmentsDeducted: async (installmentIds: string[], deductedAtIso: string) => {
    const payload: MarkInstallmentDeductedPayload = { status: 'deducted', deducted_at: deductedAtIso };
    const { error } = await supabase
      .from('advance_installments')
      .update(payload)
      .in('id', installmentIds);
    return { error };
  },

  getInstallmentsByIds: async (installmentIds: string[]) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, status')
      .in('id', installmentIds);
    return { data: data || [], error };
  },

  getAdvanceInstallmentStatuses: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('status')
      .eq('advance_id', advanceId);
    return { data: data || [], error };
  },

  markAdvanceCompleted: async (advanceId: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status: 'completed' })
      .eq('id', advanceId);
    return { error };
  },

  getMonthInstallmentsForAdvances: async (selectedMonth: string, advanceIds: string[]) => {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('id, advance_id, amount, status')
      .eq('month_year', selectedMonth)
      .in('advance_id', advanceIds);
    return { data: data || [], error };
  },

  getPendingInstallmentsForAdvances: async (advanceIds: string[]) => {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, status')
      .in('status', ['pending', 'deferred'])
      .in('advance_id', advanceIds);
    return { data: data || [], error };
  },

  getActiveByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, amount, status')
      .eq('employee_id', employeeId)
      .eq('status', 'active');
    return { data, error };
  },

  getActiveAndPausedForSalaryContext: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, employee_id, status, amount, monthly_amount')
      .in('status', ['active', 'paused']);
    return { data, error };
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    return { data, error };
  },
};
