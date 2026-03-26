type ErrorLike = { status?: number } | null | undefined;

export const safeRetry = (failureCount: number, error: ErrorLike): boolean => {
  if (!error) return false;
  if (error.status === 401 || error.status === 403) return false;
  return failureCount < 2;
};

export async function withQueryTimeout<T>(promise: Promise<T>, timeoutMs = 10_000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('انتهت مهلة تحميل البيانات. حاول مرة أخرى.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
