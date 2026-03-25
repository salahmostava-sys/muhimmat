import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';
import { toastQueryError } from '@/lib/query';
import { useAuth } from '@/context/AuthContext';

export const ordersQueryKey = ['orders'] as const;

export const useOrders = () => {
  const { session } = useAuth();
  return useQuery({
    queryKey: ordersQueryKey,
    queryFn: async () => {
      const { data } = await orderService.getAll();
      return data || [];
    },
    onError: (err) => toastQueryError(err),
    retry: 2,
    staleTime: 30_000,
    enabled: !!session,
  });
};
