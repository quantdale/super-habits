import { getProgressRawData } from '@/features/progress/progress.data';
import { makePeriodStat, PROGRESS_WINDOW_DAYS } from '@/features/progress/progress.domain';
import type { ProgressSummary } from '@/features/progress/progress.types';

/**
 * Build deterministic current-N-day vs prior-N-day Progress Insights from
 * authoritative local state. No opaque composite score (design.md §12): each
 * card reports its own current/prior value and a plain delta.
 *
 * The raw DB aggregation lives in progress.data.ts (getProgressRawData); this
 * module only composes it into the summary shape via domain helpers.
 */
export async function buildProgressSummary(
  windowDays: number = PROGRESS_WINDOW_DAYS,
): Promise<ProgressSummary> {
  const data = await getProgressRawData(windowDays);

  return {
    windowDays,
    range: {
      currentStart: data.range.currentStart,
      currentEnd: data.range.currentEnd,
      previousStart: data.range.previousStart,
      previousEnd: data.range.previousEnd,
    },
    todosCompleted: makePeriodStat(data.todoCurrent, data.todoPrevious),
    habitCompletions: makePeriodStat(data.habitCurrent, data.habitPrevious),
    focusMinutes: makePeriodStat(data.focusMinutesCurrent, data.focusMinutesPrevious),
    focusSessions: makePeriodStat(data.focusSessionsCurrent, data.focusSessionsPrevious),
    workoutSessions: makePeriodStat(data.workoutCurrent, data.workoutPrevious),
    calorieTrackingDays: makePeriodStat(data.calorieDaysCurrent, data.calorieDaysPrevious),
    calorieGoal: data.calorieGoal,
    weeklyReviewsCompleted: makePeriodStat(data.weeklyCurrent, data.weeklyPrevious),
    activeProjects: data.activeProjects,
    activeGoals: data.activeGoals,
    goalsAverageProgress: data.goalsProgress,
  };
}
