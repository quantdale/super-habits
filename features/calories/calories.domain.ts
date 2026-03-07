import { CalorieEntry } from "@/core/db/types";

export function caloriesTotal(entries: CalorieEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.calories, 0);
}
