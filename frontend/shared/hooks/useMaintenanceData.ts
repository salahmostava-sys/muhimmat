import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@services/vehicleService';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';

export const maintenanceDataQueryKey = (userId: string) => ['maintenance', userId, 'page-data'] as const;

export const useMaintenanceData = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const q = useQuery({
    queryKey: maintenanceDataQueryKey(uid),
    queryFn: async () => {
      const [logsRes, vehiclesRes] = await Promise.all([
        vehicleService.getMaintenanceLogs(),
        vehicleService.getForSelect(),
      ]);

      if (logsRes.error) {
        throw new Error(logsRes.error.message || 'تعذر تحميل سجلات الصيانة');
      }
      if (vehiclesRes.error) {
        throw new Error(vehiclesRes.error.message || 'تعذر تحميل المركبات');
      }

      return {
        logs: logsRes.data || [],
        vehicles: vehiclesRes.data || [],
      };
    },
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
};
