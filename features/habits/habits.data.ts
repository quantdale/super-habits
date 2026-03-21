import { getDatabase } from "@/core/db/client";
import { Habit, HabitCategory, HabitCompletion, HabitIcon } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from "@/features/habits/habitPresets";

const CATEGORY_ORDER = "CASE category WHEN 'anytime' THEN 0 WHEN 'morning' THEN 1 WHEN 'afternoon' THEN 2 WHEN 'evening' THEN 3 ELSE 4 END";

export async function listHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(
    `SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY ${CATEGORY_ORDER}, created_at DESC`,
  );
}

export async function addHabit(
  name: string,
  targetPerDay: number,
  category: HabitCategory = "anytime",
  icon: HabitIcon = DEFAULT_HABIT_ICON,
  color: string = DEFAULT_HABIT_COLOR,
): Promise<void> {
  const id = createId("habit");
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO habits (id, name, target_per_day, reminder_time, category, icon, color, created_at, updated_at, deleted_at) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)",
    [id, name, targetPerDay, category, icon, color, now, now],
  );
  syncEngine.enqueue({ entity: "habits", id, updatedAt: now, operation: "create" });
}

export async function incrementHabit(habitId: string, dateKey = toDateKey()): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    "SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  if (existing) {
    await db.runAsync("UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?", [
      existing.count + 1,
      now,
      existing.id,
    ]);
    return;
  }
  await db.runAsync(
    "INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    [createId("hcmp"), habitId, dateKey, now, now],
  );
}

export async function decrementHabit(habitId: string, dateKey = toDateKey()): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  const existing = await db.getFirstAsync<{ id: string; count: number }>(
    "SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  if (!existing || existing.count <= 0) return;
  if (existing.count === 1) {
    // Hard delete intentional: habit_completions is a toggle-off
    // operation (non-synced entity, allowed exception per db-and-sync-invariants)
    await db.runAsync("DELETE FROM habit_completions WHERE id = ?", [existing.id]);
    return;
  }
  await db.runAsync("UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?", [
    existing.count - 1,
    now,
    existing.id,
  ]);
}

export async function getHabitCountByDate(habitId: string, dateKey = toDateKey()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  return row?.count ?? 0;
}

export async function getCompletionHistory(
  habitId: string,
  days: number = 30,
): Promise<HabitCompletion[]> {
  const db = await getDatabase();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(new Date());

  return db.getAllAsync<HabitCompletion>(
    `SELECT * FROM habit_completions
     WHERE habit_id = ?
       AND date_key >= ?
       AND date_key <= ?
     ORDER BY date_key ASC`,
    [habitId, startKey, endKey],
  );
}

export async function updateHabit(
  habitId: string,
  updates: {
    name: string;
    targetPerDay: number;
    category: HabitCategory;
    icon?: HabitIcon;
    color?: string;
  },
): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE habits SET name = ?, target_per_day = ?, category = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?",
    [
      updates.name,
      updates.targetPerDay,
      updates.category,
      updates.icon ?? DEFAULT_HABIT_ICON,
      updates.color ?? DEFAULT_HABIT_COLOR,
      now,
      habitId,
    ],
  );
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "update" });
}

export async function deleteHabit(habitId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync("UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, habitId]);
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "delete" });
}
