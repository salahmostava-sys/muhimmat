import { describe, expect, it } from 'vitest';
import { ServiceError, throwIfError } from './serviceError';

describe('serviceError', () => {
  it('throwIfError does nothing when error is null', () => {
    expect(() => throwIfError(null, 'ctx')).not.toThrow();
  });

  it('throws ServiceError with message from error', () => {
    expect(() => throwIfError({ message: 'boom' }, 'ctx')).toThrow(ServiceError);
    try {
      throwIfError({ message: 'boom' }, 'ctx');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceError);
      expect((e as ServiceError).message).toBe('boom');
      expect((e as ServiceError).cause).toEqual({ message: 'boom' });
    }
  });

  it('throws with context fallback when message missing', () => {
    expect(() => throwIfError({}, 'myContext')).toThrow('Service failure: myContext');
  });
});
