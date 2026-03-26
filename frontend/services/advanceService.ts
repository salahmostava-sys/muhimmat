import { supabase } from '@services/supabase/client';

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

const throwIfSupabaseError = (error: unknown) => {
  if (!error) return;
  console.error(error);
  throw error;
};

export const advanceService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('*, employees(name, national_id), advance_installments(*)')
      .order('created_at', { ascending: false });
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  create: async (payload: AdvancePayload) => {
    const { data, error } = await supabase
      .from('advances')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  insertMany: async (rows: AdvancePayload[]) => {
    const { error } = await supabase
      .from('advances')
      .insert(rows as unknown[]);
    throwIfSupabaseError(error);
    return { error: null };
  },

  update: async (id: string, payload: Partial<AdvancePayload>) => {
    const { error } = await supabase
      .from('advances')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status } as Record<string, unknown>)
      .eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  delete: async (id: string) => {
    const { error: installmentsError } = await supabase.from('advance_installments').delete().eq('advance_id', id);
    throwIfSupabaseError(installmentsError);
    const { error } = await supabase.from('advances').delete().eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  deleteMany: async (ids: string[]) => {
    const { error: installmentsError } = await supabase.from('advance_installments').delete().in('advance_id', ids);
    throwIfSupabaseError(installmentsError);
    const { error } = await supabase.from('advances').delete().in('id', ids);
    throwIfSupabaseError(error);
    return { error: null };
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
    throwIfSupabaseError(error);
    return { error: null };
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
    throwIfSupabaseError(error);
    return { error: null };
  },

  getInstallments: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('*')
      .eq('advance_id', advanceId)
      .order('month_year');
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  createInstallments: async (installments: Record<string, unknown>[]) => {
    const { error } = await supabase.from('advance_installments').insert(installments as unknown[]);
    throwIfSupabaseError(error);
    return { error: null };
  },

  updateInstallment: async (id: string, payload: InstallmentUpdate) => {
    const { error } = await supabase
      .from('advance_installments')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  updateInstallmentNote: async (id: string, notes: string | null) => {
    const { error } = await supabase
      .from('advance_installments')
      .update({ notes })
      .eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  deleteInstallment: async (id: string) => {
    const { error } = await supabase.from('advance_installments').delete().eq('id', id);
    throwIfSupabaseError(error);
    return { error: null };
  },

  deletePendingInstallments: async (advanceId: string) => {
    const { error } = await supabase
      .from('advance_installments')
      .delete()
      .eq('advance_id', advanceId)
      .eq('status', 'pending');
    throwIfSupabaseError(error);
    return { error: null };
  },

  markInstallmentsDeducted: async (installmentIds: string[], deductedAtIso: string) => {
    const payload: MarkInstallmentDeductedPayload = { status: 'deducted', deducted_at: deductedAtIso };
    const { error } = await supabase
      .from('advance_installments')
      .update(payload)
      .in('id', installmentIds);
    throwIfSupabaseError(error);
    return { error: null };
  },

  getInstallmentsByIds: async (installmentIds: string[]) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, status')
      .in('id', installmentIds);
    throwIfSupabaseError(error);
    return { data: data || [], error: null };
  },

  getAdvanceInstallmentStatuses: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('status')
      .eq('advance_id', advanceId);
    throwIfSupabaseError(error);
    return { data: data || [], error: null };
  },

  markAdvanceCompleted: async (advanceId: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status: 'completed' })
      .eq('id', advanceId);
    throwIfSupabaseError(error);
    return { error: null };
  },

  getMonthInstallmentsForAdvances: async (selectedMonth: string, advanceIds: string[]) => {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('id, advance_id, amount, status')
      .eq('month_year', selectedMonth)
      .in('advance_id', advanceIds);
    throwIfSupabaseError(error);
    return { data: data || [], error: null };
  },

  getPendingInstallmentsForAdvances: async (advanceIds: string[]) => {
    if (!advanceIds.length) return { data: [], error: null };
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, status')
      .in('status', ['pending', 'deferred'])
      .in('advance_id', advanceIds);
    throwIfSupabaseError(error);
    return { data: data || [], error: null };
  },

  getActiveByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, amount, status')
      .eq('employee_id', employeeId)
      .eq('status', 'active');
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getActiveAndPausedForSalaryContext: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, employee_id, status, amount, monthly_amount')
      .in('status', ['active', 'paused']);
    throwIfSupabaseError(error);
    return { data, error: null };
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    throwIfSupabaseError(error);
    return { data, error: null };
  },
};
