import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEmployees } from './useEmployees';
import { employeeService } from '@services/employeeService';

vi.mock('@services/employeeService', () => ({
  employeeService: {
    getAll: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useEmployees', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns employees when service succeeds', async () => {
    vi.mocked(employeeService.getAll).mockResolvedValue({
      data: [{ id: 'e1', name: 'Ahmed' }],
      error: null,
    } as unknown as Awaited<ReturnType<typeof employeeService.getAll>>);

    const { result } = renderHook(() => useEmployees(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'e1', name: 'Ahmed' }]);
  });

  it('returns error when service fails', async () => {
    vi.mocked(employeeService.getAll).mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    } as unknown as Awaited<ReturnType<typeof employeeService.getAll>>);

    const { result } = renderHook(() => useEmployees(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(result.current.error?.message).toContain('db down');
  });

  it('returns empty list when service returns null data without error', async () => {
    vi.mocked(employeeService.getAll).mockResolvedValue({
      data: null,
      error: null,
    } as unknown as Awaited<ReturnType<typeof employeeService.getAll>>);

    const { result } = renderHook(() => useEmployees(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
