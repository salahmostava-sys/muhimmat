import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { useAuth } from '@/context/AuthContext';

export const motorcyclesDataQueryKey = (userId: string) => ['motorcycles', userId, 'list'] as const;

export const useMotorcyclesData = () => {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const enabled = !!session && !!user && !authLoading;

  return useQuery({
    queryKey: motorcyclesDataQueryKey(uid),
    queryFn: async () => {
      const { data, error } = await vehicleService.getAllWithCurrentRider();
      if (error) {
        throw new Error(error.message || 'تعذر تحميل بيانات المركبات');
      }
      return data || [];
    },
    enabled,
    retry: 2,
    staleTime: 60_000,
  });
};
