import { supabase } from '@services/supabase/client';
import { throwIfError } from '@services/serviceError';

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
      .select('id, name, personal_photo_url, city')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'fuelService.getActiveEmployees');
    return { data, error: null };
  },

  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    throwIfError(error, 'fuelService.getActiveApps');
    return { data, error: null };
  },

  getActiveEmployeeAppLinks: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, app_id')
      .eq('status', 'active');
    throwIfError(error, 'fuelService.getActiveEmployeeAppLinks');
    return { data, error: null };
  },

  getMonthlyDailyMileage: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('employee_id, km_total, fuel_cost, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    throwIfError(error, 'fuelService.getMonthlyDailyMileage');
    return { data, error: null };
  },

  getMonthlyOrders: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, orders_count')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    throwIfError(error, 'fuelService.getMonthlyOrders');
    return { data, error: null };
  },

  getMonthlyFuelByMonthYear: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage')
      .select('employee_id, fuel_cost')
      .eq('month_year', monthYear);
    throwIfError(error, 'fuelService.getMonthlyFuelByMonthYear');
    return { data, error: null };
  },

  getActiveVehicleAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('employee_id, vehicles(plate_number, type, brand, model)')
      .is('end_date', null)
      .order('start_date', { ascending: false });
    throwIfError(error, 'fuelService.getActiveVehicleAssignments');
    return { data, error: null };
  },

  getDailyMileageByMonth: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('*, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false });
    throwIfError(error, 'fuelService.getDailyMileageByMonth');
    return { data, error: null };
  },

  /**
   * Server-side daily mileage list (pagination + filters) for a month.
   * Notes:
   * - Branch filter is derived from employees.city (makkah/jeddah).
   */
  getDailyMileagePaged: async (params: {
    monthStart: string;
    monthEnd: string;
    page: number; // 1-based
    pageSize: number;
    filters?: {
      employeeId?: string;
      branch?: 'makkah' | 'jeddah';
      search?: string; // employee name
    };
  }) => {
    const { monthStart, monthEnd, page, pageSize } = params;
    const filters = params.filters ?? {};

    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('vehicle_mileage_daily')
      .select('id, employee_id, date, km_total, fuel_cost, notes, employees(id, name, city)', { count: 'exact' })
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
      .range(fromIdx, toIdx);

    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    if (filters.branch) query = query.eq('employees.city', filters.branch);
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      query = query.ilike('employees.name', `%${q}%`);
    }

    const { data, error, count } = await query;
    throwIfError(error, 'fuelService.getDailyMileagePaged');
    return { data: data || [], error: null, count: count ?? 0 };
  },

  /** Export helper for large daily mileage datasets (chunked). */
  exportDailyMileage: async (params: {
    monthStart: string;
    monthEnd: string;
    filters?: {
      employeeId?: string;
      branch?: 'makkah' | 'jeddah';
      search?: string;
    };
    chunkSize?: number;
    maxRows?: number;
  }) => {
    const { monthStart, monthEnd } = params;
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 50_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await fuelService.getDailyMileagePaged({
        monthStart,
        monthEnd,
        page,
        pageSize: chunkSize,
        filters,
      });
      all.push(...(res.data || []));
      if ((res.data || []).length < chunkSize) break;
    }
    return { data: all, error: null };
  },

  upsertDailyMileage: async (payload: MileageDailyPayload, editId?: string) => {
    if (editId) {
      const { error } = await supabase
        .from('vehicle_mileage_daily')
        .update(payload)
        .eq('id', editId);
      throwIfError(error, 'fuelService.upsertDailyMileage.update');
      return { error: null };
    }
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .upsert(payload, { onConflict: 'employee_id,date' });
    throwIfError(error, 'fuelService.upsertDailyMileage.upsert');
    return { error: null };
  },

  deleteDailyMileage: async (id: string) => {
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .delete()
      .eq('id', id);
    throwIfError(error, 'fuelService.deleteDailyMileage');
    return { error: null };
  },

  saveMonthlyMileageImport: async (rows: MileageMonthlyPayload[], replaceExisting: boolean) => {
    if (replaceExisting) {
      const { error } = await supabase
        .from('vehicle_mileage')
        .upsert(rows, { onConflict: 'employee_id,month_year' });
      throwIfError(error, 'fuelService.saveMonthlyMileageImport.upsert');
      return { error: null };
    }
    const { error } = await supabase
      .from('vehicle_mileage')
      .insert(rows as Record<string, unknown>[], { ignoreDuplicates: true });
    throwIfError(error, 'fuelService.saveMonthlyMileageImport.insert');
    return { error: null };
  },
};

export default fuelService;
