import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@/services/employeeService';
import { useAuth } from '@/context/AuthContext';

export const employeesQueryKey = (userId: string) => ['employees', userId] as const;

export const useEmployees = () => {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const enabled = !!session && !!user && !authLoading;

  return useQuery({
    queryKey: employeesQueryKey(uid),
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
    enabled,
    retry: 2,
    staleTime: 60_000,
  });
};
