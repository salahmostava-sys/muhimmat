type LogLevel = 'error' | 'warn';
type LogMeta = { level: LogLevel; message: string; payload: unknown; ts: string; href: string };

const MONITORING_ENDPOINT = import.meta.env.VITE_MONITORING_ENDPOINT as string | undefined;
let monitoringInstalled = false;

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

function toSerializableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function sendToMonitoring(entry: LogMeta) {
  if (!MONITORING_ENDPOINT) return;
  try {
    const body = JSON.stringify(entry);
    const blob = new Blob([body], { type: 'application/json' });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(MONITORING_ENDPOINT, blob);
      return;
    }
    void fetch(MONITORING_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Never throw from logging.
  }
}

function track(level: LogLevel, message: string, error?: unknown, options?: { meta?: unknown }) {
  const payload = options?.meta === undefined ? toSerializableError(error) : { error: toSerializableError(error), meta: options.meta };
  sendToMonitoring({
    level,
    message,
    payload,
    ts: new Date().toISOString(),
    href: typeof globalThis.location?.href === 'string' ? globalThis.location.href : '',
  });
  if (!import.meta.env.PROD) {
    emitLog(level, message, payload);
  }
}

export const logger = {
  error: (message: string, error?: unknown, options?: { meta?: unknown }) => {
    track('error', message, error, options);
  },
  warn: (message: string, error?: unknown, options?: { meta?: unknown }) => {
    track('warn', message, error, options);
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

export function installGlobalErrorMonitoring() {
  if (monitoringInstalled) return;
  monitoringInstalled = true;

  globalThis.addEventListener('error', (event) => {
    logger.error('[global] uncaught error', event.error ?? event.message, {
      meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  globalThis.addEventListener('unhandledrejection', (event) => {
    logger.error('[global] unhandled rejection', event.reason);
  });
}
