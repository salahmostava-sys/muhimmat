import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@services/serviceError';

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
    throwIfError(error, 'employeeService.getAll');
    return { data, error: null };
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
    throwIfError(error, 'employeeService.getPaged');
    return { data: data || [], error: null, count: count ?? 0 };
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
      all.push(...(res.data || []));
      if ((res.data || []).length < chunkSize) break;
    }
    return { data: all, error: null };
  },

  async updateCity(employeeId: string, city: 'makkah' | 'jeddah') {
    const { error } = await supabase
      .from('employees')
      .update({ city })
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.updateCity');
    return { error: null };
  },

  async getById(employeeId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    throwIfError(error, 'employeeService.getById');
    return { data, error: null };
  },

  async findByEmployeeCode(employeeCode: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', employeeCode)
      .maybeSingle();
    throwIfError(error, 'employeeService.findByEmployeeCode');
    return { data, error: null };
  },

  async findByNationalId(nationalId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('national_id', nationalId)
      .maybeSingle();
    throwIfError(error, 'employeeService.findByNationalId');
    return { data, error: null };
  },

  async deleteById(employeeId: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.deleteById');
    return { error: null };
  },

  async getActiveForSalaryContext() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, job_title, national_id, salary_type, base_salary, iban, city, preferred_language, phone, sponsorship_status')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'employeeService.getActiveForSalaryContext');
    return { data, error: null };
  },

  async getActiveSalarySchemes() {
    const { data, error } = await supabase
      .from('salary_schemes')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'employeeService.getActiveSalarySchemes');
    return { data: (data || []) as SalarySchemeOption[], error: null };
  },

  async getActiveApps() {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, brand_color, text_color')
      .eq('is_active', true)
      .order('name');
    throwIfError(error, 'employeeService.getActiveApps');
    return { data: (data || []) as EmployeeAppOption[], error: null };
  },

  async getEmployeeAssignedAppNames(employeeId: string) {
    const { data, error } = await supabase
      .from('employee_apps')
      .select('apps(name)')
      .eq('employee_id', employeeId);
    throwIfError(error, 'employeeService.getEmployeeAssignedAppNames');

    const appNames = (data || [])
      .map((row: { apps?: { name?: string | null } | null }) => row.apps?.name)
      .filter((name): name is string => Boolean(name));

    return { data: appNames, error: null };
  },

  async createEmployee(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    throwIfError(error, 'employeeService.createEmployee');
    return { data, error: null };
  },

  async updateEmployee(employeeId: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.updateEmployee');
    return { error: null };
  },

  async uploadEmployeeDocument(storagePath: string, file: File) {
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file, { upsert: true });
    throwIfError(error, 'employeeService.uploadEmployeeDocument');
    return { data, error: null };
  },

  async updateEmployeeDocumentPaths(employeeId: string, updates: Record<string, string>) {
    const { error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.updateEmployeeDocumentPaths');
    return { error: null };
  },

  async replaceEmployeeApps(employeeId: string, appIds: string[]) {
    const { error: deleteError } = await supabase
      .from('employee_apps')
      .delete()
      .eq('employee_id', employeeId);
    throwIfError(deleteError, 'employeeService.replaceEmployeeApps.delete');

    if (appIds.length === 0) return { error: null };

    const rows = appIds.map((appId) => ({
      employee_id: employeeId,
      app_id: appId,
      status: 'active',
    }));

    const { error: insertError } = await supabase
      .from('employee_apps')
      .insert(rows);
    throwIfError(insertError, 'employeeService.replaceEmployeeApps.insert');
    return { error: null };
  },

  async upsertEmployeeApp(employeeId: string, appId: string) {
    const { error } = await supabase
      .from('employee_apps')
      .upsert({ employee_id: employeeId, app_id: appId, status: 'active' }, { onConflict: 'employee_id,app_id' });
    throwIfError(error, 'employeeService.upsertEmployeeApp');
    return { error: null };
  },
};

export default employeeService;
