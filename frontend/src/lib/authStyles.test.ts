import { describe, expect, it } from 'vitest';
import { authBtnStyle, authGradientBtn } from './authStyles';

describe('authStyles', () => {
  it('exports gradient button class string', () => {
    expect(authGradientBtn).toContain('rounded-xl');
    expect(authGradientBtn).toContain('font-bold');
  });

  it('exports inline style object', () => {
    expect(authBtnStyle.background).toContain('linear-gradient');
    expect(authBtnStyle.boxShadow).toBeDefined();
  });
});
