/**
 * Quick Capture's calorie write, extracted so the one-off-log contract is
 * driveable from a real-SQLite test and cannot drift back to the default.
 *
 * Quick Capture logs a kcal + food name and a meal slot — nothing else. That
 * is a one-off quick log, not a "use" of a reusable meal: it must never
 * create, rewrite, or re-rank a `saved_meals` catalog row. The default
 * `addCalorieEntry` behaviour exists for the full Calories form (explicit
 * macros → remembers the meal), and it upserts on the case-insensitive food
 * name — so a capture named "Oatmeal" used to OVERWRITE the user's saved
 * "Oatmeal" macros with the capture's numbers, bump `use_count`, and refresh
 * `last_used_at`, and undoing the capture left all of that behind.
 *
 * Same policy as the Calories kcal-only quick add, and for the same reason:
 * `{ maintainSavedMeal: false }`.
 */

import { addCalorieEntry } from '@/features/calories/calories.data';

export type QuickCaptureCalorieInput = {
  foodName: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

/**
 * Write the capture's diary row and return its id (the identity Undo deletes).
 * The ledger write is authoritative and unchanged; only the saved-meal
 * catalog maintenance is skipped.
 */
export async function submitQuickCaptureCalorie(input: QuickCaptureCalorieInput): Promise<string> {
  return addCalorieEntry(
    {
      foodName: input.foodName,
      calories: input.calories,
      mealType: input.mealType,
    },
    { maintainSavedMeal: false },
  );
}
