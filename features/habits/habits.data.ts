import { getDatabase } from "@/core/db/client";
import { Habit } from "@/core/db/types";
import { createId } from "@/lib/id";
import { nowIso, toDateKey } from "@/lib/time";
import { syncEngine } from "@/core/sync/sync.engine";

export function listHabits(): Habit[] {
  return getDatabase().getAllSync<Habit>(
    "SELECT * FROM habits WHERE deleted_at IS NULL ORDER BY created_at DESC",
  );
}

export function addHabit(name: string, targetPerDay: number) {
  const id = createId("habit");
  const now = nowIso();
  getDatabase().runSync(
    "INSERT INTO habits (id, name, target_per_day, reminder_time, created_at, updated_at, deleted_at) VALUES (?, ?, ?, NULL, ?, ?, NULL)",
    [id, name, targetPerDay, now, now],
  );
  syncEngine.enqueue({ entity: "habits", id, updatedAt: now, operation: "create" });
}

export function incrementHabit(habitId: string, dateKey = toDateKey()) {
  const db = getDatabase();
  const now = nowIso();
  const existing = db.getFirstSync<{ id: string; count: number }>(
    "SELECT id, count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  if (existing) {
    db.runSync("UPDATE habit_completions SET count = ?, updated_at = ? WHERE id = ?", [
      existing.count + 1,
      now,
      existing.id,
    ]);
    return;
  }
  db.runSync(
    "INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
    [createId("habit_completion"), habitId, dateKey, now, now],
  );
}

export function getHabitCountByDate(habitId: string, dateKey = toDateKey()): number {
  const row = getDatabase().getFirstSync<{ count: number }>(
    "SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey],
  );
  return row?.count ?? 0;
}

export function deleteHabit(habitId: string) {
  const now = nowIso();
  getDatabase().runSync("UPDATE habits SET deleted_at = ?, updated_at = ? WHERE id = ?", [now, now, habitId]);
  syncEngine.enqueue({ entity: "habits", id: habitId, updatedAt: now, operation: "delete" });
}
