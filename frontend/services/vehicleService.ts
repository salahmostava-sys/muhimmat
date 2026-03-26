import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

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
    throwIfError(error, 'vehicleService.getAll');
    return { data, error: null };
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

    throwIfError(vehiclesRes.error, 'vehicleService.getAllWithCurrentRider.vehicles');
    throwIfError(assignmentsRes.error, 'vehicleService.getAllWithCurrentRider.assignments');
    return { data, error: null };
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();
    throwIfError(error, 'vehicleService.getById');
    return { data, error: null };
  },

  create: async (payload: VehiclePayload) => {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    throwIfError(error, 'vehicleService.create');
    return { data, error: null };
  },

  update: async (id: string, payload: Partial<VehiclePayload>) => {
    const { data, error } = await supabase
      .from('vehicles')
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error, 'vehicleService.update');
    return { data, error: null };
  },

  upsert: async (payload: Partial<VehiclePayload> & { plate_number: string }) => {
    const { data, error } = await supabase
      .from('vehicles')
      .upsert(payload as Record<string, unknown>, { onConflict: 'plate_number' })
      .select()
      .single();
    throwIfError(error, 'vehicleService.upsert');
    return { data, error: null };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    throwIfError(error, 'vehicleService.delete');
    return { error: null };
  },

  getActiveCount: async () => {
    const { count, error } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    throwIfError(error, 'vehicleService.getActiveCount');
    return { count: count ?? 0, error: null };
  },

  getMaintenanceLogs: async () => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*, vehicles(id, plate_number, brand)')
      .order('date', { ascending: false });
    throwIfError(error, 'vehicleService.getMaintenanceLogs');
    return { data, error: null };
  },

  createMaintenanceLog: async (payload: MaintenanceLogPayload) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    throwIfError(error, 'vehicleService.createMaintenanceLog');
    return { data, error: null };
  },

  updateMaintenanceLog: async (id: string, payload: Partial<MaintenanceLogPayload>) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error, 'vehicleService.updateMaintenanceLog');
    return { data, error: null };
  },

  deleteMaintenanceLog: async (id: string) => {
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    throwIfError(error, 'vehicleService.deleteMaintenanceLog');
    return { error: null };
  },

  getAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, brand), employees(name)')
      .order('start_date', { ascending: false });
    throwIfError(error, 'vehicleService.getAssignments');
    return { data, error: null };
  },

  getAssignmentsWithRelations: async (limit = 200) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, type), employees(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfError(error, 'vehicleService.getAssignmentsWithRelations');
    return { data, error: null };
  },

  getActiveAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .is('returned_at', null);
    throwIfError(error, 'vehicleService.getActiveAssignments');
    return { data, error: null };
  },

  getActiveEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'vehicleService.getActiveEmployees');
    return { data, error: null };
  },

  createAssignment: async (payload: VehicleAssignmentPayload) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .insert(payload)
      .select()
      .single();
    throwIfError(error, 'vehicleService.createAssignment');
    return { data, error: null };
  },

  updateAssignment: async (id: string, payload: Partial<VehicleAssignmentPayload>) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    throwIfError(error, 'vehicleService.updateAssignment');
    return { data, error: null };
  },

  closeActiveAssignment: async (vehicleId: string, endDate: string) => {
    const { error } = await supabase
      .from('vehicle_assignments')
      .update({ end_date: endDate })
      .eq('vehicle_id', vehicleId)
      .is('end_date', null);
    throwIfError(error, 'vehicleService.closeActiveAssignment');
    return { error: null };
  },

  getForSelect: async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate_number, brand')
      .order('plate_number');
    throwIfError(error, 'vehicleService.getForSelect');
    return { data, error: null };
  },
};
