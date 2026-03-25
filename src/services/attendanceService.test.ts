import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@/test/mocks/supabaseClientMock';

const hoisted = vi.hoisted(() => ({
  tableState: {} as Record<string, MockQueryResult>,
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock, createQueryBuilder } = await import('@/test/mocks/supabaseClientMock');
  const base = createSupabaseMock({ tables: hoisted.tableState });
  return {
    supabase: Object.assign(base, {
      from: vi.fn((table: string) =>
        createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
      ),
    }),
  };
});

import { supabase } from '@/integrations/supabase/client';
import attendanceService from './attendanceService';

describe('attendanceService', () => {
  beforeEach(() => {
    Object.keys(hoisted.tableState).forEach((k) => delete hoisted.tableState[k]);
    vi.mocked(supabase.from).mockImplementation((table: string) =>
      createQueryBuilder(hoisted.tableState[table] ?? { data: null, error: null })
    );
  });

  it('getAttendanceStatusRange', async () => {
    hoisted.tableState.attendance = { data: [{ date: '2026-03-01', status: 'present' }], error: null };
    const res = await attendanceService.getAttendanceStatusRange('2026-03-01', '2026-03-31');
    expect(res.data).toHaveLength(1);
  });

  it('getActiveEmployeesCount', async () => {
    hoisted.tableState.employees = { count: 7, error: null };
    const res = await attendanceService.getActiveEmployeesCount();
    expect(res.count).toBe(7);
  });

  it('upsertDailyAttendance', async () => {
    hoisted.tableState.attendance = { error: null };
    const res = await attendanceService.upsertDailyAttendance({
      employee_id: 'e1',
      date: '2026-03-01',
      status: 'present',
      check_in: null,
      check_out: null,
      note: null,
    });
    expect(res.error).toBeNull();
  });

  it('getMonthlyEmployeesAndAttendance', async () => {
    hoisted.tableState.employees = { data: [], error: null };
    hoisted.tableState.attendance = { data: [], error: null };
    const res = await attendanceService.getMonthlyEmployeesAndAttendance('2026-03-01', '2026-03-31');
    expect(res.employeesRes.data).toEqual([]);
  });

  it('getAttendanceByMonth', async () => {
    hoisted.tableState.attendance = { data: [], error: null };
    await attendanceService.getAttendanceByMonth('2026-03');
  });

  it('getAttendanceByEmployeeMonth', async () => {
    hoisted.tableState.attendance = { data: [], error: null };
    await attendanceService.getAttendanceByEmployeeMonth('e1', '2026-03');
  });
});
