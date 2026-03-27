import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';

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
    if (error) handleSupabaseError(error, 'advanceService.getAll');
    return data ?? [];
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) handleSupabaseError(error, 'advanceService.getById');
    return data;
  },

  create: async (payload: AdvancePayload) => {
    const { data, error } = await supabase
      .from('advances')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'advanceService.create');
    return data;
  },

  insertMany: async (rows: AdvancePayload[]) => {
    const { error } = await supabase
      .from('advances')
      .insert(rows as unknown[]);
    if (error) handleSupabaseError(error, 'advanceService.insertMany');
  },

  update: async (id: string, payload: Partial<AdvancePayload>) => {
    const { error } = await supabase
      .from('advances')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.update');
  },

  updateStatus: async (id: string, status: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status } as Record<string, unknown>)
      .eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.updateStatus');
  },

  delete: async (id: string) => {
    const { error: installmentsError } = await supabase.from('advance_installments').delete().eq('advance_id', id);
    if (installmentsError) handleSupabaseError(installmentsError, 'advanceService.delete.installments');
    const { error } = await supabase.from('advances').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.delete');
  },

  deleteMany: async (ids: string[]) => {
    const { error: installmentsError } = await supabase.from('advance_installments').delete().in('advance_id', ids);
    if (installmentsError) handleSupabaseError(installmentsError, 'advanceService.deleteMany.installments');
    const { error } = await supabase.from('advances').delete().in('id', ids);
    if (error) handleSupabaseError(error, 'advanceService.deleteMany');
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
    if (error) handleSupabaseError(error, 'advanceService.writeOffMany');
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
    if (error) handleSupabaseError(error, 'advanceService.restoreWrittenOffMany');
  },

  getInstallments: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('*')
      .eq('advance_id', advanceId)
      .order('month_year');
    if (error) handleSupabaseError(error, 'advanceService.getInstallments');
    return data ?? [];
  },

  createInstallments: async (installments: Record<string, unknown>[]) => {
    const { error } = await supabase.from('advance_installments').insert(installments as unknown[]);
    if (error) handleSupabaseError(error, 'advanceService.createInstallments');
  },

  updateInstallment: async (id: string, payload: InstallmentUpdate) => {
    const { error } = await supabase
      .from('advance_installments')
      .update(payload as Record<string, unknown>)
      .eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.updateInstallment');
  },

  updateInstallmentNote: async (id: string, notes: string | null) => {
    const { error } = await supabase
      .from('advance_installments')
      .update({ notes })
      .eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.updateInstallmentNote');
  },

  deleteInstallment: async (id: string) => {
    const { error } = await supabase.from('advance_installments').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'advanceService.deleteInstallment');
  },

  deletePendingInstallments: async (advanceId: string) => {
    const { error } = await supabase
      .from('advance_installments')
      .delete()
      .eq('advance_id', advanceId)
      .eq('status', 'pending');
    if (error) handleSupabaseError(error, 'advanceService.deletePendingInstallments');
  },

  markInstallmentsDeducted: async (installmentIds: string[], deductedAtIso: string) => {
    const payload: MarkInstallmentDeductedPayload = { status: 'deducted', deducted_at: deductedAtIso };
    const { error } = await supabase
      .from('advance_installments')
      .update(payload)
      .in('id', installmentIds);
    if (error) handleSupabaseError(error, 'advanceService.markInstallmentsDeducted');
  },

  getInstallmentsByIds: async (installmentIds: string[]) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, status')
      .in('id', installmentIds);
    if (error) handleSupabaseError(error, 'advanceService.getInstallmentsByIds');
    return data ?? [];
  },

  getAdvanceInstallmentStatuses: async (advanceId: string) => {
    const { data, error } = await supabase
      .from('advance_installments')
      .select('status')
      .eq('advance_id', advanceId);
    if (error) handleSupabaseError(error, 'advanceService.getAdvanceInstallmentStatuses');
    return data ?? [];
  },

  markAdvanceCompleted: async (advanceId: string) => {
    const { error } = await supabase
      .from('advances')
      .update({ status: 'completed' })
      .eq('id', advanceId);
    if (error) handleSupabaseError(error, 'advanceService.markAdvanceCompleted');
  },

  getMonthInstallmentsForAdvances: async (selectedMonth: string, advanceIds: string[]) => {
    if (!advanceIds.length) return [];
    const { data, error } = await supabase
      .from('advance_installments')
      .select('id, advance_id, amount, status')
      .eq('month_year', selectedMonth)
      .in('advance_id', advanceIds);
    if (error) handleSupabaseError(error, 'advanceService.getMonthInstallmentsForAdvances');
    return data ?? [];
  },

  getPendingInstallmentsForAdvances: async (advanceIds: string[]) => {
    if (!advanceIds.length) return [];
    const { data, error } = await supabase
      .from('advance_installments')
      .select('advance_id, amount, status')
      .in('status', ['pending', 'deferred'])
      .in('advance_id', advanceIds);
    if (error) handleSupabaseError(error, 'advanceService.getPendingInstallmentsForAdvances');
    return data ?? [];
  },

  getActiveByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, amount, status')
      .eq('employee_id', employeeId)
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'advanceService.getActiveByEmployee');
    return data ?? [];
  },

  getActiveAndPausedForSalaryContext: async () => {
    const { data, error } = await supabase
      .from('advances')
      .select('id, employee_id, status, amount, monthly_amount')
      .in('status', ['active', 'paused']);
    if (error) handleSupabaseError(error, 'advanceService.getActiveAndPausedForSalaryContext');
    return data ?? [];
  },

  getEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, national_id, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    if (error) handleSupabaseError(error, 'advanceService.getEmployees');
    return data ?? [];
  },
};
