import { supabase } from '@/integrations/supabase/client';

export const employeeService = {
  async getAll() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });
    return { data, error };
  },
};

export default employeeService;
