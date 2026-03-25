import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';

export const vehicleAssignmentDataQueryKey = ['vehicle-assignment', 'page-data'] as const;

export const useVehicleAssignmentData = () =>
  useQuery({
    queryKey: vehicleAssignmentDataQueryKey,
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
    retry: 2,
    staleTime: 60_000,
  });
