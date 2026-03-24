import { describe, expect, it } from 'vitest';
import { formatDate, formatCurrency, formatNumber } from './formatters';

describe('formatters', () => {
  it('formatDate uses UTC', () => {
    const d = new Date(Date.UTC(2026, 2, 5));
    expect(formatDate(d)).toBe('2026-03-05');
  });

  it('formatCurrency', () => {
    expect(formatCurrency(12.3)).toBe('$12.30');
    expect(formatCurrency(1, 'ر.س')).toBe('ر.س1.00');
  });

  it('formatNumber adds thousands separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});
