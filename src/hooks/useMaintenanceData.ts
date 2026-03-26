import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { useAuth } from '@/context/AuthContext';

export const maintenanceDataQueryKey = (userId: string) => ['maintenance', userId, 'page-data'] as const;

export const useMaintenanceData = () => {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const enabled = !!session && !!user && !authLoading;

  return useQuery({
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
    enabled,
    retry: 2,
    staleTime: 60_000,
  });
};
