export type { CalorieEntry, SavedMeal } from "@/core/db/types";

export type MealType = import("@/core/db/types").CalorieEntry["meal_type"];

/** Minimal shape for caloriesTotal — domain rollup only. */
export type CalorieEntryTotals = {
  calories: number;
};

/** One row per calendar day from calorie_entries aggregates. */
export type DailySummary = {
  dateKey: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalFiber: number;
};

export type CalorieGoal = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};
