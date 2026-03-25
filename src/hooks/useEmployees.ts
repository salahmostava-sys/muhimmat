import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@/services/employeeService';

export const employeesQueryKey = ['employees'] as const;

export const useEmployees = () =>
  useQuery({
    queryKey: employeesQueryKey,
    queryFn: async () => {
      const result = await Promise.race([
        employeeService.getAll(),
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'انتهت مهلة تحميل البيانات. حاول مرة أخرى.' } }), 12000)
        ),
      ]);

      if (result.error) {
        throw new Error(result.error.message || 'تعذر تحميل الموظفين');
      }

      return result.data || [];
    },
    retry: 2,
    staleTime: 60_000,
  });
