import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { useAuth } from '@/context/AuthContext';

export const motorcyclesDataQueryKey = ['motorcycles', 'list'] as const;

export const useMotorcyclesData = () => {
  const { session } = useAuth();
  return useQuery({
    queryKey: motorcyclesDataQueryKey,
    queryFn: async () => {
      const { data, error } = await vehicleService.getAllWithCurrentRider();
      if (error) {
        throw new Error(error.message || 'تعذر تحميل بيانات المركبات');
      }
      return data || [];
    },
    retry: 2,
    staleTime: 60_000,
    enabled: !!session,
  });
};
