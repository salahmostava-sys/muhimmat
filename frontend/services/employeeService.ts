import { supabase } from '@services/supabase/client';
import { toServiceError } from '@services/serviceError';
import { createPagedResult } from '@shared/types/pagination';

export type EmployeeAppOption = {
  id: string;
  name: string;
  brand_color?: string | null;
  text_color?: string | null;
};

export type SalarySchemeOption = {
  id: string;
  name: string;
};

export const employeeService = {
  async getAll() {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw toServiceError(error, 'employeeService.getAll');
    return data ?? [];
  },

  /**
   * Server-side list for large volumes (pagination + filters).
   * Notes:
   * - Branch filter is derived from employees.city (makkah/jeddah).
   * - Search matches common identifiers (name, code, national_id, phone).
   */
  async getPaged(params: {
    page: number; // 1-based
    pageSize: number;
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string;
      status?: 'active' | 'inactive' | 'ended';
    };
  }) {
    const { page, pageSize } = params;
    const filters = params.filters ?? {};
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let query = supabase
      .from('employees')
      .select(
        'id, name, employee_code, national_id, phone, city, status, sponsorship_status, license_status, residency_expiry, join_date, job_title',
        { count: 'exact' }
      )
      .order('name', { ascending: true })
      .range(fromIdx, toIdx);

    if (filters.branch) query = query.eq('city', filters.branch);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      query = query.or(
        [
          `name.ilike.%${q}%`,
          `employee_code.ilike.%${q}%`,
          `national_id.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
        ].join(',')
      );
    }

    const { data, error, count } = await query;
    if (error) throw toServiceError(error, 'employeeService.getPaged');
    return createPagedResult({
      rows: data,
      total: count,
      page,
      pageSize,
    });
  },

  /** Export helper for large datasets (chunked). */
  async exportEmployees(params: {
    filters?: {
      branch?: 'makkah' | 'jeddah';
      search?: string;
      status?: 'active' | 'inactive' | 'ended';
    };
    chunkSize?: number;
    maxRows?: number;
  }) {
    const filters = params.filters ?? {};
    const chunkSize = params.chunkSize ?? 1000;
    const maxRows = params.maxRows ?? 50_000;

    const all: unknown[] = [];
    for (let page = 1; page <= Math.ceil(maxRows / chunkSize); page++) {
      const res = await employeeService.getPaged({ page, pageSize: chunkSize, filters });
      all.push(...res.rows);
      if (res.rows.length < chunkSize) break;
    }
    return all;
  },

  async updateCity(employeeId: string, city: 'makkah' | 'jeddah') {
    const { error } = await supabase
      .from('employees')
      .update({ city })
      .eq('id', employeeId);
    if (error) throw toServiceError(error, 'employeeService.updateCity');
  },

  async getById(employeeId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    if (error) throw toServiceError(error, 'employeeService.getById');
    return data;
  },

  async findByEmployeeCode(employeeCode: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', employeeCode)
      .maybeSingle();
    if (error) throw toServiceError(error, 'employeeService.findByEmployeeCode');
    return data;
  },

  async findByNationalId(nationalId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('national_id', nationalId)
      .maybeSingle();
    if (error) throw toServiceError(error, 'employeeService.findByNationalId');
    return data;
  },

  async deleteById(employeeId: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);
    if (error) throw toServiceError(error, 'employeeService.deleteById');
  },

  async getActiveForSalaryContext() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, job_title, national_id, salary_type, base_salary, iban, city, preferred_language, phone, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    if (error) throw toServiceError(error, 'employeeService.getActiveForSalaryContext');
    return data ?? [];
  },

  async getActiveSalarySchemes() {
    const { data, error } = await supabase
      .from('salary_schemes')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    if (error) throw toServiceError(error, 'employeeService.getActiveSalarySchemes');
    return (data || []) as SalarySchemeOption[];
  },

  async getActiveApps() {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, brand_color, text_color')
      .eq('is_active', true)
      .order('name');
    if (error) throw toServiceError(error, 'employeeService.getActiveApps');
    return (data || []) as EmployeeAppOption[];
  },

  async getEmployeeAssignedAppNames(employeeId: string) {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('apps(name)')
      .eq('employee_id', employeeId);
    if (error) throw toServiceError(error, 'employeeService.getEmployeeAssignedAppNames');

    return (data || [])
      .map((row: { apps?: { name?: string | null } | null }) => row.apps?.name)
      .filter((name): name is string => Boolean(name));
  },

  async createEmployee(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    if (error) throw toServiceError(error, 'employeeService.createEmployee');
    return data;
  },

  async updateEmployee(employeeId: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employeeId);
    if (error) throw toServiceError(error, 'employeeService.updateEmployee');
  },

  async uploadEmployeeDocument(storagePath: string, file: File) {
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file, { upsert: true });
    if (error) throw toServiceError(error, 'employeeService.uploadEmployeeDocument');
    return data;
  },

  async updateEmployeeDocumentPaths(employeeId: string, updates: Record<string, string>) {
    const { error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', employeeId);
    if (error) throw toServiceError(error, 'employeeService.updateEmployeeDocumentPaths');
  },

  async replaceEmployeeApps(employeeId: string, appIds: string[]) {
    const { error: deleteError } = await supabase
      .from('employee_apps')
      .delete()
      .eq('employee_id', employeeId);
    if (deleteError) throw toServiceError(deleteError, 'employeeService.replaceEmployeeApps.delete');

    if (appIds.length === 0) return;

    const rows = appIds.map((appId) => ({
      employee_id: employeeId,
      app_id: appId,
      status: 'active',
    }));

    const { error: insertError } = await supabase
      .from('employee_apps')
      .insert(rows);
    if (insertError) throw toServiceError(insertError, 'employeeService.replaceEmployeeApps.insert');
  },

  async upsertEmployeeApp(employeeId: string, appId: string) {
    const { error } = await supabase
      .from('employee_apps')
      .upsert({ employee_id: employeeId, app_id: appId, status: 'active' }, { onConflict: 'employee_id,app_id' });
    if (error) throw toServiceError(error, 'employeeService.upsertEmployeeApp');
  },
};

export default employeeService;
