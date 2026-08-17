/**
 * Deterministic weekly review summary retrieval.
 * All queries are bounded to one review week (+ one prior comparison week).
 * No writes — read-only aggregation from local authoritative data.
 */
import type { Todo } from '@/core/db/types';
import type {
  WeeklyReviewSummaryV1,
  ReviewWeek,
  TodoSummary,
  TodoSummaryItem,
  HabitSummary,
  HabitAttentionItem,
  FocusSummary,
  WorkoutSummary,
  CalorieSummary,
  RoutineFrequencyItem,
} from './weeklyReview.types';
import { getReviewWeek, generateInsights } from './weeklyReview.domain';
import { toDateKey } from '@/lib/time';
import { listTodos } from '@/features/todos/todos.data';
import { listHabits, getAllHabitCompletionsForRange } from '@/features/habits/habits.data';
import { listPomodoroSessionsForDateRange } from '@/features/pomodoro/pomodoro.data';
import { listWorkoutLogsForRange, getRoutineNamesByIds } from '@/features/workout/workout.data';
import { getCalorieSummaryByRange, getCalorieGoal } from '@/features/calories/calories.data';

// ── todos ────────────────────────────────────────────────────────────────────

async function summarizeTodos(week: ReviewWeek): Promise<TodoSummary> {
  const allTodos = await listTodos();

  const isInRange = (t: Todo, start: string, end: string) => {
    if (!t.due_date) return false;
    return t.due_date >= start && t.due_date <= end;
  };

  const completedInWeek = allTodos.filter(
    (t) => t.completed === 1 && isInRange(t, week.startDateKey, week.endDateKey),
  );
  const incompleteInWeek = allTodos.filter(
    (t) => t.completed === 0 && isInRange(t, week.startDateKey, week.endDateKey),
  );
  const overdueAtEnd = allTodos.filter(
    (t) =>
      t.completed === 0 &&
      t.due_date !== null &&
      t.due_date < week.endDateKey &&
      !isInRange(t, week.startDateKey, week.endDateKey),
  );

  const dueNextWeek = allTodos.filter(
    (t) =>
      t.completed === 0 &&
      t.due_date !== null &&
      t.due_date >= week.nextWeekStartDateKey &&
      t.due_date <= week.nextWeekEndDateKey,
  );

  const carryForward: TodoSummaryItem[] = incompleteInWeek
    .filter((t) => !dueNextWeek.some((d) => d.id === t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.due_date,
      priority: t.priority,
    }));

  return {
    completedCount: completedInWeek.length,
    incompleteCount: incompleteInWeek.length,
    overdueCount: overdueAtEnd.length,
    dueNextWeekCount: dueNextWeek.length,
    carryForwardCandidates: carryForward,
  };
}

// ── habits ───────────────────────────────────────────────────────────────────

async function summarizeHabits(week: ReviewWeek): Promise<HabitSummary> {
  const habits = await listHabits();

  if (habits.length === 0) {
    return {
      scheduledOccurrences: 0,
      completedOccurrences: 0,
      consistencyPercent: null,
      attention: [],
    };
  }

  const completions = await getAllHabitCompletionsForRange(week.startDateKey, week.endDateKey);

  const completionMap = new Map<string, Map<string, number>>();
  for (const c of completions) {
    if (!completionMap.has(c.habit_id)) completionMap.set(c.habit_id, new Map());
    completionMap.get(c.habit_id)!.set(c.date_key, c.count);
  }

  let totalScheduled = 0;
  let totalCompleted = 0;
  const attention: HabitAttentionItem[] = [];

  for (const habit of habits) {
    const daysInWeek = 7;
    totalScheduled += daysInWeek;
    const habitCompletions = completionMap.get(habit.id);
    let completedDays = 0;
    for (let i = 0; i < daysInWeek; i++) {
      const d = new Date(week.startDateKey);
      d.setDate(d.getDate() + i);
      const dateKey = toDateKey(d);
      const count = habitCompletions?.get(dateKey) ?? 0;
      if (count >= habit.target_per_day) completedDays++;
    }
    totalCompleted += completedDays;

    if (completedDays === 0) {
      attention.push({
        habitId: habit.id,
        name: habit.name,
        kind: 'no_completions',
        message: 'No completions this week',
      });
    }
  }

  const consistencyPercent =
    totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : null;

  return {
    scheduledOccurrences: totalScheduled,
    completedOccurrences: totalCompleted,
    consistencyPercent,
    attention,
  };
}

// ── focus (pomodoro) ─────────────────────────────────────────────────────────

async function summarizeFocus(week: ReviewWeek): Promise<FocusSummary> {
  const weekSessions = await listPomodoroSessionsForDateRange(week.startDateKey, week.endDateKey);

  const focusSessions = weekSessions.filter((s) => s.session_type === 'focus');
  const minutes = focusSessions.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);

  const priorStart = new Date(week.startDateKey);
  priorStart.setDate(priorStart.getDate() - 7);
  const priorEnd = new Date(week.endDateKey);
  priorEnd.setDate(priorEnd.getDate() - 7);
  const priorSessions = await listPomodoroSessionsForDateRange(
    toDateKey(priorStart),
    toDateKey(priorEnd),
  );
  const priorFocus = priorSessions.filter((s) => s.session_type === 'focus');
  const priorMinutes = priorFocus.reduce((sum, s) => sum + Math.round(s.duration_seconds / 60), 0);

  return {
    sessions: focusSessions.length,
    minutes,
    priorWeekMinutes: priorFocus.length > 0 ? priorMinutes : null,
  };
}

// ── workouts ─────────────────────────────────────────────────────────────────

async function summarizeWorkouts(week: ReviewWeek): Promise<WorkoutSummary> {
  const weekLogs = await listWorkoutLogsForRange(week.startDateKey, week.endDateKey);

  const priorStart = new Date(week.startDateKey);
  priorStart.setDate(priorStart.getDate() - 7);
  const priorEnd = new Date(week.endDateKey);
  priorEnd.setDate(priorEnd.getDate() - 7);
  const priorLogs = await listWorkoutLogsForRange(toDateKey(priorStart), toDateKey(priorEnd));

  const routineMap = new Map<string, number>();
  for (const log of weekLogs) {
    routineMap.set(log.routine_id, (routineMap.get(log.routine_id) ?? 0) + 1);
  }

  const routines: RoutineFrequencyItem[] = [];
  if (routineMap.size > 0) {
    const routineIds = [...routineMap.keys()];
    const routineRows = await getRoutineNamesByIds(routineIds);
    const nameMap = new Map(routineRows.map((r) => [r.id, r.name]));
    for (const [id, count] of routineMap) {
      routines.push({ routineId: id, name: nameMap.get(id) ?? 'Unknown', count });
    }
  }

  return {
    sessions: weekLogs.length,
    priorWeekSessions: priorLogs.length > 0 ? priorLogs.length : null,
    routines,
  };
}

// ── calories ─────────────────────────────────────────────────────────────────

async function summarizeCalories(week: ReviewWeek): Promise<CalorieSummary> {
  const weekSummary = await getCalorieSummaryByRange(week.startDateKey, week.endDateKey);
  const goal = await getCalorieGoal();
  const configuredGoal = goal?.calories ?? null;

  if (weekSummary.length === 0) {
    return {
      loggedDays: 0,
      averageCaloriesOnLoggedDays: null,
      configuredGoal,
    };
  }

  const totalCal = weekSummary.reduce((sum, r) => sum + r.totalCalories, 0);
  const averageCaloriesOnLoggedDays = Math.round(totalCal / weekSummary.length);

  return {
    loggedDays: weekSummary.length,
    averageCaloriesOnLoggedDays,
    configuredGoal,
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Build the full deterministic weekly review summary from local data.
 * Read-only — no writes to any table.
 */
export async function buildWeeklyReviewSummary(
  referenceDateKey?: string,
): Promise<WeeklyReviewSummaryV1> {
  const week = getReviewWeek(referenceDateKey);

  const [todos, habits, focus, workouts, calories] = await Promise.all([
    summarizeTodos(week),
    summarizeHabits(week),
    summarizeFocus(week),
    summarizeWorkouts(week),
    summarizeCalories(week),
  ]);

  const summary: WeeklyReviewSummaryV1 = {
    version: 1,
    week,
    todos,
    habits,
    focus,
    workouts,
    calories,
    wins: [],
    attention: [],
  };

  const { wins, attention } = generateInsights(summary);
  summary.wins = wins;
  summary.attention = attention;

  return summary;
}
