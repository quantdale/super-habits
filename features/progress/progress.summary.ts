import { getDatabase } from '@/core/db/client';
import { getCalorieGoal } from '@/features/calories/calories.data';
import { countActiveGoals } from '@/features/goals/goals.data';
import { countActiveProjects } from '@/features/projects/projects.data';
import type { ProgressSummary } from '@/features/progress/progress.types';
import {
  buildProgressDateRange,
  makePeriodStat,
  type ProgressDateRange,
} from '@/features/progress/progress.domain';

/**
 * Build deterministic current-7-day vs prior-7-day Progress Insights from
 * authoritative local state. No opaque composite score (design.md §12): each
 * card reports its own current/prior value and a plain delta.
 */
export async function buildProgressSummary(): Promise<ProgressSummary> {
  const db = await getDatabase();
  const range = buildProgressDateRange();

  const [
    todoCurrent,
    todoPrevious,
    habitCurrent,
    habitPrevious,
    focusCurrent,
    focusPrevious,
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
    sumFocusMinutes(db, range.previousStartUtcIso, range.previousEndUtcExclusiveIso),
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
    todosCompleted: makePeriodStat(todoCurrent, todoPrevious),
    habitCompletions: makePeriodStat(habitCurrent, habitPrevious),
    focusMinutes: makePeriodStat(focusCurrent, focusPrevious),
    focusSessions: makePeriodStat(
      focusCurrent > 0 ? Math.ceil(focusCurrent / 25) : 0,
      focusPrevious > 0 ? Math.ceil(focusPrevious / 25) : 0,
    ),
    workoutSessions: makePeriodStat(workoutCurrent, workoutPrevious),
    calorieTrackingDays: makePeriodStat(calorieDaysCurrent, calorieDaysPrevious),
    calorieGoal: calorieGoal.calories,
    weeklyReviewsCompleted: makePeriodStat(weeklyCurrent, weeklyPrevious),
    activeProjects,
    activeGoals,
    goalsAverageProgress: goalsProgress,
  };
}

async function countTodoCompletions(
  db: Awaited<ReturnType<typeof getDatabase>>,
  startUtcIso: string,
  endUtcExclusiveIso: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM todos
     WHERE deleted_at IS NULL AND completed = 1 AND updated_at >= ? AND updated_at < ?`,
    [startUtcIso, endUtcExclusiveIso],
  );
  return row?.count ?? 0;
}

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
