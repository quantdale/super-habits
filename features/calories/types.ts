export type { CalorieEntry } from "@/core/db/types";

export type MealType = import("@/core/db/types").CalorieEntry["meal_type"];

/** Minimal shape for caloriesTotal — domain rollup only. */
export type CalorieEntryTotals = {
  calories: number;
};

export type { DailySummary, CalorieGoal } from "./calories.data";
export type { MacroSlice } from "./calories.domain";
