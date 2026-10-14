import type { WeeklyReviewSummaryV1 } from './weeklyReview.types';

/**
 * Whether the reviewed week contains anything scheduled or recorded.
 *
 * The empty-week line must not claim "nothing scheduled" when the week actually
 * held obligations: an unfinished todo due in-window has `completedCount === 0`
 * but `incompleteCount > 0`, and a planned workout week can have
 * `scheduledSessions > 0` with no completed session. Either would otherwise be
 * described as an empty week, which is a false claim about the user's own plan.
 */
export function weekHasAnyScheduledOrRecordedActivity(summary: WeeklyReviewSummaryV1): boolean {
  const { todos, habits, focus, workouts, calories } = summary;
  return (
    todos.completedCount > 0 ||
    todos.incompleteCount > 0 ||
    todos.overdueCount > 0 ||
    todos.dueNextWeekCount > 0 ||
    habits.scheduledOccurrences > 0 ||
    habits.completedOccurrences > 0 ||
    focus.sessions > 0 ||
    focus.minutes > 0 ||
    workouts.sessions > 0 ||
    (workouts.scheduledSessions ?? 0) > 0 ||
    (workouts.completedSets ?? 0) > 0 ||
    calories.loggedDays > 0
  );
}
