import { toast } from '@shared/components/ui/sonner';
import { logError } from '@shared/lib/logger';

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
    logError('[getErrorMessage] unexpected error shape', e, { level: 'warn' });
  }
  return fallback;
}

export type ToastQueryErrorOptions = {
  /** Shown as Sonner action button (manual refetch). */
  onRetry?: () => void;
};

export function toastQueryError(
  err: unknown,
  title = 'تعذر تحميل البيانات',
  options?: ToastQueryErrorOptions,
): void {
  const onRetry = options?.onRetry;
  toast.error(title, {
    description: getErrorMessage(err),
    ...(onRetry && {
      action: {
        label: 'إعادة المحاولة',
        onClick: () => {
          onRetry();
        },
      },
    }),
  });
}

export function toastMutationError(err: unknown, title = 'تعذر تنفيذ العملية'): void {
  toast.error(title, { description: getErrorMessage(err) });
}

