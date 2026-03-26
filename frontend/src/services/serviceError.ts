export class ServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
    this.cause = cause;
  }
}

export const throwIfError = (error: { message?: string } | null, context: string): void => {
  if (!error) return;
  console.error(error);
  throw new ServiceError(error.message || `Service failure: ${context}`, error);
};
