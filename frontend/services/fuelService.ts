import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';

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
    if (error) handleSupabaseError(error, 'fuelService.getActiveEmployees');
    return data ?? [];
  },

  getActiveApps: async () => {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) handleSupabaseError(error, 'fuelService.getActiveApps');
    return data ?? [];
  },

  getActiveEmployeeAppLinks: async () => {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('employee_id, app_id')
      .eq('status', 'active');
    if (error) handleSupabaseError(error, 'fuelService.getActiveEmployeeAppLinks');
    return data ?? [];
  },

  getMonthlyDailyMileage: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('employee_id, km_total, fuel_cost, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    if (error) handleSupabaseError(error, 'fuelService.getMonthlyDailyMileage');
    return data ?? [];
  },

  getMonthlyOrders: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('daily_orders')
      .select('employee_id, orders_count')
      .gte('date', monthStart)
      .lte('date', monthEnd);
    if (error) handleSupabaseError(error, 'fuelService.getMonthlyOrders');
    return data ?? [];
  },

  getMonthlyFuelByMonthYear: async (monthYear: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage')
      .select('employee_id, fuel_cost')
      .eq('month_year', monthYear);
    if (error) handleSupabaseError(error, 'fuelService.getMonthlyFuelByMonthYear');
    return data ?? [];
  },

  getActiveVehicleAssignments: async () => {
    const { data, error } = await supabase
      .from('vehicle_assignments')
      .select('employee_id, vehicles(plate_number, type, brand, model)')
      .is('end_date', null)
      .order('start_date', { ascending: false });
    if (error) handleSupabaseError(error, 'fuelService.getActiveVehicleAssignments');
    return data ?? [];
  },

  getDailyMileageByMonth: async (monthStart: string, monthEnd: string) => {
    const { data, error } = await supabase
      .from('vehicle_mileage_daily')
      .select('*, employees(name, personal_photo_url)')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false });
    if (error) handleSupabaseError(error, 'fuelService.getDailyMileageByMonth');
    return data ?? [];
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
    if (error) handleSupabaseError(error, 'fuelService.getDailyMileagePaged');
    return createPagedResult({
      rows: data,
      total: count,
      page,
      pageSize,
    });
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
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
    return all;
  },

  upsertDailyMileage: async (payload: MileageDailyPayload, editId?: string) => {
    if (editId) {
      const { error } = await supabase
        .from('vehicle_mileage_daily')
        .update(payload)
        .eq('id', editId);
      if (error) handleSupabaseError(error, 'fuelService.upsertDailyMileage.update');
      return;
    }
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .upsert(payload, { onConflict: 'employee_id,date' });
    if (error) handleSupabaseError(error, 'fuelService.upsertDailyMileage.upsert');
  },

  deleteDailyMileage: async (id: string) => {
    const { error } = await supabase
      .from('vehicle_mileage_daily')
      .delete()
      .eq('id', id);
    if (error) handleSupabaseError(error, 'fuelService.deleteDailyMileage');
  },

  saveMonthlyMileageImport: async (rows: MileageMonthlyPayload[], replaceExisting: boolean) => {
    if (replaceExisting) {
      const { error } = await supabase
        .from('vehicle_mileage')
        .upsert(rows, { onConflict: 'employee_id,month_year' });
      if (error) handleSupabaseError(error, 'fuelService.saveMonthlyMileageImport.upsert');
      return;
    }
    const { error } = await supabase
      .from('vehicle_mileage')
      .insert(rows as Record<string, unknown>[], { ignoreDuplicates: true });
    if (error) handleSupabaseError(error, 'fuelService.saveMonthlyMileageImport.insert');
  },
};

export default fuelService;
