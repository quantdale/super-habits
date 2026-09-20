import { describe, it, expect } from 'vitest';
import {
  assertCalorieEntryWrite,
  validateCalorieComputedKcal,
  validateCalorieEntry,
  validateCalorieFoodName,
  validateCalorieMacroValue,
} from '@/lib/validation';

/**
 * Calorie-ledger data-layer write contract: the field validators extracted
 * for the data layer must preserve the exact UI messages,
 * `validateCalorieEntry` must compose them unchanged (including the
 * empty-string-macros-are-zero form behavior), and the throwing assert must
 * reject invalid writes with those same messages while passing valid input.
 */

const VALID = {
  foodName: 'Chicken salad',
  protein: 38,
  carbs: 18,
  fats: 26,
  fiber: 4,
  calories: 480,
  mealType: 'lunch',
};

describe('calorie field validators preserve UI messages', () => {
  it('validateCalorieFoodName matches the historic food-name messages', () => {
    expect(validateCalorieFoodName('')).toBe('Food name is required.');
    expect(validateCalorieFoodName('   ')).toBe('Food name is required.');
    expect(validateCalorieFoodName('A'.repeat(101))).toBe(
      'Food name must be 100 characters or less.',
    );
    expect(validateCalorieFoodName('A'.repeat(100))).toBeNull();
  });

  it('validateCalorieMacroValue matches the historic macro messages per label', () => {
    expect(validateCalorieMacroValue(NaN, 'Protein')).toBe('Protein must be 0 or greater.');
    expect(validateCalorieMacroValue(-1, 'Carbs')).toBe('Carbs must be 0 or greater.');
    expect(validateCalorieMacroValue(1000, 'Fats')).toBe('Fats value seems too high (max 999g).');
    expect(validateCalorieMacroValue(1000, 'Fiber')).toBe('Fiber value seems too high (max 999g).');
    expect(validateCalorieMacroValue(0, 'Protein')).toBeNull();
    expect(validateCalorieMacroValue(999, 'Fiber')).toBeNull();
  });

  it('validateCalorieEntry composes the field validators unchanged', () => {
    expect(validateCalorieEntry('', '10', '10', '10', '0')).toBe('Food name is required.');
    expect(validateCalorieEntry('A'.repeat(101), '10', '10', '10', '0')).toBe(
      'Food name must be 100 characters or less.',
    );
    expect(validateCalorieEntry('Ok', '-1', '10', '10', '0')).toBe('Protein must be 0 or greater.');
    expect(validateCalorieEntry('Ok', '10', 'abc', '10', '0')).toBe('Carbs must be 0 or greater.');
    expect(validateCalorieEntry('Ok', '10', '10', '1000', '0')).toBe(
      'Fats value seems too high (max 999g).',
    );
    // Empty macro strings are treated as 0 by the entry form (historic).
    expect(validateCalorieEntry('Ok', '', '', '', '')).toBeNull();
    expect(validateCalorieEntry('Chicken salad', '38', '18', '26', '4')).toBeNull();
  });

  it('validateCalorieComputedKcal keeps the historic kcal messages', () => {
    expect(validateCalorieComputedKcal(NaN)).toBe('Calories could not be calculated from macros.');
    expect(validateCalorieComputedKcal(0)).toBe(
      'Enter macro amounts so calories are greater than zero.',
    );
    expect(validateCalorieComputedKcal(10000)).toBe('Calories cannot exceed 9999 kcal.');
    expect(validateCalorieComputedKcal(480)).toBeNull();
  });
});

describe('assertCalorieEntryWrite', () => {
  it('throws the exact UI message for each invalid field', () => {
    expect(() => assertCalorieEntryWrite({ ...VALID, foodName: '  ' })).toThrow(
      'Food name is required.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, foodName: 'A'.repeat(101) })).toThrow(
      'Food name must be 100 characters or less.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, protein: -2 })).toThrow(
      'Protein must be 0 or greater.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, carbs: NaN })).toThrow(
      'Carbs must be 0 or greater.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, fats: 1000 })).toThrow(
      'Fats value seems too high (max 999g).',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, fiber: 1000 })).toThrow(
      'Fiber value seems too high (max 999g).',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, calories: 0 })).toThrow(
      'Enter macro amounts so calories are greater than zero.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, calories: 10000 })).toThrow(
      'Calories cannot exceed 9999 kcal.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID, mealType: 'brunch' })).toThrow(
      'Choose a supported meal type.',
    );
  });

  it('passes valid resolved writes for every meal type', () => {
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      expect(() => assertCalorieEntryWrite({ ...VALID, mealType })).not.toThrow();
    }
    expect(() =>
      assertCalorieEntryWrite({ ...VALID, protein: 0, carbs: 0, fats: 0, fiber: 0, calories: 1 }),
    ).not.toThrow();
  });
});
