import type { HabitCompletion } from "./types";

export type DayCompletion = {
  dateKey: string; // YYYY-MM-DD
  count: number;
  completed: boolean; // true if count >= targetPerDay (strict rule)
};

export function calculateHabitProgress(count: number, targetPerDay: number): number {
  if (targetPerDay <= 0) return 0;
  return Math.min(1, count / targetPerDay);
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Build a full 30-day (or N-day) grid of DayCompletion objects
 * including days with zero completions (not just days with records).
 * Used for heatmap rendering — every day in range must have an entry.
 */
export function buildDayCompletions(
  completions: HabitCompletion[],
  targetPerDay: number,
  days: number = 30,
): DayCompletion[] {
  const map = new Map<string, number>();
  for (const c of completions) {
    map.set(c.date_key, c.count);
  }

  const result: DayCompletion[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = localDateKey(d);
    const count = map.get(dateKey) ?? 0;
    result.push({
      dateKey,
      count,
      completed: targetPerDay > 0 && count >= targetPerDay,
    });
  }
  return result;
}

/**
 * Calculate the current streak — consecutive days ending on today
 * (or yesterday if today has no completion yet) where count >= target.
 *
 * STRICT rule: a day only counts if count >= targetPerDay.
 * If targetPerDay <= 0, every day with count > 0 counts.
 *
 * Strategy: walk backwards from today. Stop at the first day
 * that is not completed. If today is not completed, check if
 * yesterday was — allow a 1-day grace so the streak doesn't
 * break just because today hasn't been logged yet.
 */
export function calculateCurrentStreak(dayCompletions: DayCompletion[]): number {
  if (dayCompletions.length === 0) return 0;

  const days = [...dayCompletions].reverse();

  let streak = 0;
  let allowedGap = 1;

  for (const day of days) {
    if (day.completed) {
      streak++;
      allowedGap = 0;
    } else {
      if (allowedGap > 0) {
        allowedGap--;
        continue;
      }
      break;
    }
  }

  return streak;
}

/**
 * Calculate the longest streak ever achieved in the provided
 * day completion history.
 */
export function calculateLongestStreak(dayCompletions: DayCompletion[]): number {
  let longest = 0;
  let current = 0;

  for (const day of dayCompletions) {
    if (day.completed) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }

  return longest;
}

/**
 * Returns a display label for the streak count.
 * Used in HabitCircle below the ring.
 */
export function getStreakLabel(streak: number): string {
  if (streak === 0) return "";
  if (streak === 1) return "1 day";
  return `${streak} days`;
}
