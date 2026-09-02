import { describe, expect, it } from 'vitest';

import { parseNumericInput, sanitizeNumericInput } from '@/lib/numericInput';

describe('sanitizeNumericInput', () => {
  describe('integer mode (default)', () => {
    it('keeps digits only', () => {
      expect(sanitizeNumericInput('12')).toBe('12');
      expect(sanitizeNumericInput('0')).toBe('0');
    });

    it('strips decimal points and non-digits', () => {
      expect(sanitizeNumericInput('12.5')).toBe('125');
      expect(sanitizeNumericInput('1a2b')).toBe('12');
      expect(sanitizeNumericInput('-3')).toBe('3');
      expect(sanitizeNumericInput('1,200')).toBe('1200');
    });

    it('preserves empty string', () => {
      expect(sanitizeNumericInput('')).toBe('');
    });

    it('strips leading zeros? no — preserves user-typed digits as-is', () => {
      // No reformatting: what the user typed stays (no cursor jumps).
      expect(sanitizeNumericInput('007')).toBe('007');
    });
  });

  describe('decimal mode', () => {
    it('keeps digits and one decimal point', () => {
      expect(sanitizeNumericInput('12.5', { allowDecimal: true })).toBe('12.5');
    });

    it('collapses multiple decimal points to the first', () => {
      expect(sanitizeNumericInput('12.3.4', { allowDecimal: true })).toBe('12.34');
    });

    it('preserves partial states while typing', () => {
      expect(sanitizeNumericInput('.', { allowDecimal: true })).toBe('.');
      expect(sanitizeNumericInput('12.', { allowDecimal: true })).toBe('12.');
      expect(sanitizeNumericInput('', { allowDecimal: true })).toBe('');
    });

    it('strips non-numeric characters', () => {
      expect(sanitizeNumericInput(' 12a.5x', { allowDecimal: true })).toBe('12.5');
      expect(sanitizeNumericInput('-1.5', { allowDecimal: true })).toBe('1.5');
    });

    it('never reformats valid partial input', () => {
      // Typing "12." must remain "12." (no coercion to "12" mid-typing).
      expect(sanitizeNumericInput('12.', { allowDecimal: true })).toBe('12.');
    });
  });
});

describe('parseNumericInput', () => {
  it('parses blank to null (distinct from zero)', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('   ')).toBeNull();
  });

  it('parses zero as zero', () => {
    expect(parseNumericInput('0')).toBe(0);
    expect(parseNumericInput('00')).toBe(0);
  });

  it('parses valid integers', () => {
    expect(parseNumericInput('12')).toBe(12);
    expect(parseNumericInput(' 12 ')).toBe(12);
  });

  it('parses valid decimals when allowed', () => {
    expect(parseNumericInput('12.5', { allowDecimal: true })).toBe(12.5);
    expect(parseNumericInput('.5', { allowDecimal: true })).toBe(0.5);
    expect(parseNumericInput('12.', { allowDecimal: true })).toBe(12);
  });

  it('rejects decimals in integer mode', () => {
    expect(parseNumericInput('12.5')).toBeNull();
  });

  it('rejects non-numeric text', () => {
    expect(parseNumericInput('abc')).toBeNull();
    expect(parseNumericInput('12abc')).toBeNull();
  });

  it('rejects partial states without decimal allowance', () => {
    expect(parseNumericInput('.')).toBeNull();
  });

  it('rejects Infinity and NaN text forms', () => {
    expect(parseNumericInput('Infinity')).toBeNull();
    expect(parseNumericInput('NaN')).toBeNull();
  });
});
