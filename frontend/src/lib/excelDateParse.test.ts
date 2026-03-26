import { describe, expect, it } from 'vitest';
import { parseExcelDate } from './excelDateParse';

describe('parseExcelDate', () => {
  it('returns null for empty inputs', () => {
    expect(parseExcelDate(undefined)).toBeNull();
    expect(parseExcelDate(null)).toBeNull();
    expect(parseExcelDate('')).toBeNull();
    expect(parseExcelDate('   ')).toBeNull();
  });

  it('passes through yyyy-MM-dd strings', () => {
    expect(parseExcelDate('2024-03-15')).toBe('2024-03-15');
  });

  it('parses dd/MM/yyyy', () => {
    expect(parseExcelDate('5/3/2024')).toBe('2024-03-05');
    expect(parseExcelDate('05/03/2024')).toBe('2024-03-05');
  });

  it('parses Date instances (UTC day)', () => {
    expect(parseExcelDate(new Date(Date.UTC(2024, 5, 10)))).toBe('2024-06-10');
  });

  it('returns null for invalid Date', () => {
    expect(parseExcelDate(new Date(Number.NaN))).toBeNull();
  });
});
