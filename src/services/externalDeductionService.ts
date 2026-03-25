import { supabase } from '@/integrations/supabase/client';

export const externalDeductionService = {
  getApprovedByMonth: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('external_deductions')
      .select('employee_id, amount')
      .eq('apply_month', monthYear)
      .eq('approval_status', 'approved');
    return { data, error };
  },
};

export default externalDeductionService;
