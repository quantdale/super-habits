import { getDatabase } from '@/core/db/client';
import { getCalorieGoal } from '@/features/calories/calories.data';
import { countActiveGoals } from '@/features/goals/goals.data';
import { countActiveProjects } from '@/features/projects/projects.data';
import { buildProgressDateRange, PROGRESS_WINDOW_DAYS } from '@/features/progress/progress.domain';

export type ProgressRawData = {
  range: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
  todoCurrent: number;
  todoPrevious: number;
  habitCurrent: number;
  habitPrevious: number;
  focusMinutesCurrent: number;
  focusSessionsCurrent: number;
  focusMinutesPrevious: number;
  focusSessionsPrevious: number;
  workoutCurrent: number;
  workoutPrevious: number;
  calorieDaysCurrent: number;
  calorieDaysPrevious: number;
  weeklyCurrent: number;
  weeklyPrevious: number;
  activeProjects: number;
  activeGoals: number;
  goalsProgress: number;
  calorieGoal: number;
};

/**
 * Aggregate the raw counts behind Progress Insights from authoritative local
 * SQLite state. Pure data layer: no composition/derivation lives here (that
 * belongs in progress.summary.ts / progress.domain.ts). Half-open UTC bounds
 * are taken from buildProgressDateRange() so current/prior windows align with
 * the rest of the progress feature.
 */
export async function getProgressRawData(
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<ProgressRawData> {
  const db = await getDatabase();
  const range = buildProgressDateRange(new Date(), windowDays);

  const [
    todoCurrent,
    todoPrevious,
    habitCurrent,
    habitPrevious,
    focusMinutesCurrent,
    focusSessionsCurrent,
    focusMinutesPrevious,
    focusSessionsPrevious,
    workoutCurrent,
    workoutPrevious,
    calorieDaysCurrent,
    calorieDaysPrevious,
    weeklyCurrent,
    weeklyPrevious,
    activeProjects,
    activeGoals,
    goalsProgress,
    calorieGoal,
  ] = await Promise.all([
    countTodoCompletions(db, range.currentStartUtcIso, range.currentEndUtcExclusiveIso),
    countTodoCompletions(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
    countHabitCompletions(db, range.currentStart, range.currentEnd),
    countHabitCompletions(db, range.previousStart, range.previousEnd),
    sumFocusMinutes(db, range.currentStartUtcIso, range.currentEndUtcExclusiveIso),
    countFocusSessions(db, range.currentStartUtcIso, range.currentEndUtcExclusiveIso),
    sumFocusMinutes(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
    countFocusSessions(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
    countWorkouts(db, range.currentStartUtcIso, range.currentEndUtcExclusiveIso),
    countWorkouts(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
    countCalorieDays(db, range.currentStart, range.currentEnd),
    countCalorieDays(db, range.previousStart, range.previousEnd),
    countWeeklyReviews(db, range.currentStartUtcIso, range.currentEndUtcExclusiveIso),
    countWeeklyReviews(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
    countActiveProjects(),
    countActiveGoals(),
    averageGoalProgress(db),
    getCalorieGoal(),
  ]);

  return {
    range: {
      currentStart: range.currentStart,
      currentEnd: range.currentEnd,
      previousStart: range.previousStart,
      previousEnd: range.previousEnd,
    },
    todoCurrent,
    todoPrevious,
    habitCurrent,
    habitPrevious,
    focusMinutesCurrent,
    focusSessionsCurrent,
    focusMinutesPrevious,
    focusSessionsPrevious,
    workoutCurrent,
    workoutPrevious,
    calorieDaysCurrent,
    calorieDaysPrevious,
    weeklyCurrent,
    weeklyPrevious,
    activeProjects,
    activeGoals,
    goalsProgress,
    calorieGoal: calorieGoal.calories,
  };
}

async function countTodoCompletions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM todos
     WHERE deleted_at IS NULL AND completed = 1 AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return row?.count ?? 0;
}

/**
 * Count todos completed inside a half-open UTC window [startUtcIso,
 * endUtcExclusiveIso) — the same predicate Progress uses internally.
 *
 * F4: this is the canonical date-bounded completed-Todo counter. Intended
 * consumer: `retrieveDailyOverview(dateKey)` in features/command/
 * ask.retrieval.ts (command agent's file), which today reports the LIFETIME
 * total from `countCompletedTodos()` (features/todos/todos.data.ts — no date
 * bound) as a per-date fact. Integration spec for that call site:
 *   const { startUtcIso, endUtcExclusiveIso } =
 *     getUtcIsoRangeForLocalDateKeys(dateKey, dateKey);
 *   const completedCount = await countTodosCompletedBetween(startUtcIso, endUtcExclusiveIso);
 * i.e. derive the bounds from lib/time so any historical dateKey gets that
 * local calendar day's completions, matching overdueCount's date scoping.
 */
export async function countTodosCompletedBetween(
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const db = await getDatabase();
  return countTodoCompletions(db, startUtcIso, endUtcExclusiveIso);
}

/**
 * F3 decision (canonical history rule, shared with activityTimeline.data.ts):
 * completions are counted regardless of whether the habit was later
 * soft-deleted — no join to `habits` here, deliberately. History is preserved:
 * "a completion happened in this window" stays true after deletion, and the
 * Activity Timeline keeps rendering those past events via LEFT JOIN. Paused /
 * archived habits are also NOT excluded: these windows are historical facts,
 * not "today's obligations" (only current-state summaries like Overview's
 * shapeHabitsSummary filter on habits.status).
 */
async function countHabitCompletions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startDateKey: string,
  endDateKey: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM habit_completions
     WHERE date_key >= ? AND date_key <= ?`,
    [startDateKey, endDateKey],
  );
  return row?.count ?? 0;
}

async function sumFocusMinutes(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM pomodoro_sessions
     WHERE session_type = 'focus' AND started_at >= ? AND started_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return Math.round((row?.total ?? 0) / 60);
}

async function countFocusSessions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM pomodoro_sessions
     WHERE session_type = 'focus' AND started_at >= ? AND started_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return row?.count ?? 0;
}

async function countWorkouts(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM workout_logs
     WHERE completed_at >= ? AND completed_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return row?.count ?? 0;
}

async function countCalorieDays(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startDateKey: string,
  endDateKey: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT consumed_on) AS count FROM calorie_entries
     WHERE deleted_at IS NULL AND consumed_on >= ? AND consumed_on <= ?`,
    [startDateKey, endDateKey],
  );
  return row?.count ?? 0;
}

async function countWeeklyReviews(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM weekly_reviews
     WHERE deleted_at IS NULL AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return row?.count ?? 0;
}

async function averageGoalProgress(db: Awaited<ReturnType<typeof getDatabase>>): Promise<number> {
  const row = await db.getFirstAsync<{ avg: number; count: number }>(
    `SELECT COALESCE(AVG(progress_percent), 0) AS avg, COUNT(*) AS count
     FROM goals WHERE deleted_at IS NULL AND status NOT IN ('completed', 'archived')`,
  );
  if (!row || row.count === 0) return 0;
  return Math.round(row.avg);
}
