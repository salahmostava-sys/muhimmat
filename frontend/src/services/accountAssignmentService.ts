import { supabase } from '@/integrations/supabase/client';

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
  getActiveAssignments: async () =>
    supabase.from('account_assignments').select('*').is('end_date', null),

  /** كل التعيينات المسجّلة على شهر محدد (لإحصاء مناديب متعددين على نفس الحساب) */
  getAssignmentsForMonthYear: async (monthYear: string) =>
    supabase
      .from('account_assignments')
      .select('account_id, employee_id, month_year, start_date, end_date')
      .eq('month_year', monthYear),

  getHistoryByAccountId: async (accountId: string) =>
    supabase.from('account_assignments').select('*').eq('account_id', accountId).order('start_date', { ascending: false }),

  getOpenAssignmentIdsByAccount: async (accountId: string) =>
    supabase.from('account_assignments').select('id').eq('account_id', accountId).is('end_date', null),

  closeAssignmentsByIds: async (ids: string[], endDate: string) =>
    supabase.from('account_assignments').update({ end_date: endDate }).in('id', ids),

  createAssignment: async (payload: AccountAssignmentInsertPayload) =>
    supabase.from('account_assignments').insert(payload),
};