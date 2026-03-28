import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@services/vehicleService';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';

export const vehicleAssignmentDataQueryKey = (userId: string) => ['vehicle-assignment', userId, 'page-data'] as const;

export const useVehicleAssignmentData = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady && !!user?.id;
  const q = useQuery({
    queryKey: vehicleAssignmentDataQueryKey(uid),
    queryFn: async () => {
      const [assignments, vehicles, employees] = await Promise.all([
        vehicleService.getAssignmentsWithRelations(),
        vehicleService.getAll(),
        vehicleService.getActiveEmployees(),
      ]);

      return {
        assignments,
        vehicles,
        employees,
      };
    },
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error, undefined, q.refetch);
  return q;
};
