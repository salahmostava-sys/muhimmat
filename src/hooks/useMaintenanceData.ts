import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';

export const maintenanceDataQueryKey = ['maintenance', 'page-data'] as const;

export const useMaintenanceData = () =>
  useQuery({
    queryKey: maintenanceDataQueryKey,
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
    retry: 2,
    staleTime: 60_000,
  });
