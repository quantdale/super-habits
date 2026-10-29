import { describe, expect, it } from 'vitest';
import { kcalGoalDeltaLabel } from '@/features/health/health.domain';

describe('kcalGoalDeltaLabel', () => {
  it('shows how much over goal — never "0 left" — when eaten exceeds the goal', () => {
    expect(kcalGoalDeltaLabel(2_200, 2_000)).toBe('200 kcal over');
    expect(kcalGoalDeltaLabel(2_001, 2_000)).toBe('1 kcal over');
  });

  it('formats large over-goal amounts with the Calories screen grouping', () => {
    expect(kcalGoalDeltaLabel(4_321, 2_000)).toBe('2,321 kcal over');
  });

  it('keeps the under-goal copy unchanged ("X left")', () => {
    expect(kcalGoalDeltaLabel(1_500, 2_000)).toBe('500 left');
  });

  it('shows "0 left" exactly on goal', () => {
    expect(kcalGoalDeltaLabel(2_000, 2_000)).toBe('0 left');
  });
});
