import { toast } from '@/components/ui/sonner';

/**
 * Default React Query `retry` — do not retry on auth failures; cap other retries (Sonar / TanStack v5).
 * Use in `QueryClient` `defaultOptions.queries.retry`.
 */
export function defaultQueryRetry(failureCount: number, error: unknown): boolean {
  if (!error) return false;
  if (typeof error !== 'object') return failureCount < 2;
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403) return false;
  return failureCount < 2;
}

export function getErrorMessage(err: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || fallback;
  try {
    const anyErr = err as { message?: unknown; error?: unknown };
    if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message;
    if (typeof anyErr.error === 'string' && anyErr.error.trim()) return anyErr.error;
  } catch (e) {
    console.warn('[getErrorMessage] unexpected error shape', e);
  }
  return fallback;
}

export function toastQueryError(err: unknown, title = 'تعذر تحميل البيانات'): void {
  toast.error(title, { description: getErrorMessage(err) });
}

export function toastMutationError(err: unknown, title = 'تعذر تنفيذ العملية'): void {
  toast.error(title, { description: getErrorMessage(err) });
}

