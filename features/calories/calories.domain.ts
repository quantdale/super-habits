import type { DailySummary } from "./calories.data";
import type { SavedMeal } from "@/core/db/types";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${dd}`);
  }
  return result;
}

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

export function caloriesTotal(entries: { calories: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.calories, 0);
}

export function buildWeeklyTrend(
  summaries: DailySummary[],
  days: number = 7,
): { dateKey: string; value: number; label: string }[] {
  const map = new Map<string, number>();
  for (const s of summaries) {
    map.set(s.dateKey, s.totalCalories);
  }

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${day}`;
    const label = d.toLocaleDateString("en", { weekday: "short" });
    result.push({ dateKey, value: map.get(dateKey) ?? 0, label });
  }
  return result;
}

export type MacroSlice = {
  /** Percent of total macro kcal (0–100), adjusted so slices sum to 100. */
  value: number;
  /** Energy from this macro (same basis as kcalFromMacros). */
  kcal: number;
  color: string;
  label: string;
  /** Grams shown in the legend — carbs use digestible grams (carbs − fiber). */
  grams: number;
};

export function buildMacroDonutData(
  protein: number,
  carbs: number,
  fats: number,
  fiber: number,
): MacroSlice[] {
  const digestibleCarbs = Math.max(0, carbs - fiber);
  const proteinKcal = protein * 4;
  const carbsKcal = digestibleCarbs * 4;
  const fiberKcal = fiber * 2;
  const fatsKcal = fats * 9;
  const totalKcal = proteinKcal + carbsKcal + fiberKcal + fatsKcal;

  if (totalKcal === 0) return [];

  const raw = [
    { kcal: proteinKcal, color: "#4f79ff", label: "Protein" as const, grams: protein },
    { kcal: carbsKcal, color: "#f59e0b", label: "Carbs" as const, grams: digestibleCarbs },
    { kcal: fatsKcal, color: "#10b981", label: "Fats" as const, grams: fats },
    { kcal: fiberKcal, color: "#8b5cf6", label: "Fiber" as const, grams: fiber },
  ];

  const nonZero = raw.filter((s) => s.kcal > 0);
  if (nonZero.length === 0) return [];

  const slices: MacroSlice[] = nonZero.map((s) => ({
    ...s,
    value: Math.round((s.kcal / totalKcal) * 100),
  }));

  const pctSum = slices.reduce((acc, s) => acc + s.value, 0);
  if (slices.length > 0 && pctSum !== 100) {
    slices[slices.length - 1].value += 100 - pctSum;
  }

  return slices;
}

export function calculateGoalProgress(
  actual: number,
  goal: number,
): { percent: number; remaining: number; over: boolean } {
  if (goal <= 0) return { percent: 0, remaining: 0, over: false };
  const percent = Math.min(100, Math.round((actual / goal) * 100));
  return {
    percent,
    remaining: Math.max(0, goal - actual),
    over: actual > goal,
  };
}

/**
 * Client-side filter for saved meals search.
 * Used to filter the already-loaded list without a DB round-trip
 * when the user types in the search input.
 */
export function filterSavedMeals(meals: SavedMeal[], query: string): SavedMeal[] {
  if (!query.trim()) return meals;
  const q = query.trim().toLowerCase();
  return meals.filter((m) => m.food_name.toLowerCase().includes(q));
}

/**
 * Build ActivityDay array from daily summaries.
 * A day is "active" if any calories were logged.
 * value = min(1, totalCalories / goalCalories) for intensity.
 */
export function buildCalorieActivityDays(
  summaries: DailySummary[],
  goalCalories: number = 2000,
  days: number = 30,
): ActivityDay[] {
  const map = new Map<string, number>();
  for (const s of summaries) {
    map.set(s.dateKey, s.totalCalories);
  }
  return buildDateRange(days).map((dateKey) => {
    const cal = map.get(dateKey) ?? 0;
    return {
      dateKey,
      active: cal > 0,
      value:
        goalCalories > 0 ? Math.min(1, cal / goalCalories) : cal > 0 ? 1 : 0,
    };
  });
}
