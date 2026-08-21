import type { CalorieGoal, DailySummary, SavedMeal } from './types';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
import { SECTION_COLORS } from '@/constants/sectionColors';
import { buildDateRange, buildDateRangeOldestFirst } from '@/lib/time';

export const DEFAULT_CALORIE_GOAL: CalorieGoal = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fats: 65,
};

function boundedGoalNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

/** Normalize persisted goals so malformed app_meta JSON cannot create NaN UI math. */
export function normalizeCalorieGoal(value: unknown): CalorieGoal {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    calories: boundedGoalNumber(candidate.calories, DEFAULT_CALORIE_GOAL.calories, 500, 6000),
    protein: boundedGoalNumber(candidate.protein, DEFAULT_CALORIE_GOAL.protein, 0, 999),
    carbs: boundedGoalNumber(candidate.carbs, DEFAULT_CALORIE_GOAL.carbs, 0, 999),
    fats: boundedGoalNumber(candidate.fats, DEFAULT_CALORIE_GOAL.fats, 0, 999),
  };
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
  return Math.max(0, Math.round(proteinG * 4 + digestibleCarbG * 4 + fiberG * 2 + fatsG * 9));
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
export function buildDailyTrend(summaries: DailySummary[], days: number = 365): DailyTrendPoint[] {
  const map = new Map<string, number>();
  for (const s of summaries) {
    map.set(s.dateKey, s.totalCalories);
  }

  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const d = new Date(`${dateKey}T12:00:00`);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    { kcal: proteinKcal, color: SECTION_COLORS.todos, label: 'Protein' as const, grams: protein },
    { kcal: carbsKcal, color: SECTION_COLORS.calories, label: 'Carbs' as const, grams: carbs },
    { kcal: fatsKcal, color: SECTION_COLORS.workout, label: 'Fats' as const, grams: fats },
    { kcal: fiberKcal, color: SECTION_COLORS.habits, label: 'Fiber' as const, grams: fiber },
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
 * Editable daily macro targets (AsyncStorage-backed, separate from the
 * synced calorie goal). Same shape and bounds as CalorieGoal.
 */
export type MacroTargets = CalorieGoal;

/** Targets fall back to the calorie goal when unset or malformed. */
export function normalizeMacroTargets(value: unknown): MacroTargets | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const hasAnyField = ['calories', 'protein', 'carbs', 'fats'].some(
    (key) => typeof candidate[key] === 'number',
  );
  if (!hasAnyField) return null;
  return normalizeCalorieGoal(candidate);
}

export type TargetProgress = {
  percent: number;
  remaining: number;
  over: boolean;
};

/** Per-macro progress toward a daily target; a non-positive target hides the bar. */
export function buildTargetProgress(actual: number, target: number): TargetProgress {
  if (!Number.isFinite(target) || target <= 0) {
    return { percent: 0, remaining: 0, over: false };
  }
  const safeActual = Number.isFinite(actual) && actual > 0 ? actual : 0;
  return {
    percent: Math.min(100, Math.round((safeActual / target) * 100)),
    remaining: Math.max(0, Math.round(target - safeActual)),
    over: safeActual > target,
  };
}

/**
 * Client-side filter for saved meals search.
 * Used to filter the already-loaded list without a DB round-trip
 * when the user types in the search input.
 * Matches the food name and the optional "Category:" name prefix.
 */
export function filterSavedMeals(meals: SavedMeal[], query: string): SavedMeal[] {
  if (!query.trim()) return meals;
  const q = query.trim().toLowerCase();
  return meals.filter((m) => {
    const { category } = parseMealCategory(m.food_name);
    return (
      m.food_name.toLowerCase().includes(q) ||
      (category !== null && category.toLowerCase().includes(q))
    );
  });
}

/**
 * Category convention: a leading "Category:" prefix in the food name
 * (e.g. "Breakfast: overnight oats"). No schema change needed — the
 * category lives in the existing food_name column. Returns the raw name
 * unchanged when no valid prefix is present.
 */
export function parseMealCategory(foodName: string): { category: string | null; name: string } {
  const match = /^([^:#\n]{1,24}):\s*([^\n].*)$/.exec(foodName.trim());
  if (!match) return { category: null, name: foodName };
  const category = match[1].trim();
  const name = match[2].trim();
  if (!category || !name) return { category: null, name: foodName };
  return { category, name };
}

/** Distinct categories in stable alphabetical order (nulls last). */
export function listSavedMealCategories(meals: SavedMeal[]): string[] {
  const categories = new Set<string>();
  for (const meal of meals) {
    const { category } = parseMealCategory(meal.food_name);
    if (category !== null) categories.add(category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b));
}

/**
 * Search-result ordering: names starting with the query first (when a query
 * is given), then most-used, then most-recently-used, then alphabetical.
 */
export function sortSavedMealsForSearch(meals: SavedMeal[], query: string = ''): SavedMeal[] {
  const q = query.trim().toLowerCase();
  return [...meals].sort((a, b) => {
    if (q) {
      const aStarts = a.food_name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.food_name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
    }
    if (b.use_count !== a.use_count) return b.use_count - a.use_count;
    const byRecent = (b.last_used_at ?? '').localeCompare(a.last_used_at ?? '');
    if (byRecent !== 0) return byRecent;
    return a.food_name.localeCompare(b.food_name);
  });
}

export type MacroShare = {
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
};

/**
 * Percentage of total macro kcal per macro (carbs use total carbs × 4 so
 * fiber is not double-counted into the carb share). All zeros → all zeros.
 * Informational only.
 */
export function macroKcalShares(
  proteinG: number,
  carbsG: number,
  fatsG: number,
  fiberG: number,
): MacroShare {
  const proteinKcal = proteinG * 4;
  const carbsKcal = Math.max(0, carbsG - fiberG) * 4;
  const fiberKcal = fiberG * 2;
  const fatsKcal = fatsG * 9;
  const total = proteinKcal + carbsKcal + fiberKcal + fatsKcal;
  if (total <= 0) return { protein: 0, carbs: 0, fats: 0, fiber: 0 };
  const pct = (kcal: number) => Math.round((kcal / total) * 100);
  return {
    protein: pct(proteinKcal),
    carbs: pct(carbsKcal),
    fats: pct(fatsKcal),
    fiber: pct(fiberKcal),
  };
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
      value: goalCalories > 0 ? Math.min(1, cal / goalCalories) : cal > 0 ? 1 : 0,
    };
  });
}

export type MacroDayPoint = {
  dateKey: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MacroTrendSummary = {
  windowDays: number;
  /** Calendar days in the window that had at least one logged entry. */
  daysWithData: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFats: number;
};

/**
 * Per-day macro totals for the last `days` calendar days (oldest → newest).
 * Days without entries are zero-filled so windows stay aligned.
 */
export function buildMacroTrendPoints(summaries: DailySummary[], days: number): MacroDayPoint[] {
  const map = new Map<string, DailySummary>();
  for (const s of summaries) {
    map.set(s.dateKey, s);
  }

  return buildDateRangeOldestFirst(days).map((dateKey) => {
    const s = map.get(dateKey);
    const d = new Date(`${dateKey}T12:00:00`);
    return {
      dateKey,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      calories: s?.totalCalories ?? 0,
      protein: s?.totalProtein ?? 0,
      carbs: s?.totalCarbs ?? 0,
      fats: s?.totalFats ?? 0,
    };
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Rolling averages across the full calendar window (zero days count toward
 * the divisor so the average reflects real intake frequency).
 */
export function summarizeMacroTrend(points: MacroDayPoint[]): MacroTrendSummary {
  const windowDays = points.length;
  if (windowDays === 0) {
    return {
      windowDays: 0,
      daysWithData: 0,
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
    };
  }
  const sum = points.reduce(
    (acc, p) => ({
      calories: acc.calories + p.calories,
      protein: acc.protein + p.protein,
      carbs: acc.carbs + p.carbs,
      fats: acc.fats + p.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
  return {
    windowDays,
    daysWithData: points.filter((p) => p.calories > 0).length,
    avgCalories: Math.round(sum.calories / windowDays),
    avgProtein: round1(sum.protein / windowDays),
    avgCarbs: round1(sum.carbs / windowDays),
    avgFats: round1(sum.fats / windowDays),
  };
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
