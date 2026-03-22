import type { HabitCompletion } from "./types";
import type { ActivityDay } from "@/features/shared/ActivityPreviewStrip";
import type { HeatmapDay } from "@/features/shared/GitHubHeatmap";

function buildDateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    result.push(`${y}-${m}-${dd}`);
  }
  return result;
}

function buildEmptyActivityDays(days: number): ActivityDay[] {
  return buildDateRange(days).map((dateKey) => ({
    dateKey,
    active: false,
  }));
}

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

/** YYYY-MM-DD keys from oldest to newest (inclusive), length = `days`. */
function buildDateRangeOldestFirst(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(localDateKey(d));
  }
  return result;
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

export type HabitGridRow = {
  habit: {
    id: string;
    name: string;
    color: string;
    target_per_day: number;
  };
  cells: DayCell[];
};

export type DayCell = {
  dateKey: string;
  count: number;
  completed: boolean;
  partial: boolean;
};

export type GridDateHeader = {
  dateKey: string;
  dayLabel: string;
  monthLabel: string | null;
  isToday: boolean;
};

/**
 * Build the date header row for the grid.
 * Returns 30 entries from oldest to newest.
 * Shows month label only on the 1st of each month.
 */
export function buildGridDateHeaders(days: number = 30): GridDateHeader[] {
  const headers: GridDateHeader[] = [];
  const todayKey = localDateKey(new Date());

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${dd}`;

    headers.push({
      dateKey,
      dayLabel: String(d.getDate()),
      monthLabel:
        d.getDate() === 1 ? d.toLocaleDateString("en", { month: "short" }) : null,
      isToday: dateKey === todayKey,
    });
  }
  return headers;
}

/**
 * Build the full habits × days grid for the overview.
 */
export function buildHabitGrid(
  habits: Array<{
    id: string;
    name: string;
    color: string;
    target_per_day: number;
  }>,
  completions: Array<{ habit_id: string; date_key: string; count: number }>,
  days: number = 364,
): HabitGridRow[] {
  const lookup = new Map<string, Map<string, number>>();
  for (const c of completions) {
    if (!lookup.has(c.habit_id)) {
      lookup.set(c.habit_id, new Map());
    }
    lookup.get(c.habit_id)!.set(c.date_key, c.count);
  }

  const dateKeys = buildDateRangeOldestFirst(days);

  return habits.map((habit) => {
    const habitMap = lookup.get(habit.id) ?? new Map<string, number>();
    const cells: DayCell[] = dateKeys.map((dateKey) => {
      const count = habitMap.get(dateKey) ?? 0;
      return {
        dateKey,
        count,
        completed: habit.target_per_day > 0 && count >= habit.target_per_day,
        partial: count > 0 && count < habit.target_per_day,
      };
    });
    return { habit, cells };
  });
}

/**
 * Overall consistency = completed cells / total possible cells (excluding future days).
 */
export function calculateOverallConsistency(grid: HabitGridRow[]): number {
  if (grid.length === 0) return 0;
  const todayKey = localDateKey(new Date());
  let completed = 0;
  let total = 0;
  for (const row of grid) {
    for (const cell of row.cells) {
      if (cell.dateKey > todayKey) continue;
      total++;
      if (cell.completed) completed++;
    }
  }
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Build a single aggregated HeatmapDay array for all habits.
 * A day's value reflects how many habits were completed:
 *   0 = no habits completed
 *   1 = some habits completed (< 50%)
 *   2 = most habits completed (50–99%)
 *   3 = all habits completed (100%)
 *
 * Uses existing HabitGridRow data — no new DB query needed.
 */
export function buildAggregatedHabitHeatmap(
  grid: HabitGridRow[],
  days: number = 364,
): HeatmapDay[] {
  if (grid.length === 0) {
    return buildDateRangeOldestFirst(days).map((dateKey) => ({
      dateKey,
      value: 0,
    }));
  }

  const dateKeys = buildDateRangeOldestFirst(days);

  return dateKeys.map((dateKey) => {
    let completed = 0;
    const total = grid.length;
    for (const row of grid) {
      const cell = row.cells.find((c) => c.dateKey === dateKey);
      if (cell?.completed) completed++;
    }
    if (completed === 0) return { dateKey, value: 0 };
    const pct = completed / total;
    if (pct < 0.5) return { dateKey, value: 1 };
    if (pct < 1.0) return { dateKey, value: 2 };
    return { dateKey, value: 3 };
  });
}

/**
 * Build ActivityDay array from the habits grid.
 * A day is "active" if at least one habit was completed.
 * value = fraction of habits completed that day (0–1).
 */
export function buildHabitActivityDays(grid: HabitGridRow[], days: number = 30): ActivityDay[] {
  if (grid.length === 0) return buildEmptyActivityDays(days);

  const dateKeys = grid[0].cells.map((c) => c.dateKey).reverse();

  return dateKeys.map((dateKey) => {
    let completed = 0;
    const total = grid.length;
    for (const row of grid) {
      const cell = row.cells.find((c) => c.dateKey === dateKey);
      if (cell?.completed) completed++;
    }
    return {
      dateKey,
      active: completed > 0,
      value: total > 0 ? completed / total : 0,
    };
  });
}
