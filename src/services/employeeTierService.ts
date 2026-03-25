import { supabase } from '@/integrations/supabase/client';

export const employeeTierService = {
  getTiers: async () => supabase.from('employee_tiers').select('*').order('created_at', { ascending: false }),
  getEmployees: async () => supabase.from('employees').select('id, name, sponsorship_status').order('name'),
  getActiveApps: async () =>
    supabase.from('apps').select('id, name, brand_color, text_color').eq('is_active', true).order('name'),
  updateTier: async (id: string, payload: Record<string, unknown>) =>
    supabase.from('employee_tiers').update(payload).eq('id', id),
  createTier: async (payload: Record<string, unknown>) => supabase.from('employee_tiers').insert(payload),
  deleteTier: async (id: string) => supabase.from('employee_tiers').delete().eq('id', id),
  getActiveAssignmentWithVehicleByEmployee: async (employeeId: string) =>
    supabase
      .from('vehicle_assignments')
      .select('vehicle_id, vehicles(plate_number)')
      .eq('employee_id', employeeId)
      .is('end_date', null)
      .limit(1),
};
