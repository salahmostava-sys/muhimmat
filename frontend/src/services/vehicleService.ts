import { supabase } from '@/integrations/supabase/client';

export interface VehiclePayload {
  plate_number: string;
  brand?: string;
  model?: string;
  year?: number;
  status?: string;
  assigned_employee_id?: string | null;
  notes?: string;
}

export interface MaintenanceLogPayload {
  vehicle_id: string;
  date: string;
  type: string;
  description?: string;
  cost?: number;
  notes?: string;
}

export interface VehicleAssignmentPayload {
  vehicle_id: string;
  employee_id: string;
  start_date: string;
  end_date?: string | null;
  notes?: string;
}

export const vehicleService = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('plate_number');
    return { data, error };
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  create: async (payload: VehiclePayload) => {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload as any)
      .select()
      .single();
    return { data, error };
  },

  update: async (id: string, payload: Partial<VehiclePayload>) => {
    const { data, error } = await supabase
      .from('vehicles')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  upsert: async (payload: Partial<VehiclePayload> & { plate_number: string }) => {
    const { data, error } = await supabase
      .from('vehicles')
      .upsert(payload as any, { onConflict: 'plate_number' })
      .select()
      .single();
    return { data, error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    return { error };
  },

  getActiveCount: async () => {
    const { count, error } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    return { count: count ?? 0, error };
  },

  getMaintenanceLogs: async () => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*, vehicles(id, plate_number, brand)')
      .order('date', { ascending: false });
    return { data, error };
  },

  createMaintenanceLog: async (payload: MaintenanceLogPayload) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert(payload as any)
      .select()
      .single();
    return { data, error };
  },

  updateMaintenanceLog: async (id: string, payload: Partial<MaintenanceLogPayload>) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  deleteMaintenanceLog: async (id: string) => {
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    return { error };
  },

  getAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, brand), employees(name)')
      .order('start_date', { ascending: false });
    return { data, error };
  },

  createAssignment: async (payload: VehicleAssignmentPayload) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .insert(payload)
      .select()
      .single();
    return { data, error };
  },

  updateAssignment: async (id: string, payload: Partial<VehicleAssignmentPayload>) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  closeActiveAssignment: async (vehicleId: string, endDate: string) => {
    const { error } = await supabase
      .from('vehicle_assignments')
      .update({ end_date: endDate })
      .eq('vehicle_id', vehicleId)
      .is('end_date', null);
    return { error };
  },

  getForSelect: async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate_number, brand')
      .order('plate_number');
    return { data, error };
  },
};
