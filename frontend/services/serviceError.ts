import { logError } from '@shared/lib/logger';

export class ServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.cause = cause;
  }
}

/** Wraps Supabase or unknown errors as {@link ServiceError} for consistent service-layer throws. */
export function toServiceError(error: unknown, context?: string): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error) logError('[serviceError] toServiceError', error);
  let message: string;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message
  ) {
    message = (error as { message: string }).message;
  } else if (context) {
    message = `Service failure: ${context}`;
  } else {
    message = "Service failure";
  }
  return new ServiceError(message, error);
}

export const throwIfError = (error: unknown, context: string): void => {
  if (!error) return;
  throw toServiceError(error, context);
};

/**
 * Central handler for Supabase client `error` (and other service-layer failures).
 * Use after `const { data, error } = await ...` (or `res.error`):
 * `if (error) handleSupabaseError(error, 'serviceName.action')`
 */
export function handleSupabaseError(error: unknown, context: string): never {
  throw toServiceError(error, context);
}
