import { getDatabase } from "@/core/db/client";
import { Habit } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export async function listHabits(): Promise<Habit[]> {
  const db = await getDatabase();
  return db.getAllAsync<Habit>(
    "SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
}

export async function addHabit(name: string, targetPerDay: number): Promise<void> {
  const id = createId("habit");
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO habits (id, name, target_per_day, reminder_time, created_at, updated_at, deleted_at) VALUES (?, ?, ?, NULL, ?, ?, NULL)",
    [id, name, targetPerDay, now, now],
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
    [createId("habit_completion"), habitId, dateKey, now, now],
  );
}

export async function getHabitCountByDate(habitId: string, dateKey = toDateKey()): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  return row?.count ?? 0;
}

export async function deleteHabit(habitId: string): Promise<void> {
  const now = nowIso();
  const db = await getDatabase();
  await db.runAsync("UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, habitId]);
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "delete" });
}
