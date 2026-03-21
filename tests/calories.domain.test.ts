import { describe, expect, it } from "vitest";
import {
  kcalFromMacros,
  caloriesTotal,
  buildWeeklyTrend,
  buildMacroDonutData,
  calculateGoalProgress,
} from "@/features/calories/calories.domain";
import type { DailySummary } from "@/features/calories/calories.data";

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

describe("buildWeeklyTrend", () => {
  it("returns 7 entries", () => {
    expect(buildWeeklyTrend([], 7)).toHaveLength(7);
  });

  it("fills missing days with 0", () => {
    const trend = buildWeeklyTrend([], 7);
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
    const trend = buildWeeklyTrend(summaries, 7);
    const todayEntry = trend.find((t) => t.dateKey === todayKey);
    expect(todayEntry?.value).toBe(1800);
  });
});

describe("buildMacroDonutData", () => {
  it("returns empty array when all macros are 0", () => {
    expect(buildMacroDonutData(0, 0, 0, 0)).toHaveLength(0);
  });

  it("returns 4 slices when macros are non-zero", () => {
    const slices = buildMacroDonutData(30, 50, 10, 5);
    expect(slices).toHaveLength(4);
  });

  it("slice values sum to approximately 100", () => {
    const slices = buildMacroDonutData(30, 50, 10, 5);
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    expect(total).toBeGreaterThanOrEqual(98);
    expect(total).toBeLessThanOrEqual(102);
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
