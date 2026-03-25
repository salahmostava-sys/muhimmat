export type FileValidationOptions = {
  allowedTypes?: string[];
  maxSizeBytes?: number;
};

export type FileValidationResult = { valid: true; error?: never } | { valid: false; error: string };

export const DEFAULT_ALLOWED_UPLOAD_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
];

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export function validateUploadFile(
  file: File,
  options: FileValidationOptions = {}
): FileValidationResult {
  const allowedTypes = options.allowedTypes ?? DEFAULT_ALLOWED_UPLOAD_TYPES;
  const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_UPLOAD_BYTES;

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'غير مسموح بهذا النوع' };
  }
  if (file.size > maxSizeBytes) {
    return { valid: false, error: 'الملف كبير جدًا' };
  }
  return { valid: true };
}

export function validatePhoneNumber(phoneNumber: string) {
  const regex = /^\(\d{3}\) \d{3}-\d{4}$/;
  return regex.test(phoneNumber);
}

export function validateEmail(email: string) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validateNationalID(nationalID: string) {
  const regex = /^[0-9]{4}-[0-9]{4}$/;
  return regex.test(nationalID);
}