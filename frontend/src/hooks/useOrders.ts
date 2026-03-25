import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';
import { toastQueryError } from '@/lib/query';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';

export const ordersQueryKey = (userId: string) => ['orders', userId] as const;

export const useOrders = () => {
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  return useQuery({
    queryKey: ordersQueryKey(uid),
    queryFn: async () => {
      const { data } = await orderService.getAll();
      return data || [];
    },
    onError: (err) => toastQueryError(err),
    retry: 2,
    staleTime: 30_000,
    enabled,
  });
};
