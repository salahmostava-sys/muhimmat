import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

export const driverService = {
  async update(id: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id);
    throwIfError(error, 'driverService.update');
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);
    throwIfError(error, 'driverService.delete');
  },
};

export default driverService;