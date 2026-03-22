/**
 * Get tomorrow's date key as YYYY-MM-DD (local date).
 */
export function getTomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Get today's date key as YYYY-MM-DD (local date).
 * Inline implementation — no toDateKey() import (domain purity).
 */
export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Determine which recurrence_ids need a new instance today.
 * Returns the set of recurrence_ids that have no active
 * (non-deleted, non-completed) instance with due_date = today.
 *
 * activeTodos: all non-deleted todos (completed and pending)
 * todayKey: today's date key
 */
export function findMissingRecurrenceIds(
  activeTodos: Array<{
    recurrence_id: string | null;
    recurrence: string | null;
    due_date: string | null;
    deleted_at: string | null;
  }>,
  todayKey: string,
): string[] {
  const allRecurrenceIds = new Set<string>();
  for (const t of activeTodos) {
    if (t.recurrence === "daily" && t.recurrence_id) {
      allRecurrenceIds.add(t.recurrence_id);
    }
  }

  const coveredToday = new Set<string>();
  for (const t of activeTodos) {
    if (t.recurrence_id && t.due_date === todayKey && t.deleted_at === null) {
      coveredToday.add(t.recurrence_id);
    }
  }

  return Array.from(allRecurrenceIds).filter((id) => !coveredToday.has(id));
}

/**
 * Check if a todo is part of a recurring series.
 */
export function isRecurring(todo: { recurrence: string | null }): boolean {
  return todo.recurrence === "daily";
}
