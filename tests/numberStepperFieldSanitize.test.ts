import { describe, expect, it } from 'vitest';

import { sanitizeStepperInput } from '@/core/ui/stepperInput';

describe('sanitizeStepperInput', () => {
  it('drops text after a decimal separator instead of concatenating ("10.5" -> "10")', () => {
    expect(sanitizeStepperInput('10.5', 999)).toBe('10');
    expect(sanitizeStepperInput('1,5', 999)).toBe('1');
    expect(sanitizeStepperInput('12.', 999)).toBe('12');
    expect(sanitizeStepperInput('1.2.3', 999)).toBe('1');
  });

  it('strips other non-digits without truncating', () => {
    expect(sanitizeStepperInput('1a2b3', 999)).toBe('123');
    expect(sanitizeStepperInput('-4', 999)).toBe('4');
  });

  it('clamps a typed value above max to max', () => {
    expect(sanitizeStepperInput('999999', 999)).toBe('999');
    expect(sanitizeStepperInput('250', 200)).toBe('200');
    expect(sanitizeStepperInput('10.5', 9999)).toBe('10');
    expect(sanitizeStepperInput('200', 200)).toBe('200');
    expect(sanitizeStepperInput('199', 200)).toBe('199');
  });

  it('keeps a thousands-grouped integer instead of truncating it ("1,500" -> "1500")', () => {
    expect(sanitizeStepperInput('1,500', 6000)).toBe('1500');
    expect(sanitizeStepperInput('12,345', 60000)).toBe('12345');
    expect(sanitizeStepperInput(' 2,400 ', 6000)).toBe('2400');
    expect(sanitizeStepperInput('1,500', 999)).toBe('999');
    // Too-long groups are not a grouped integer; the comma stays a decimal
    // separator there ("1234,567" -> "1234").
    expect(sanitizeStepperInput('1234,567', 99999)).toBe('1234');
  });

  it('keeps empty input allowed and does not clamp to min', () => {
    expect(sanitizeStepperInput('', 999)).toBe('');
    expect(sanitizeStepperInput('.', 999)).toBe('');
    expect(sanitizeStepperInput('0', 999)).toBe('0');
  });
});
