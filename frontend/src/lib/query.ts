import { toast } from '@/components/ui/sonner';

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

