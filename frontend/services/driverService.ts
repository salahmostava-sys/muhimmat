import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';
import { employeeService } from '@services/employeeService';

export const driverService = {
  async update(id: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id);
    throwIfError(error, 'driverService.update');
  },

  /** يمر عبر التحقق من الطلبات/العمليات في `employeeService.deleteById`. */
  async delete(id: string) {
    await employeeService.deleteById(id);
  },
};

export default driverService;