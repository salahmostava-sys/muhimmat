import { describe, expect, it } from 'vitest';
import {
  validateUploadFile,
  validatePhoneNumber,
  validateEmail,
  validateNationalID,
  DEFAULT_ALLOWED_UPLOAD_TYPES,
} from './validation';

describe('validation', () => {
  it('validateUploadFile accepts allowed type and size', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(validateUploadFile(file)).toEqual({ valid: true });
  });

  it('validateUploadFile rejects disallowed type', () => {
    const file = new File(['x'], 'a.exe', { type: 'application/x-msdownload' });
    expect(validateUploadFile(file)).toEqual({ valid: false, error: 'غير مسموح بهذا النوع' });
  });

  it('validateUploadFile rejects oversized file', () => {
    const file = new File([new Uint8Array(10)], 'big.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 999999999 });
    expect(validateUploadFile(file, { maxSizeBytes: 100 })).toEqual({ valid: false, error: 'الملف كبير جدًا' });
  });

  it('validateUploadFile uses custom allowed types', () => {
    const file = new File(['x'], 'a.gif', { type: 'image/gif' });
    expect(validateUploadFile(file, { allowedTypes: ['image/gif'] })).toEqual({ valid: true });
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES).toContain('image/png');
  });

  it('validatePhoneNumber matches expected format', () => {
    expect(validatePhoneNumber('(555) 123-4567')).toBe(true);
    expect(validatePhoneNumber('0551234567')).toBe(false);
  });

  it('validateEmail', () => {
    expect(validateEmail('a@b.co')).toBe(true);
    expect(validateEmail('not-an-email')).toBe(false);
  });

  it('validateNationalID', () => {
    expect(validateNationalID('1234-5678')).toBe(true);
    expect(validateNationalID('12345678')).toBe(false);
  });
});
