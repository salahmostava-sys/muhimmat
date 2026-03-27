type LogLevel = 'error' | 'warn';

/**
 * Centralized error logger.
 * In production we keep logs silent to avoid noisy browser consoles.
 */
function emitLog(level: LogLevel, message: string, payload: unknown) {
  if (level === 'warn') {
    console.warn(message, payload);
    return;
  }
  // Avoid direct console.error usage while keeping dev visibility.
  console.log(`[ERROR] ${message}`, payload);
}

export const logger = {
  error: (message: string, error?: unknown, options?: { meta?: unknown }) => {
    if (import.meta.env.PROD) return;
    const payload = options?.meta === undefined ? error : { error, meta: options.meta };
    emitLog('error', message, payload);
  },
  warn: (message: string, error?: unknown, options?: { meta?: unknown }) => {
    if (import.meta.env.PROD) return;
    const payload = options?.meta === undefined ? error : { error, meta: options.meta };
    emitLog('warn', message, payload);
  },
};

export function logError(message: string, error?: unknown, options?: { level?: LogLevel; meta?: unknown }) {
  if (import.meta.env.PROD) return;
  const level: LogLevel = options?.level ?? 'error';
  if (level === 'warn') {
    logger.warn(message, error, { meta: options?.meta });
    return;
  }
  logger.error(message, error, { meta: options?.meta });
}
