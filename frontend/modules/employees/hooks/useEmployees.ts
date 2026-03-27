import { format } from 'date-fns';
import { useMemo } from 'react';
import { useEmployees } from '@shared/hooks/useEmployees';
import { useMonthlyActiveEmployeeIds } from '@shared/hooks/useMonthlyActiveEmployeeIds';
import { filterVisibleEmployeesInMonth } from '@shared/lib/employeeVisibility';
import type { Employee } from '@modules/employees/model/employeeUtils';

export function useEmployeesData() {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const { data: activeIdsData } = useMonthlyActiveEmployeeIds(currentMonth);
  const activeEmployeeIdsInMonth = activeIdsData?.employeeIds;

  const {
    data: employeesData = [],
    isLoading,
    error,
    refetch,
  } = useEmployees();

  const visibleEmployees = useMemo(
    () => filterVisibleEmployeesInMonth((employeesData as Employee[]) ?? [], activeEmployeeIdsInMonth),
    [employeesData, activeEmployeeIdsInMonth],
  );

  return {
    employees: visibleEmployees,
    isLoading,
    error,
    refetch,
  };
}
