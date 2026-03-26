import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@services/vehicleService';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';

export const vehicleAssignmentDataQueryKey = (userId: string) => ['vehicle-assignment', userId, 'page-data'] as const;

export const useVehicleAssignmentData = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const q = useQuery({
    queryKey: vehicleAssignmentDataQueryKey(uid),
    queryFn: async () => {
      const [assignRes, vehicleRes, empRes] = await Promise.all([
        vehicleService.getAssignmentsWithRelations(200),
        vehicleService.getAll(),
        vehicleService.getActiveEmployees(),
      ]);

      if (assignRes.error) {
        throw new Error(assignRes.error.message || 'تعذر تحميل سجلات التسليم');
      }
      if (vehicleRes.error) {
        throw new Error(vehicleRes.error.message || 'تعذر تحميل المركبات');
      }
      if (empRes.error) {
        throw new Error(empRes.error.message || 'تعذر تحميل الموظفين');
      }

      return {
        assignments: assignRes.data || [],
        vehicles: vehicleRes.data || [],
        employees: empRes.data || [],
      };
    },
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
};
