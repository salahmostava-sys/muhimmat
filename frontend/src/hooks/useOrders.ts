import { useQuery } from '@tanstack/react-query';
import { orderService } from '@/services/orderService';
import { useAuth } from '@/context/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@/hooks/useQueryErrorToast';

export const ordersQueryKey = (userId: string) => ['orders', userId] as const;

export const useOrders = () => {
  const { user, session, authLoading } = useAuth();
  const { userId } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && !!user && !authLoading;
  const q = useQuery({
    queryKey: ordersQueryKey(uid),
    queryFn: async () => {
      const { data } = await orderService.getAll();
      return data || [];
    },
    staleTime: 30_000,
    enabled,
  });
  useQueryErrorToast(q.isError, q.error);
  return q;
};
