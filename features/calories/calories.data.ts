import { getDatabase } from "@/core/db/client";
import { CalorieEntry } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export function listCalorieEntries(dateKey = toDateKey()): CalorieEntry[] {
  return getDatabase().getAllSync<CalorieEntry>(
    "SELECT * FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = ? ORDER BY created_at DESC",
    [dateKey],
  );
}

export function addCalorieEntry(input: {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  consumedOn?: string;
}) {
  const id = createId("calorie");
  const now = nowIso();
  const consumedOn = input.consumedOn ?? toDateKey();
  getDatabase().runSync(
    "INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, meal_type, consumed_on, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    [
      id,
      input.foodName,
      input.calories,
      input.protein ?? 0,
      input.carbs ?? 0,
      input.fats ?? 0,
      input.mealType,
      consumedOn,
      now,
      now,
    ],
  );
  syncEngine.enqueue({ entity: "calorie_entries", id, updatedAt: now, operation: "create" });
}

export function deleteCalorieEntry(id: string) {
  const now = nowIso();
  getDatabase().runSync("UPDATE calorie_entries SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  syncEngine.enqueue({ entity: "calorie_entries", id, updatedAt: now, operation: "delete" });
}
