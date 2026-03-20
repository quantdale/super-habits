import type { CalorieEntryTotals } from "./types";

/**
 * (protein × 4) + ((carbs − fiber) × 4) + (fiber × 2) + (fat × 9)
 * When carbs is less than fiber, (carbs − fiber) is clamped to 0 so digestible carbs are not negative.
 */
export function kcalFromMacros(
  proteinG: number,
  carbsG: number,
  fatsG: number,
  fiberG: number,
): number {
  const digestibleCarbG = Math.max(0, carbsG - fiberG);
  return Math.max(
    0,
    Math.round(
      proteinG * 4 + digestibleCarbG * 4 + fiberG * 2 + fatsG * 9,
    ),
  );
}

export function caloriesTotal(entries: CalorieEntryTotals[]): number {
  return entries.reduce((sum, entry) => sum + entry.calories, 0);
}
