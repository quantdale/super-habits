import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import { parseNumericInput } from '@/lib/numericInput';
import { resolveEntryKcal } from '@/features/calories/calories.domain';
import { validateCalorieComputedKcal, validateCalorieEntry } from '@/lib/validation';

/**
 * Saved-meal / frequent-food prefill against the whole-gram form contract.
 *
 * The ledger legitimately stores fractional macros: the command parser accepts
 * "add breakfast: oats 350 cal 12.5 g protein" and `assertCalorieEntryWrite`
 * allows any finite non-negative macro <= 999. `addCalorieEntry` mirrors that
 * row into `saved_meals`, and the Frequent rollup replays it.
 *
 * Tapping such a meal prefilled the RAW numbers ("12.5") into integer-only
 * macro fields, and submit parses with integer-only `parseNumericInput`, which
 * returns null for "12.5" and the screen substitutes 0. The draft then fails
 * validation with "Protein must be a whole number." and the kcal display
 * collapses to 0 — a one-tap re-log that cannot be saved, and cannot be fixed
 * by the user without retyping every macro.
 */
describe('fractional-macro saved meal stays re-loggable (real SQLite)', () => {
  /** Exactly what the Calories screen does on prefill + submit. */
  function formSubmitFrom(draft: {
    food: string;
    protein: string;
    carbs: string;
    fats: string;
    fiber: string;
    effectiveKcal: number;
  }) {
    return {
      entryError: validateCalorieEntry(
        draft.food,
        draft.protein,
        draft.carbs,
        draft.fats,
        draft.fiber,
      ),
      kcalError: validateCalorieComputedKcal(draft.effectiveKcal),
      resolved: {
        protein: parseNumericInput(draft.protein) ?? 0,
        carbs: parseNumericInput(draft.carbs) ?? 0,
        fats: parseNumericInput(draft.fats) ?? 0,
        fiber: parseNumericInput(draft.fiber) ?? 0,
      },
    };
  }

  it('re-logs a command-path meal whose macros are fractional', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const { prefillDraftFromMeal } = await import('@/features/calories/calories.domain');

    // Writer-legal fractional row (what the command path stores).
    await calories.addCalorieEntry({
      foodName: 'Oats and milk',
      calories: 350,
      protein: 12.5,
      carbs: 20.5,
      fats: 8.5,
      fiber: 3.5,
      mealType: 'breakfast',
      consumedOn: '2026-11-19',
    });
    const meal = await db.getFirstAsync<{
      food_name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      fiber: number;
      meal_type: string;
    }>(`SELECT * FROM saved_meals WHERE food_name = 'Oats and milk'`);
    expect(meal?.protein).toBe(12.5);

    // The chip tap -> draft the user sees (and then submits unchanged).
    const draft = prefillDraftFromMeal(meal!);
    const submitted = formSubmitFrom({
      ...draft,
      effectiveKcal: resolveEntryKcal(draft.kcalSource, {
        protein: parseNumericInput(draft.protein) ?? 0,
        carbs: parseNumericInput(draft.carbs) ?? 0,
        fats: parseNumericInput(draft.fats) ?? 0,
        fiber: parseNumericInput(draft.fiber) ?? 0,
      }),
    });
    expect(submitted.entryError).toBeNull();
    expect(submitted.kcalError).toBeNull();
    expect(resolveEntryKcal(draft.kcalSource, submitted.resolved)).toBe(350);

    // Saving it writes a valid line with the meal's own kcal and whole grams.
    await calories.addCalorieEntry({
      foodName: draft.food,
      calories: resolveEntryKcal(draft.kcalSource, submitted.resolved),
      ...submitted.resolved,
      mealType: 'breakfast',
      consumedOn: '2026-11-20',
    });

    const logged = await db.getFirstAsync<{
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      fiber: number;
    }>(
      `SELECT calories, protein, carbs, fats, fiber FROM calorie_entries
       WHERE food_name = 'Oats and milk' AND consumed_on = '2026-11-20'`,
    );
    expect(logged).toEqual({ calories: 350, protein: 13, carbs: 21, fats: 9, fiber: 4 });
    await db.closeAsync();
  });
});
