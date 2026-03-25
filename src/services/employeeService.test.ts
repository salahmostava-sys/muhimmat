import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({
    tables: hoisted.tableState,
    storageUpload: { data: { path: 'doc.png' }, error: null },
  });
  return {
    supabase: Object.assign(base, {
      from: vi.fn((table: string) =>
        createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import { employeeService } from './employeeService';

describe('employeeService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('getAll, updateCity, getById', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    await employeeService.getAll();
    hoisted.tableState.employees = { error: null };
    await employeeService.updateCity('e1', 'makkah');
    hoisted.tableState.employees = { data: { id: 'e1' }, error: null };
    await employeeService.getById('e1');
  });

  it('findByEmployeeCode and findByNationalId', async () => {
    hoisted.tableState.employees = { data: { id: 'e1' }, error: null };
    await employeeService.findByEmployeeCode('C1');
    hoisted.tableState.employees = { data: { id: 'e1' }, error: null };
    await employeeService.findByNationalId('1234-5678');
  });

  it('throws on find errors', async () => {
    hoisted.tableState.employees = { data: null, error: { message: 'nf' } };
    await expect(employeeService.findByEmployeeCode('x')).rejects.toThrow('nf');
  });

  it('deleteById', async () => {
    hoisted.tableState.employees = { error: null };
    await employeeService.deleteById('e1');
  });

  it('getActiveForSalaryContext, getActiveSalarySchemes, getActiveApps', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    await employeeService.getActiveForSalaryContext();
    hoisted.tableState.salary_schemes = { data: [], error: null };
    await employeeService.getActiveSalarySchemes();
    hoisted.tableState.apps = { data: [], error: null };
    await employeeService.getActiveApps();
  });

  it('getEmployeeAssignedAppNames maps nested apps', async () => {
    hoisted.tableState.employee_apps = {
      data: [{ apps: { name: 'Talabat' } }, { apps: null }],
      error: null,
    };
    const { data } = await employeeService.getEmployeeAssignedAppNames('e1');
    expect(data).toEqual(['Talabat']);
  });

  it('createEmployee, updateEmployee', async () => {
    hoisted.tableState.employees = { data: { id: 'e1' }, error: null };
    await employeeService.createEmployee({ name: 'A' });
    hoisted.tableState.employees = { error: null };
    await employeeService.updateEmployee('e1', { name: 'B' });
  });

  it('uploadEmployeeDocument and updateEmployeeDocumentPaths', async () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await employeeService.uploadEmployeeDocument('path/a.png', file);
    hoisted.tableState.employees = { error: null };
    await employeeService.updateEmployeeDocumentPaths('e1', { id_photo_url: 'p' });
  });

  it('replaceEmployeeApps with and without appIds', async () => {
    hoisted.tableState.employee_apps = { error: null };
    await employeeService.replaceEmployeeApps('e1', []);
    hoisted.tableState.employee_apps = { error: null };
    await employeeService.replaceEmployeeApps('e1', ['a1', 'a2']);
  });

  it('upsertEmployeeApp', async () => {
    hoisted.tableState.employee_apps = { error: null };
    await employeeService.upsertEmployeeApp('e1', 'a1');
  });
});
