import { supabase } from '@/integrations/supabase/client';

export const violationService = {
  getViolations: async () =>
    supabase
      .from('external_deductions')
      .select('id, employee_id, amount, incident_date, apply_month, approval_status, note, linked_advance_id, employees(id, name, national_id)')
      .eq('type', 'fine')
      .order('created_at', { ascending: false })
      .limit(500),

  findVehiclesByPlateQuery: async (q: string) =>
    supabase
      .from('vehicles')
      .select('id, plate_number, plate_number_en, brand, type')
      .or(`plate_number.ilike.%${q}%,plate_number_en.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(8),

  findVehicleIdsByPlate: async (plate: string) =>
    supabase.from('vehicles').select('id').ilike('plate_number', `%${plate}%`).limit(5),

  getAssignmentsByVehicleIds: async (vehicleIds: string[]) =>
    supabase
      .from('vehicle_assignments')
      .select('id, vehicle_id, employee_id, start_date, start_at, returned_at, end_date, employees(id, name, national_id), vehicles(plate_number, brand, type)')
      .in('vehicle_id', vehicleIds)
      .order('start_at', { ascending: false }),

  getExistingFineDeductions: async (employeeIds: string[], incidentDate: string, applyMonth: string) =>
    supabase
      .from('external_deductions')
      .select('id, employee_id, amount')
      .eq('type', 'fine')
      .in('employee_id', employeeIds)
      .eq('incident_date', incidentDate)
      .eq('apply_month', applyMonth),

  createFineDeduction: async (payload: Record<string, unknown>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('external_deductions').insert(payload as unknown as any).select('id').single(),

  updateViolation: async (id: string, payload: Record<string, unknown>) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.from('external_deductions').update(payload as unknown as any).eq('id', id),

  deleteViolation: async (id: string) =>
    supabase.from('external_deductions').delete().eq('id', id),

  findMatchingAdvanceForFine: async (employeeId: string, applyMonth: string, amountMin: number, amountMax: number) =>
    supabase
      .from('advances')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .eq('first_deduction_month', applyMonth)
      .gte('monthly_amount', amountMin)
      .lte('monthly_amount', amountMax)
      .limit(1),

  createAdvanceFromFine: async (payload: Record<string, unknown>) =>
    supabase.from('advances').insert(payload).select('id').single(),

  createSingleInstallment: async (payload: Record<string, unknown>) =>
    supabase.from('advance_installments').insert(payload),
};
