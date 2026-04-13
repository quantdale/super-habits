import type { DailySummary, SavedMeal } from "./types";
import type { ActivityDay, HeatmapDay } from "@/features/shared/activityTypes";
import { SECTION_COLORS } from "@/constants/sectionColors";
import { buildDateRange, buildDateRangeOldestFirst } from "@/lib/time";

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
  return entries.reduce((sum, entry) => {
    const cal = entry.calories;
    if (!Number.isFinite(cal) || cal < 0) return sum;
    return sum + cal;
  }, 0);
}

export type DailyTrendPoint = {
  value: number;
  label: string;
  dateKey: string;
};

/**
 * Last `days` calendar days (oldest → newest), for bar charts.
 * Default 365 — one year of daily points for scrolling charts.
 * Labels are short month + day (e.g. "Mar 15") for x-axis readability.
 */
export function buildDailyTrend(
  summaries: DailySummary[],
  days: number = 365,
): DailyTrendPoint[] {
  const map = new Map<string, number>();
  for (const s of summaries) {
    map.set(s.dateKey, s.totalCalories);
  }

  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const d = new Date(`${dateKey}T12:00:00`);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return {
      dateKey,
      value: map.get(dateKey) ?? 0,
      label,
    };
  });
}

export type MacroSlice = {
  /** Percent of total macro kcal (0–100), adjusted so slices sum to 100. */
  value: number;
  /** Energy from this macro for split visualization (carbs use total carbs × 4; fiber separate). */
  kcal: number;
  color: string;
  label: string;
  /** Grams shown in the legend — carbs use total carbs grams. */
  grams: number;
};

/**
 * Builds macro split slices for charts that need proportional segments.
 * Carbs use total carbs × 4 kcal so a carb slice appears whenever carbs > 0
 * (digestible carbs can be 0 when fiber ≥ carbs). Fiber keeps its own slice.
 */
export function buildMacroDonutData(
  protein: number,
  carbs: number,
  fats: number,
  fiber: number,
): MacroSlice[] {
  const proteinKcal = protein * 4;
  const carbsKcal = carbs * 4;
  const fiberKcal = fiber * 2;
  const fatsKcal = fats * 9;
  const totalKcal = proteinKcal + carbsKcal + fiberKcal + fatsKcal;

  if (totalKcal === 0) return [];

  const raw = [
    { kcal: proteinKcal, color: SECTION_COLORS.todos, label: "Protein" as const, grams: protein },
    { kcal: carbsKcal, color: SECTION_COLORS.calories, label: "Carbs" as const, grams: carbs },
    { kcal: fatsKcal, color: SECTION_COLORS.workout, label: "Fats" as const, grams: fats },
    { kcal: fiberKcal, color: SECTION_COLORS.habits, label: "Fiber" as const, grams: fiber },
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
  days: number = 364,
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

export function buildCalorieHeatmapDays(
  summaries: DailySummary[],
  goalCalories: number = 2000,
  days: number = 364,
): HeatmapDay[] {
  const map = new Map<string, number>();
  for (const s of summaries) {
    map.set(s.dateKey, s.totalCalories);
  }
  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const cal = map.get(dateKey) ?? 0;
    if (cal === 0) return { dateKey, value: 0 };
    const pct = cal / goalCalories;
    if (pct < 0.33) return { dateKey, value: 1 };
    if (pct < 0.66) return { dateKey, value: 2 };
    return { dateKey, value: 3 };
  });
}
