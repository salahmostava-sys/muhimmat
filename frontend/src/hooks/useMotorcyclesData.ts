import { useQuery } from '@tanstack/react-query';
import { vehicleService } from '@/services/vehicleService';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';

export const motorcyclesDataQueryKey = (userId: string) => ['motorcycles', userId, 'list'] as const;

export const useMotorcyclesData = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
  const q = useQuery({
    queryKey: motorcyclesDataQueryKey(uid),
    queryFn: async () => {
      const { data, error } = await vehicleService.getAllWithCurrentRider();
      if (error) {
        throw new Error(error.message || 'تعذر تحميل بيانات المركبات');
      }
      return data || [];
    },
    staleTime: 60_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
};
