import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

export interface AccountAssignment {
  id: string;
  account_id: string;
  employee_id: string;
  start_date: string;
  end_date: string | null;
  month_year: string;
  notes: string | null;
  created_at: string;
}

interface AccountAssignmentInsertPayload {
  account_id: string;
  employee_id: string;
  start_date: string;
  end_date: null;
  month_year: string;
  notes: string | null;
  created_by: string | null;
}

export const accountAssignmentService = {
  getActiveAssignments: async () => {
    const { data, error } = await supabase.from('account_assignments').select('*').is('end_date', null);
    throwIfError(error, 'accountAssignmentService.getActiveAssignments');
    return data ?? [];
  },

  /** كل التعيينات المسجّلة على شهر محدد (لإحصاء مناديب متعددين على نفس الحساب) */
  getAssignmentsForMonthYear: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('account_assignments')
      .select('account_id, employee_id, month_year, start_date, end_date')
      .eq('month_year', monthYear);
    throwIfError(error, 'accountAssignmentService.getAssignmentsForMonthYear');
    return data ?? [];
  },

  getHistoryByAccountId: async (accountId: string) => {
    const { data, error } = await supabase.from('account_assignments').select('*').eq('account_id', accountId).order('start_date', { ascending: false });
    throwIfError(error, 'accountAssignmentService.getHistoryByAccountId');
    return data ?? [];
  },

  getOpenAssignmentIdsByAccount: async (accountId: string) => {
    const { data, error } = await supabase.from('account_assignments').select('id').eq('account_id', accountId).is('end_date', null);
    throwIfError(error, 'accountAssignmentService.getOpenAssignmentIdsByAccount');
    return data ?? [];
  },

  closeAssignmentsByIds: async (ids: string[], endDate: string) => {
    const { data, error } = await supabase.from('account_assignments').update({ end_date: endDate }).in('id', ids);
    throwIfError(error, 'accountAssignmentService.closeAssignmentsByIds');
    return data ?? [];
  },

  createAssignment: async (payload: AccountAssignmentInsertPayload) => {
    const { data, error } = await supabase.from('account_assignments').insert(payload);
    throwIfError(error, 'accountAssignmentService.createAssignment');
    return data ?? [];
  },
};