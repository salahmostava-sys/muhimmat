import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';

/** أقصى عدد صفوف يُجلب لقوائم المركبات وسجلات التوزيع (يتوافق مع حد PostgREST الافتراضي). */
export const VEHICLES_QUERY_MAX_ROWS = 1000;

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
      .order('plate_number')
      .limit(VEHICLES_QUERY_MAX_ROWS);
    if (error) handleSupabaseError(error, 'vehicleService.getAll');
    return data ?? [];
  },

  getAllWithCurrentRider: async () => {
    const [vehiclesRes, assignmentsRes] = await Promise.all([
      supabase.from('vehicles').select('*').order('plate_number').limit(VEHICLES_QUERY_MAX_ROWS),
      supabase
        .from('vehicle_assignments')
        .select('vehicle_id, employees(name)')
        .is('end_date', null)
        .is('returned_at', null),
    ]);

    if (vehiclesRes.error) handleSupabaseError(vehiclesRes.error, 'vehicleService.getAllWithCurrentRider.vehicles');
    if (assignmentsRes.error) handleSupabaseError(assignmentsRes.error, 'vehicleService.getAllWithCurrentRider.assignments');

    const assignMap: Record<string, string> = {};
    (assignmentsRes.data || []).forEach((a: { vehicle_id?: string; employees?: { name?: string } | null }) => {
      if (a.vehicle_id && a.employees?.name) assignMap[a.vehicle_id] = a.employees.name;
    });

    return (vehiclesRes.data || []).map((v: { id: string }) => ({
      ...v,
      current_rider: assignMap[v.id] ?? null,
    }));
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.getById');
    return data;
  },

  create: async (payload: VehiclePayload) => {
    const { data, error } = await supabase
      .from('vehicles')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.create');
    return data;
  },

  update: async (id: string, payload: Partial<VehiclePayload>) => {
    const { data, error } = await supabase
      .from('vehicles')
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.update');
    return data;
  },

  upsert: async (payload: Partial<VehiclePayload> & { plate_number: string }) => {
    const { data, error } = await supabase
      .from('vehicles')
      .upsert(payload as Record<string, unknown>, { onConflict: 'plate_number' })
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.upsert');
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'vehicleService.delete');
  },

  getActiveCount: async () => {
    const { count, error } = await supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'vehicleService.getActiveCount');
    return count ?? 0;
  },

  getMaintenanceLogs: async () => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .select('*, vehicles(id, plate_number, brand)')
      .order('date', { ascending: false });
    if (error) handleSupabaseError(error, 'vehicleService.getMaintenanceLogs');
    return data ?? [];
  },

  createMaintenanceLog: async (payload: MaintenanceLogPayload) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .insert(payload as Record<string, unknown>)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.createMaintenanceLog');
    return data;
  },

  updateMaintenanceLog: async (id: string, payload: Partial<MaintenanceLogPayload>) => {
    const { data, error } = await supabase
      .from('maintenance_logs')
      .update(payload as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.updateMaintenanceLog');
    return data;
  },

  deleteMaintenanceLog: async (id: string) => {
    const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
    if (error) handleSupabaseError(error, 'vehicleService.deleteMaintenanceLog');
  },

  getAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, brand), employees(name)')
      .order('start_date', { ascending: false });
    if (error) handleSupabaseError(error, 'vehicleService.getAssignments');
    return data ?? [];
  },

  getAssignmentsWithRelations: async (limit = VEHICLES_QUERY_MAX_ROWS) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('*, vehicles(plate_number, type), employees(name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) handleSupabaseError(error, 'vehicleService.getAssignmentsWithRelations');
    return data ?? [];
  },

  getActiveAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('vehicle_id')
      .is('returned_at', null);
    if (error) handleSupabaseError(error, 'vehicleService.getActiveAssignments');
    return data ?? [];
  },

  getActiveEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (error) handleSupabaseError(error, 'vehicleService.getActiveEmployees');
    return data ?? [];
  },

  createAssignment: async (payload: VehicleAssignmentPayload) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .insert(payload)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.createAssignment');
    return data;
  },

  updateAssignment: async (id: string, payload: Partial<VehicleAssignmentPayload>) => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) handleSupabaseError(error, 'vehicleService.updateAssignment');
    return data;
  },

  closeActiveAssignment: async (vehicleId: string, endDate: string) => {
    const { error } = await supabase
      .from('vehicle_assignments')
      .update({ end_date: endDate })
      .eq('vehicle_id', vehicleId)
      .is('end_date', null);
    if (error) handleSupabaseError(error, 'vehicleService.closeActiveAssignment');
  },

  getForSelect: async () => {
    const { data, error } = await supabase
      .from('vehicles')
      .select('id, plate_number, brand')
      .order('plate_number')
      .limit(VEHICLES_QUERY_MAX_ROWS);
    if (error) handleSupabaseError(error, 'vehicleService.getForSelect');
    return data ?? [];
  },
};
