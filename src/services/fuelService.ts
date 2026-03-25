import { supabase } from '@/integrations/supabase/client';

export interface MileageDailyPayload {
  employee_id: string;
  date: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
}

export interface MileageMonthlyPayload {
  employee_id: string;
  month_year: string;
  km_total: number;
  fuel_cost: number;
  notes: string | null;
}

export const fuelService = {
  getActiveEmployees: async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, personal_photo_url')
      .eq('status', 'active')
      .order('name');
    return { data, error };
  },

  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    return { data, error };
  },

  getActiveEmployeeAppLinks: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, app_id')
      .eq('status', 'active');
    return { data, error };
  },

  getMonthlyDailyMileage: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('employee_id, km_total, fuel_cost, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    return { data, error };
  },

  getMonthlyOrders: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, orders_count')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    return { data, error };
  },

  getMonthlyFuelByMonthYear: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage')
      .select('employee_id, fuel_cost')
      .eq('month_year', monthYear);
    return { data, error };
  },

  getActiveVehicleAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('employee_id, vehicles(plate_number, type, brand, model)')
      .is('end_date', null)
      .order('start_date', { ascending: false });
    return { data, error };
  },

  getDailyMileageByMonth: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('*, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false });
    return { data, error };
  },

  upsertDailyMileage: async (payload: MileageDailyPayload, editId?: string) => {
    if (editId) {
      const { error } = await supabase
        .from('vehicle_mileage_daily')
        .update(payload)
        .eq('id', editId);
      return { error };
    }
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .upsert(payload, { onConflict: 'employee_id,date' });
    return { error };
  },

  deleteDailyMileage: async (id: string) => {
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .delete()
      .eq('id', id);
    return { error };
  },

  saveMonthlyMileageImport: async (rows: MileageMonthlyPayload[], replaceExisting: boolean) => {
    if (replaceExisting) {
      const { error } = await supabase
        .from('vehicle_mileage')
        .upsert(rows, { onConflict: 'employee_id,month_year' });
      return { error };
    }
    const { error } = await supabase
      .from('vehicle_mileage')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as unknown as any);
    return { error };
  },
};

export default fuelService;
