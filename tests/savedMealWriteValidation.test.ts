import { describe, it, expect } from 'vitest';
import { assertCalorieEntryWrite } from '@/lib/validation';

/**
 * Saved-meal write contract: `upsertSavedMeal` stores the same columns as
 * the ledger (food_name, calories, protein, carbs, fats, fiber, meal_type)
 * and is fed by the same form path, so it must enforce the same contract
 * with the same messages. The data layer reuses the shared
 * `assertCalorieEntryWrite` (no new helper, no message drift) — these
 * tests pin that the shared assert covers every saved-meal-shaped
 * payload the direct upsert path can receive.
 */

const VALID_SAVED_MEAL = {
  foodName: 'Chicken salad',
  protein: 38,
  carbs: 18,
  fats: 26,
  fiber: 4,
  calories: 480,
  mealType: 'lunch',
};

describe('saved-meal write contract (shared ledger assert)', () => {
  it('rejects invalid saved-meal payloads with the exact UI messages', () => {
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, foodName: '  ' })).toThrow(
      'Food name is required.',
    );
    expect(() =>
      assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, foodName: 'A'.repeat(101) }),
    ).toThrow('Food name must be 100 characters or less.');
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, protein: -2 })).toThrow(
      'Protein must be 0 or greater.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, carbs: NaN })).toThrow(
      'Carbs must be 0 or greater.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, fats: 1000 })).toThrow(
      'Fats value seems too high (max 999g).',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, fiber: 1000 })).toThrow(
      'Fiber value seems too high (max 999g).',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, calories: 0 })).toThrow(
      'Enter macro amounts so calories are greater than zero.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, calories: 10000 })).toThrow(
      'Calories cannot exceed 9999 kcal.',
    );
    expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, mealType: 'brunch' })).toThrow(
      'Choose a supported meal type.',
    );
  });

  it('passes valid saved-meal payloads for every meal type', () => {
    for (const mealType of ['breakfast', 'lunch', 'dinner', 'snack']) {
      expect(() => assertCalorieEntryWrite({ ...VALID_SAVED_MEAL, mealType })).not.toThrow();
    }
  });
});
