import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';

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
    return { data, error };
  },

  async updateCity(employeeId: string, city: 'makkah' | 'jeddah') {
    const { error } = await supabase
      .from('employees')
      .update({ city })
      .eq('id', employeeId);
    return { error };
  },

  async getById(employeeId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();
    return { data, error };
  },

  async findByEmployeeCode(employeeCode: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_code', employeeCode)
      .maybeSingle();
    throwIfError(error, 'employeeService.findByEmployeeCode');
    return { data, error };
  },

  async findByNationalId(nationalId: string) {
    const { data, error } = await supabase
      .from('employees')
      .select('id')
      .eq('national_id', nationalId)
      .maybeSingle();
    throwIfError(error, 'employeeService.findByNationalId');
    return { data, error };
  },

  async deleteById(employeeId: string) {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);
    return { error };
  },

  async getActiveForSalaryContext() {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, job_title, national_id, salary_type, base_salary, iban, city, preferred_language, phone')
      .eq('status', 'active')
      .order('name');
    return { data, error };
  },

  async getActiveSalarySchemes() {
    const { data, error } = await supabase
      .from('salary_schemes')
      .select('id, name')
      .eq('status', 'active')
      .order('name');
    throwIfError(error, 'employeeService.getActiveSalarySchemes');
    return { data: (data || []) as SalarySchemeOption[], error };
  },

  async getActiveApps() {
    const { data, error } = await supabase
      .from('apps')
      .select('id, name, brand_color, text_color')
      .eq('is_active', true)
      .order('name');
    throwIfError(error, 'employeeService.getActiveApps');
    return { data: (data || []) as EmployeeAppOption[], error };
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

    return { data: appNames, error };
  },

  async createEmployee(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('employees')
      .insert(payload)
      .select()
      .single();
    throwIfError(error, 'employeeService.createEmployee');
    return { data, error };
  },

  async updateEmployee(employeeId: string, payload: Record<string, unknown>) {
    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.updateEmployee');
    return { error };
  },

  async uploadEmployeeDocument(storagePath: string, file: File) {
    const { data, error } = await supabase.storage
      .from('employee-documents')
      .upload(storagePath, file, { upsert: true });
    throwIfError(error, 'employeeService.uploadEmployeeDocument');
    return { data, error };
  },

  async updateEmployeeDocumentPaths(employeeId: string, updates: Record<string, string>) {
    const { error } = await supabase
      .from('employees')
      .update(updates)
      .eq('id', employeeId);
    throwIfError(error, 'employeeService.updateEmployeeDocumentPaths');
    return { error };
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
    return { error };
  },
};

export default employeeService;
