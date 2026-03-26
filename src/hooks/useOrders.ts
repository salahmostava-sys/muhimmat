import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';
import { useAuth } from '@/context/AuthContext';

export const ordersQueryKey = (userId: string) => ['orders', userId] as const;

export const useOrders = () => {
  const { user, session, loading: authLoading } = useAuth();
  const uid = user?.id ?? '__none__';
  const enabled = !!session && !!user && !authLoading;

  return useQuery({
    queryKey: ordersQueryKey(uid),
    queryFn: async () => {
      const { data } = await orderService.getAll();
      return data || [];
    },
    enabled,
    retry: 2,
    staleTime: 30_000,
  });
};
