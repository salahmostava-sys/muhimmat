import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';

export const ordersQueryKey = ['orders'] as const;

export const useOrders = () =>
  useQuery({
    queryKey: ordersQueryKey,
    queryFn: async () => {
      const { data } = await orderService.getAll();
      return data || [];
    },
    retry: 2,
    staleTime: 30_000,
  });
