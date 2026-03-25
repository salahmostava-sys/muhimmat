import { describe, expect, it } from 'vitest';
import { salarySlipService } from './salarySlipService';

describe('salarySlipService', () => {
  it('generateSalaryPDF returns a Blob', () => {
    const blob = salarySlipService.generateSalaryPDF({ name: 'Test', nationalId: '1234' }, 150.5, '2026-03', 12);
    expect(blob).toBeInstanceOf(Blob);
  });

  it('omits nationalId line when not provided', () => {
    const blob = salarySlipService.generateSalaryPDF({ name: 'Test' }, 0, '2026-03', 0);
    expect(blob).toBeInstanceOf(Blob);
  });
});
