import type { DailySummary } from "./calories.data";

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
  value: number;
  color: string;
  label: string;
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
  const total = proteinKcal + carbsKcal + fiberKcal + fatsKcal;

  if (total === 0) return [];

  return [
    {
      value: Math.round((proteinKcal / total) * 100),
      color: "#4f79ff",
      label: "Protein",
      grams: protein,
    },
    {
      value: Math.round((carbsKcal / total) * 100),
      color: "#f59e0b",
      label: "Carbs",
      grams: carbs,
    },
    {
      value: Math.round((fatsKcal / total) * 100),
      color: "#10b981",
      label: "Fats",
      grams: fats,
    },
    {
      value: Math.round((fiberKcal / total) * 100),
      color: "#8b5cf6",
      label: "Fiber",
      grams: fiber,
    },
  ];
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
