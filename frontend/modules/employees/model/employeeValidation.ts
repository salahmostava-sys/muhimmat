import type { EmployeeArabicRow } from '@shared/lib/employeeArabicTemplateImport';

export const isValidImportPhone = (value: string) => /^[+]?\d{8,15}$/.test(value.replaceAll(/\s/g, ''));

export const validateImportRow = (row: EmployeeArabicRow, rowIndex: number) => {
  const issues: Array<{ rowIndex: number; issue: string }> = [];
  const name = String(row.name ?? '').trim();
  const phone = String(row.phone ?? '').trim();
  const nationalId = String(row.national_id ?? '').trim();

  if (!name) issues.push({ rowIndex, issue: 'الاسم مفقود' });
  if (!phone) issues.push({ rowIndex, issue: 'رقم الهاتف مفقود' });
  else if (!isValidImportPhone(phone)) issues.push({ rowIndex, issue: 'رقم الهاتف غير صالح' });
  if (!nationalId) issues.push({ rowIndex, issue: 'رقم الهوية مفقود' });

  return issues;
};
