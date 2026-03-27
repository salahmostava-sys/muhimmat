import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

export const employeeTierService = {
  getTiers: async () => {
    const { data, error } = await supabase.from('employee_tiers').select('*').order('created_at', { ascending: false });
    throwIfError(error, 'employeeTierService.getTiers');
    return data ?? [];
  },
  getEmployees: async () => {
    const { data, error } = await supabase.from('employees').select('id, name, sponsorship_status').order('name');
    throwIfError(error, 'employeeTierService.getEmployees');
    return data ?? [];
  },
  getActiveApps: async () => {
    const { data, error } = await supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name');
    throwIfError(error, 'employeeTierService.getActiveApps');
    return data ?? [];
  },
  updateTier: async (id: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('employee_tiers').update(payload).eq('id', id);
    throwIfError(error, 'employeeTierService.updateTier');
    return data ?? [];
  },
  createTier: async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.from('employee_tiers').insert(payload);
    throwIfError(error, 'employeeTierService.createTier');
    return data ?? [];
  },
  deleteTier: async (id: string) => {
    const { error } = await supabase.from('employee_tiers').delete().eq('id', id);
    throwIfError(error, 'employeeTierService.deleteTier');
  },
  getActiveAssignmentWithVehicleByEmployee: async (employeeId: string) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id, vehicles(plate_number)')
      .eq('employee_id', employeeId)
      .is('end_date', null)
      .limit(1);
    throwIfError(error, 'employeeTierService.getActiveAssignmentWithVehicleByEmployee');
    return data ?? [];
  },
};
