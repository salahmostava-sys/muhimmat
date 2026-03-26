import { useQuery } from '@tanstack/react-query';
import { orderService } from '@services/orderService';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';

export const ordersQueryKey = (userId: string) => ['orders', userId] as const;

export const useOrders = () => {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);
  const enabled = !!session && authReady;
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
