import { getDatabase } from "@/core/db/client";
import { CalorieEntry } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export type DailySummary = {
  dateKey: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalFiber: number;
};

export async function getCalorieSummaryByRange(
  startDateKey: string,
  endDateKey: string,
): Promise<DailySummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailySummary>(
    `SELECT
       consumed_on            AS dateKey,
       SUM(calories)          AS totalCalories,
       SUM(protein)           AS totalProtein,
       SUM(carbs)             AS totalCarbs,
       SUM(fats)              AS totalFats,
       SUM(fiber)             AS totalFiber
     FROM calorie_entries
     WHERE deleted_at IS NULL
       AND consumed_on >= ?
       AND consumed_on <= ?
     GROUP BY consumed_on
     ORDER BY consumed_on ASC`,
    [startDateKey, endDateKey],
  );
}

export type CalorieGoal = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

const GOAL_KEY = "calorie_goal";
export const DEFAULT_GOAL: CalorieGoal = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fats: 65,
};

export async function getCalorieGoal(): Promise<CalorieGoal> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [GOAL_KEY],
  );
  if (!row) return DEFAULT_GOAL;
  try {
    return JSON.parse(row.value) as CalorieGoal;
  } catch {
    return DEFAULT_GOAL;
  }
}

export async function setCalorieGoal(goal: CalorieGoal): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`, [
    GOAL_KEY,
    JSON.stringify(goal),
  ]);
}

export async function listCalorieEntries(dateKey = toDateKey()): Promise<CalorieEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<CalorieEntry>(
    "SELECT * FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = ? ORDER BY created_at DESC",
    [dateKey],
  );
}

export async function addCalorieEntry(input: {
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  consumedOn?: string;
}): Promise<void> {
  const id = createId("cal");
  const now = nowIso();
  const consumedOn = input.consumedOn ?? toDateKey();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)",
    [
      id,
      input.foodName,
      input.calories,
      input.protein ?? 0,
      input.carbs ?? 0,
      input.fats ?? 0,
      input.fiber ?? 0,
      input.mealType,
      consumedOn,
      now,
      now,
    ],
  );
  syncEngine.enqueue({ entity: "calorie_entries", id, updatedAt: now, operation: "create" });
}

export async function deleteCalorieEntry(id: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync("UPDATE calorie_entries SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, id]);
  syncEngine.enqueue({ entity: "calorie_entries", id, updatedAt: now, operation: "delete" });
}
