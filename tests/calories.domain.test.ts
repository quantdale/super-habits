import { describe, expect, it } from "vitest";
import {
  kcalFromMacros,
  caloriesTotal,
  buildDailyTrend,
  buildMacroDonutData,
  calculateGoalProgress,
  filterSavedMeals,
  buildCalorieActivityDays,
  buildCalorieHeatmapDays,
} from "@/features/calories/calories.domain";
import type { DailySummary } from "@/features/calories/calories.data";
import type { SavedMeal } from "@/core/db/types";

function meal(name: string, useCount = 1): SavedMeal {
  return {
    id: `smeal_${name}`,
    food_name: name,
    calories: 200,
    protein: 20,
    carbs: 10,
    fats: 5,
    fiber: 2,
    meal_type: "breakfast",
    use_count: useCount,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

describe("caloriesTotal", () => {
  it("sums entries correctly", () => {
    const total = caloriesTotal([{ calories: 100 }, { calories: 250 }]);

    expect(total).toBe(350);
  });
});

describe("kcalFromMacros", () => {
  it("uses 4P + 4×max(0,C−F) + 2F + 9×fat", () => {
    expect(kcalFromMacros(0, 0, 0, 0)).toBe(0);
    expect(kcalFromMacros(10, 0, 0, 0)).toBe(40);
    expect(kcalFromMacros(0, 0, 10, 0)).toBe(90);
    expect(kcalFromMacros(0, 5, 0, 5)).toBe(10);
    expect(kcalFromMacros(0, 10, 0, 2)).toBe(36);
    expect(kcalFromMacros(10, 20, 5, 5)).toBe(155);
    expect(kcalFromMacros(0, 5, 0, 10)).toBe(20);
  });
});

describe("buildDailyTrend", () => {
  it("returns 365 entries by default", () => {
    expect(buildDailyTrend([])).toHaveLength(365);
  });

  it("fills missing days with 0", () => {
    const trend = buildDailyTrend([], 7);
    trend.forEach((d) => expect(d.value).toBe(0));
  });

  it("maps existing summary to correct day", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 1800,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const trend = buildDailyTrend(summaries, 7);
    const todayEntry = trend.find((t) => t.dateKey === todayKey);
    expect(todayEntry?.value).toBe(1800);
  });
});

describe("buildMacroDonutData", () => {
  it("returns empty array when all macros are 0", () => {
    expect(buildMacroDonutData(0, 0, 0, 0)).toHaveLength(0);
  });

  it("returns 4 slices, kcal from total carbs × 4, percents sum to 100 (P=30 C=50 F=10 Fi=5)", () => {
    const slices = buildMacroDonutData(30, 50, 10, 5);
    expect(slices).toHaveLength(4);
    expect(slices.reduce((s, sl) => s + sl.value, 0)).toBe(100);
    const p = slices.find((sl) => sl.label === "Protein");
    const c = slices.find((sl) => sl.label === "Carbs");
    const f = slices.find((sl) => sl.label === "Fats");
    const fi = slices.find((sl) => sl.label === "Fiber");
    expect(p?.kcal).toBe(120);
    expect(p?.grams).toBe(30);
    expect(c?.kcal).toBe(200);
    expect(c?.grams).toBe(50);
    expect(f?.kcal).toBe(90);
    expect(f?.grams).toBe(10);
    expect(fi?.kcal).toBe(10);
    expect(fi?.grams).toBe(5);
  });

  it("includes a carbs slice when fiber >= carbs (digestible would be 0)", () => {
    const slices = buildMacroDonutData(0, 10, 0, 10);
    expect(slices.find((sl) => sl.label === "Carbs")).toMatchObject({
      kcal: 40,
      grams: 10,
    });
  });

  it("drops macros with zero kcal from the donut list", () => {
    const slices = buildMacroDonutData(0, 0, 10, 0);
    expect(slices).toHaveLength(1);
    expect(slices[0]?.label).toBe("Fats");
    expect(slices.reduce((s, sl) => s + sl.value, 0)).toBe(100);
  });
});

describe("calculateGoalProgress", () => {
  it("returns 0 percent for zero goal", () => {
    expect(calculateGoalProgress(500, 0).percent).toBe(0);
  });

  it("calculates percent correctly", () => {
    expect(calculateGoalProgress(1000, 2000).percent).toBe(50);
  });

  it("caps at 100 percent when over goal", () => {
    expect(calculateGoalProgress(2500, 2000).percent).toBe(100);
  });

  it("flags over as true when actual exceeds goal", () => {
    expect(calculateGoalProgress(2500, 2000).over).toBe(true);
  });

  it("remaining is 0 when over goal", () => {
    expect(calculateGoalProgress(2500, 2000).remaining).toBe(0);
  });
});

describe("buildCalorieActivityDays", () => {
  it("marks days inactive with zero value when no summaries", () => {
    const days = buildCalorieActivityDays([], 2000, 7);
    expect(days).toHaveLength(7);
    expect(days.every((d) => !d.active && d.value === 0)).toBe(true);
  });

  it("sets active and caps value at 1 vs goal", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 1000,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const activity = buildCalorieActivityDays(summaries, 2000, 7);
    const todayEntry = activity.find((a) => a.dateKey === todayKey);
    expect(todayEntry?.active).toBe(true);
    expect(todayEntry?.value).toBe(0.5);
  });
});

describe("buildCalorieHeatmapDays", () => {
  it("maps calorie totals to intensity buckets vs goal", () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;
    const summaries: DailySummary[] = [
      {
        dateKey: todayKey,
        totalCalories: 500,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        totalFiber: 0,
      },
    ];
    const heat = buildCalorieHeatmapDays(summaries, 2000, 30);
    const todayH = heat.find((h) => h.dateKey === todayKey);
    expect(todayH?.value).toBe(1);
  });
});

describe("filterSavedMeals", () => {
  const meals = [meal("Chicken breast"), meal("Chicken thigh"), meal("Oats"), meal("Greek yogurt")];

  it("returns all meals for empty query", () => {
    expect(filterSavedMeals(meals, "")).toHaveLength(4);
  });

  it("filters case-insensitively", () => {
    expect(filterSavedMeals(meals, "chicken")).toHaveLength(2);
    expect(filterSavedMeals(meals, "CHICKEN")).toHaveLength(2);
  });

  it("returns empty array when no match", () => {
    expect(filterSavedMeals(meals, "pizza")).toHaveLength(0);
  });

  it("returns single match", () => {
    const result = filterSavedMeals(meals, "oats");
    expect(result).toHaveLength(1);
    expect(result[0].food_name).toBe("Oats");
  });
});
