import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

export const motorcyclesDataQueryKey = (userId: string) => ['motorcycles', userId, 'list'] as const;

export const useMotorcyclesData = () => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  return useQuery({
    queryKey: motorcyclesDataQueryKey(uid),
    queryFn: async () => {
      const { data, error } = await vehicleService.getAllWithCurrentRider();
      if (error) {
        throw new Error(error.message || 'تعذر تحميل بيانات المركبات');
      }
      return data || [];
    },
    retry: 2,
    staleTime: 60_000,
    enabled,
  });
};
