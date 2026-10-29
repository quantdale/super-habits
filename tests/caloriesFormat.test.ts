import { describe, expect, it } from 'vitest';
import { formatGrams } from '@/features/calories/caloriesFormat';

describe('formatGrams (macro card display rounding)', () => {
  it('renders a float macro sum as whole grams (F1: 12.3 + 4.4 + 3.3)', () => {
    expect(formatGrams(12.3 + 4.4 + 3.3)).toBe('20');
    expect(formatGrams(12.3 + 4.4 + 3.3)).not.toContain('.');
  });

  it('renders the classic 0.1 + 0.2 float-noise sum as 0', () => {
    expect(formatGrams(0.1 + 0.2)).toBe('0');
  });

  it('rounds a float over-target difference (the caption case)', () => {
    expect(formatGrams(20.000000000000004 - 20)).toBe('0');
    expect(formatGrams(155.2 - 150.1)).toBe('5');
  });

  it('keeps already-whole gram values identical to the pinned E2E strings', () => {
    expect(formatGrams(95)).toBe('95');
    expect(formatGrams(150)).toBe('150');
    expect(formatGrams(5)).toBe('5');
  });

  it('rounds half grams the way the other calories surfaces do (Math.round)', () => {
    expect(formatGrams(180.5)).toBe('181');
    expect(formatGrams(0.4)).toBe('0');
    expect(formatGrams(0.6)).toBe('1');
  });

  it('renders non-finite input as 0 instead of NaN', () => {
    expect(formatGrams(Number.NaN)).toBe('0');
    expect(formatGrams(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
