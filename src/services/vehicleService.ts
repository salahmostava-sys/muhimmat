import { supabase } from '@/integrations/supabase/client';

export interface VehiclePayload {
  plate_number: string;
  plate_number_en?: string | null;
  type?: 'motorcycle' | 'car';
  brand?: string;
  model?: string;
  year?: number;
  status?: string;
  has_fuel_chip?: boolean;
  insurance_expiry?: string | null;
  registration_expiry?: string | null;
  authorization_expiry?: string | null;
  chassis_number?: string | null;
  serial_number?: string | null;
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
  start_at?: string | null;
  returned_at?: string | null;
  end_date?: string | null;
  reason?: string | null;
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

  getAllWithCurrentRider: async () => {
    const [vehiclesRes, assignmentsRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate_number').limit(1000),
      supabase
        .from('vehicle_assignments')
        .select('vehicle_id, employees(name)')
        .is('end_date', null)
        .is('returned_at', null),
    ]);

    const assignMap: Record<string, string> = {};
    (assignmentsRes.data || []).forEach((a: { vehicle_id?: string; employees?: { name?: string } | null }) => {
      if (a.vehicle_id && a.employees?.name) assignMap[a.vehicle_id] = a.employees.name;
    });

    const data = (vehiclesRes.data || []).map((v: { id: string }) => ({
      ...v,
      current_rider: assignMap[v.id] ?? null,
    }));

    return { data, error: vehiclesRes.error || assignmentsRes.error };
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as unknown as any)
      .select()
      .single();
    return { data, error };
  },

  update: async (id: string, payload: Partial<VehiclePayload>) => {
    const { data, error } = await supabase
      .from('vehicles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as unknown as any)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  upsert: async (payload: Partial<VehiclePayload> & { plate_number: string }) => {
    const { data, error } = await supabase
      .from('vehicles')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as unknown as any, { onConflict: 'plate_number' })
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
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    return { data, error };
  },

  updateMaintenanceLog: async (id: string, payload: Partial<MaintenanceLogPayload>) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .update(payload as Record<string, unknown>)
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

  getAssignmentsWithRelations: async (limit = 200) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, type), employees(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  getActiveAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .is('returned_at', null);
    return { data, error };
  },

  getActiveEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
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
