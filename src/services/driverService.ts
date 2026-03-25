import { supabase } from '@/integrations/supabase/client';

export const driverService = {
  async update(id: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id);
    return { error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    return { error };
  },
};

export default driverService;