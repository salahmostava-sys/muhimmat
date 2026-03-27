const SAFE_PATH_PATTERN = /^[A-Za-z0-9/_\-.]+$/;

/**
 * Normalize and validate storage object paths to avoid traversal/injection.
 */
export function sanitizeStoragePath(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Normalize separators and collapse duplicate slashes.
  const normalized = raw.replaceAll('\\', '/').replaceAll(/\/+/g, '/');

  // Reject absolute/relative traversal patterns and URLs.
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('://')) return null;
  if (!SAFE_PATH_PATTERN.test(normalized)) return null;

  return normalized;
}

