import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useOrders } from './useOrders';
import { orderService } from '@/services/orderService';

vi.mock('@/services/orderService', () => ({
  orderService: {
    getAll: vi.fn(),
  },
}));

describe('useOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns orders data from service', async () => {
    vi.mocked(orderService.getAll).mockResolvedValue({
      data: [{ id: '1', employee_id: 'e1', app_id: 'a1', date: '2026-03-01', orders_count: 5 }],
      error: null,
    } as unknown as Awaited<ReturnType<typeof orderService.getAll>>);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useOrders(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(orderService.getAll).toHaveBeenCalledTimes(1);
  });
});
