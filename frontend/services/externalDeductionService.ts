import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

export const externalDeductionService = {
  getApprovedByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('external_deductions')
      .select('employee_id, amount')
      .eq('apply_month', monthYear)
      .eq('approval_status', 'approved');
    throwIfError(error, 'externalDeductionService.getApprovedByMonth');
    return { data, error: null };
  },
};

export default externalDeductionService;
