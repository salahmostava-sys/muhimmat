import { useQuery } from '@tanstack/react-query';
import { employeeService } from '@services/employeeService';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';

export const employeesQueryKey = (userId: string) => ['employees', userId] as const;

export const useEmployees = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const q = useQuery({
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
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
};
