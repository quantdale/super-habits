import {
  countCalorieEntriesByRange,
  getCalorieSummaryByRange,
} from '@/features/calories/calories.data';
import {
  getAllHabitCompletionsForRange,
  getCompletionHistory,
  listHabits,
} from '@/features/habits/habits.data';
import {
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
  getHabitTargetForDate,
  isHabitScheduledOn,
  parseHabitRuleHistory,
} from '@/features/habits/habits.domain';
import { calculateHabitProgressInsights } from '@/features/habits/habitInsights.domain';
import { listPomodoroSessionsForDateRange } from '@/features/pomodoro/pomodoro.data';
import {
  countPendingTodos,
  listPendingTodos,
  listTodos,
  type PendingTodoFilters,
} from '@/features/todos/todos.data';
import { listProjects, listTodosForProject } from '@/features/projects/projects.data';
import { listGoals } from '@/features/goals/goals.data';
import { getDailyPlan } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import { listRoutines, listWorkoutLogsForRange } from '@/features/workout/workout.data';
import {
  timestampToLocalDateKey,
  dateKeyToLocalDate,
  toDateKey,
  getUtcIsoRangeForLocalDateKeys,
} from '@/lib/time';
import { countTodosCompletedBetween } from '@/features/progress/progress.data';
import { isActiveHabit } from '@/features/overview/overview.domain';
import { isValidCommandDateKey, normalizeReference } from './command.validation';
import { resolveHabitReference, resolveWorkoutRoutineReference } from './command.resolver';
import type {
  AskDateRange,
  CalorieSummaryFacts,
  DailyOverviewFacts,
  FocusSummaryFacts,
  GoalProgressFacts,
  HabitProgressFacts,
  HabitProgressMetric,
  HabitStreakFacts,
  PendingTodosFacts,
  ProjectStatusFacts,
  TodayFocusFacts,
  WorkoutSummaryFacts,
} from './ask.types';

const MAX_ASK_RANGE_DAYS = 366;
const MAX_FACT_ITEMS = 50;

export class AskRetrievalError extends Error {
  reasonCode:
    | 'habit_not_found'
    | 'habit_ambiguous'
    | 'routine_not_found'
    | 'routine_ambiguous'
    | 'project_not_found'
    | 'project_ambiguous'
    | 'goal_not_found'
    | 'goal_ambiguous'
    | 'invalid_range';

  constructor(reasonCode: AskRetrievalError['reasonCode'], message: string) {
    super(message);
    this.reasonCode = reasonCode;
  }
}

function validateRange(startDateKey: string, endDateKey: string): AskDateRange {
  if (!isValidCommandDateKey(startDateKey) || !isValidCommandDateKey(endDateKey)) {
    throw new AskRetrievalError('invalid_range', 'Ask date range is invalid.');
  }
  const start = dateKeyToLocalDate(startDateKey);
  const end = dateKeyToLocalDate(endDateKey);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (startDateKey > endDateKey || dayCount < 1 || dayCount > MAX_ASK_RANGE_DAYS) {
    throw new AskRetrievalError(
      'invalid_range',
      `Ask date ranges must be ordered and no longer than ${MAX_ASK_RANGE_DAYS} days.`,
    );
  }
  return { startDateKey, endDateKey };
}

function defaultRange(todayDateKey: string, days: number): AskDateRange {
  const start = dateKeyToLocalDate(todayDateKey);
  start.setDate(start.getDate() - (days - 1));
  return validateRange(toDateKey(start), todayDateKey);
}

export async function retrievePendingTodos(input?: {
  due?: 'all' | 'today' | 'overdue';
  priority?: 'all' | 'urgent' | 'normal' | 'low';
  todayDateKey?: string;
}): Promise<PendingTodosFacts> {
  const due = input?.due ?? 'all';
  const priority = input?.priority ?? 'all';
  const todayDateKey = input?.todayDateKey ?? toDateKey();
  if (!isValidCommandDateKey(todayDateKey)) {
    throw new AskRetrievalError('invalid_range', 'Ask Todo date context is invalid.');
  }
  if (due === 'all' && priority === 'all' && !input?.todayDateKey) {
    const [count, todos] = await Promise.all([
      countPendingTodos(),
      listPendingTodos(MAX_FACT_ITEMS),
    ]);
    return { count, titles: todos.slice(0, MAX_FACT_ITEMS).map((todo) => todo.title) };
  }

  const filters: PendingTodoFilters = { due, priority, todayDateKey };
  const [count, todos] = await Promise.all([
    countPendingTodos(filters),
    listPendingTodos({ ...filters, limit: MAX_FACT_ITEMS }),
  ]);
  return {
    count,
    titles: todos.slice(0, MAX_FACT_ITEMS).map((todo) => todo.title),
  };
}

export async function retrieveCalorieSummary(
  startDateKey: string,
  endDateKey: string,
): Promise<CalorieSummaryFacts> {
  const range = validateRange(startDateKey, endDateKey);
  const [summaries, entryCount] = await Promise.all([
    getCalorieSummaryByRange(range.startDateKey, range.endDateKey),
    countCalorieEntriesByRange(range.startDateKey, range.endDateKey),
  ]);
  return {
    totalCalories: summaries.reduce((total, summary) => total + summary.totalCalories, 0),
    totalProtein: summaries.reduce((total, summary) => total + summary.totalProtein, 0),
    totalCarbs: summaries.reduce((total, summary) => total + summary.totalCarbs, 0),
    totalFats: summaries.reduce((total, summary) => total + summary.totalFats, 0),
    totalFiber: summaries.reduce((total, summary) => total + summary.totalFiber, 0),
    entryCount,
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
  };
}

async function computeHabitStreaks(habitId: string, targetPerDay: number, ruleHistory?: string) {
  const completions = await getCompletionHistory(habitId);
  const dayCompletions = buildDayCompletions(completions, targetPerDay, undefined, ruleHistory);
  return {
    currentStreak: calculateCurrentStreak(dayCompletions),
    longestStreak: calculateLongestStreak(dayCompletions),
  };
}

/** Backward-compatible V1 retrieval retained for pre-V2 Ask fixtures. */
export async function retrieveHabitStreak(habitName: string | null): Promise<HabitStreakFacts> {
  // Paused/archived habits are not current obligations; current-streak
  // framing covers active habits only (Area 8 F1 site 5).
  const habits = (await listHabits()).filter(isActiveHabit);

  if (!habitName) {
    const habitSummaries = await Promise.all(
      habits.slice(0, MAX_FACT_ITEMS).map(async (habit) => {
        const streaks = await computeHabitStreaks(
          habit.id,
          habit.target_per_day,
          habit.rule_history,
        );
        return {
          habitName: habit.name,
          currentStreak: streaks.currentStreak,
          longestStreak: streaks.longestStreak,
        };
      }),
    );
    return { scope: 'overall', habits: habitSummaries };
  }

  const normalizedName = normalizeReference(habitName)?.toLocaleLowerCase() ?? '';
  const matches = habits.filter(
    (candidate) => candidate.name.trim().toLocaleLowerCase() === normalizedName,
  );
  if (matches.length > 1) {
    throw new AskRetrievalError(
      'habit_ambiguous',
      `More than one Habit named "${habitName}" was found.`,
    );
  }
  const habit = matches[0];
  if (!habit) {
    throw new AskRetrievalError('habit_not_found', `No Habit named "${habitName}" was found.`);
  }

  const streaks = await computeHabitStreaks(habit.id, habit.target_per_day, habit.rule_history);
  return {
    scope: 'single',
    habitName: habit.name,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
  };
}

function buildHabitMetric(
  habit: Awaited<ReturnType<typeof listHabits>>[number],
  completions: { habit_id: string; date_key: string; count: number }[],
  endDateKey: string,
): HabitProgressMetric {
  const ownCompletions = completions.filter((completion) => completion.habit_id === habit.id);
  const insights = calculateHabitProgressInsights(habit, ownCompletions, endDateKey);
  const lastDay = insights?.recentDays.find((day) => day.dateKey === endDateKey);
  return {
    habitName: habit.name,
    currentStreak: insights?.currentStreak ?? 0,
    longestStreak: insights?.longestStreak ?? 0,
    scheduledOccurrences: insights?.totalEligibleOccurrences ?? 0,
    completedOccurrences: insights?.totalCompletedOccurrences ?? 0,
    currentTarget: lastDay?.targetPerDay ?? habit.target_per_day,
    currentActual: lastDay?.count ?? 0,
    last7Percentage: insights?.last7.percentage ?? null,
    last30Percentage: insights?.last30.percentage ?? null,
    last90Percentage: insights?.last90.percentage ?? null,
  };
}

export async function retrieveHabitProgress(
  habitName: string | null,
  startDateKey: string,
  endDateKey: string,
): Promise<HabitProgressFacts> {
  const range = validateRange(startDateKey, endDateKey);
  // Current-progress metrics cover active habits only (Area 8 F1 site 6);
  // paused/archived habits resolve to habit_not_found for named lookups.
  const habits = (await listHabits()).filter(isActiveHabit);
  let selected = habits;
  if (habitName) {
    const resolution = resolveHabitReference(habitName, habits, habits);
    if (resolution.status === 'ambiguous') {
      throw new AskRetrievalError(
        'habit_ambiguous',
        `More than one Habit named "${habitName}" was found.`,
      );
    }
    if (resolution.status !== 'exact') {
      throw new AskRetrievalError(
        'habit_not_found',
        `No active Habit named "${habitName}" was found.`,
      );
    }
    selected = [resolution.entity];
  }
  // Habit Progress Insights exposes 7/30/90-day metrics and streak context.
  // Keep retrieval bounded while giving the canonical insight domain up to one
  // supported Ask year of evidence for current/longest streak calculations.
  const insightStart = dateKeyToLocalDate(range.endDateKey);
  insightStart.setDate(insightStart.getDate() - (MAX_ASK_RANGE_DAYS - 1));
  const completionStart =
    toDateKey(insightStart) < range.startDateKey ? toDateKey(insightStart) : range.startDateKey;
  const completions = await getAllHabitCompletionsForRange(completionStart, range.endDateKey);
  return {
    scope: habitName ? 'single' : 'overall',
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
    habits: selected
      .slice(0, MAX_FACT_ITEMS)
      .map((habit) => buildHabitMetric(habit, completions, range.endDateKey)),
  };
}

export async function retrieveWorkoutSummary(
  routineName: string | null,
  startDateKey: string,
  endDateKey: string,
): Promise<WorkoutSummaryFacts> {
  const range = validateRange(startDateKey, endDateKey);
  const [routines, allLogs] = await Promise.all([
    listRoutines(),
    listWorkoutLogsForRange(range.startDateKey, range.endDateKey),
  ]);
  let logs = allLogs;
  if (routineName) {
    const resolution = resolveWorkoutRoutineReference(routineName, routines, routines);
    if (resolution.status === 'ambiguous') {
      throw new AskRetrievalError(
        'routine_ambiguous',
        `More than one routine named "${routineName}" was found.`,
      );
    }
    if (resolution.status !== 'exact') {
      throw new AskRetrievalError(
        'routine_not_found',
        `No active routine named "${routineName}" was found.`,
      );
    }
    logs = logs.filter((log) => log.routine_id === resolution.entity.id);
  }
  const names = new Map(routines.map((routine) => [routine.id, routine.name]));
  const frequency = new Map<string, number>();
  for (const log of logs) {
    const name = names.get(log.routine_id) ?? 'Deleted routine';
    frequency.set(name, (frequency.get(name) ?? 0) + 1);
  }
  return {
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
    sessionCount: logs.length,
    lastSession: logs[0]
      ? { routineName: names.get(logs[0].routine_id) ?? null, completedAt: logs[0].completed_at }
      : null,
    routineFrequency: [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_FACT_ITEMS)
      .map(([name, sessionCount]) => ({ routineName: name, sessionCount })),
  };
}

export async function retrieveFocusSummary(
  startDateKey: string,
  endDateKey: string,
): Promise<FocusSummaryFacts> {
  const range = validateRange(startDateKey, endDateKey);
  const sessions = await listPomodoroSessionsForDateRange(range.startDateKey, range.endDateKey);
  const focusSessions = sessions.filter((session) => session.session_type === 'focus');
  return {
    startDateKey: range.startDateKey,
    endDateKey: range.endDateKey,
    completedSessionCount: focusSessions.length,
    totalFocusedMinutes: Math.round(
      focusSessions.reduce((total, session) => total + session.duration_seconds, 0) / 60,
    ),
  };
}

export async function retrieveDailyOverview(dateKey: string): Promise<DailyOverviewFacts> {
  if (!isValidCommandDateKey(dateKey)) {
    throw new AskRetrievalError('invalid_range', 'Overview date is invalid.');
  }
  // Date-scoped completions (Area 8 F4): a per-date overview must report that
  // day's completed count, not the lifetime total.
  const dayBounds = getUtcIsoRangeForLocalDateKeys(dateKey, dateKey);
  const [
    pendingCount,
    todoCompletedCount,
    overdueCount,
    habits,
    completions,
    calories,
    focus,
    workout,
  ] = await Promise.all([
    countPendingTodos(),
    countTodosCompletedBetween(dayBounds.startUtcIso, dayBounds.endUtcExclusiveIso),
    countPendingTodos({ due: 'overdue', todayDateKey: dateKey }),
    listHabits(),
    getAllHabitCompletionsForRange(dateKey, dateKey),
    retrieveCalorieSummary(dateKey, dateKey),
    retrieveFocusSummary(dateKey, dateKey),
    retrieveWorkoutSummary(null, dateKey, dateKey),
  ]);
  const habitRows = new Map(completions.map((row) => [row.habit_id, row.count]));
  let scheduledCount = 0;
  let habitCompletedCount = 0;
  for (const habit of habits) {
    // Paused/archived habits are not current obligations (Area 8 F1 site 7).
    if (!isActiveHabit(habit)) continue;
    const creationDateKey = timestampToLocalDateKey(habit.created_at);
    const scheduled = isHabitScheduledOn(
      parseHabitRuleHistory(habit.rule_history),
      dateKey,
      habit.target_per_day,
      creationDateKey,
    );
    if (!scheduled) continue;
    scheduledCount += 1;
    const target = getHabitTargetForDate(
      parseHabitRuleHistory(habit.rule_history),
      dateKey,
      habit.target_per_day,
      creationDateKey,
    );
    if ((habitRows.get(habit.id) ?? 0) >= target) habitCompletedCount += 1;
  }
  return {
    dateKey,
    todos: {
      pendingCount,
      completedCount: todoCompletedCount,
      overdueCount,
    },
    habits: {
      scheduledCount,
      completedCount: habitCompletedCount,
      remainingCount: Math.max(0, scheduledCount - habitCompletedCount),
    },
    calories: {
      totalCalories: calories.totalCalories,
      totalProtein: calories.totalProtein,
      totalCarbs: calories.totalCarbs,
      totalFats: calories.totalFats,
      totalFiber: calories.totalFiber,
      entryCount: calories.entryCount,
    },
    focus: {
      completedSessionCount: focus.completedSessionCount,
      totalFocusedMinutes: focus.totalFocusedMinutes,
    },
    workout: { sessionCount: workout.sessionCount },
  };
}

export { defaultRange, validateRange, MAX_ASK_RANGE_DAYS };

// ---------------------------------------------------------------------------
// Planning Ask retrieval (W6): projects / goals / daily plan. Local
// deterministic lookups with bounded results, classified remotely as the
// project_status / goal_progress / today_focus intents and answered on-device.
// ---------------------------------------------------------------------------

function normalizeNameReference(value: string | null): string {
  return normalizeReference(value)?.toLocaleLowerCase() ?? '';
}

export async function retrieveProjectStatus(
  projectName: string | null,
): Promise<ProjectStatusFacts> {
  const projects = await listProjects();
  if (projectName) {
    const normalized = normalizeNameReference(projectName);
    const matches = projects.filter(
      (project) => project.name.trim().toLocaleLowerCase() === normalized,
    );
    if (matches.length > 1) {
      throw new AskRetrievalError(
        'project_ambiguous',
        `More than one Project named "${projectName}" was found.`,
      );
    }
    const project = matches[0];
    if (!project) {
      throw new AskRetrievalError(
        'project_not_found',
        `No active Project named "${projectName}" was found.`,
      );
    }
    const todos = await listTodosForProject(project.id);
    return {
      scope: 'single',
      projects: [
        {
          name: project.name,
          status: project.status,
          targetDate: project.target_date,
          openTodoCount: todos.filter((todo) => todo.completed === 0).length,
        },
      ],
    };
  }

  const bounded = projects.slice(0, MAX_FACT_ITEMS);
  const openCounts = await Promise.all(
    bounded.map(async (project) => {
      const todos = await listTodosForProject(project.id);
      return todos.filter((todo) => todo.completed === 0).length;
    }),
  );
  return {
    scope: 'overall',
    projects: bounded.map((project, index) => ({
      name: project.name,
      status: project.status,
      targetDate: project.target_date,
      openTodoCount: openCounts[index],
    })),
  };
}

export async function retrieveGoalProgressSummary(
  goalTitle: string | null,
): Promise<GoalProgressFacts> {
  const goals = await listGoals();
  let selected = goals;
  if (goalTitle) {
    const normalized = normalizeNameReference(goalTitle);
    const matches = goals.filter((goal) => goal.title.trim().toLocaleLowerCase() === normalized);
    if (matches.length > 1) {
      throw new AskRetrievalError(
        'goal_ambiguous',
        `More than one Goal titled "${goalTitle}" was found.`,
      );
    }
    if (matches.length === 0) {
      throw new AskRetrievalError(
        'goal_not_found',
        `No active Goal titled "${goalTitle}" was found.`,
      );
    }
    selected = matches;
  }

  return {
    scope: goalTitle ? 'single' : 'overall',
    goals: selected.slice(0, MAX_FACT_ITEMS).map((goal) => ({
      title: goal.title,
      progressPercent: goal.progress_percent,
      status: goal.status,
    })),
  };
}

export async function retrieveTodayFocus(dateKey: string): Promise<TodayFocusFacts> {
  if (!isValidCommandDateKey(dateKey)) {
    throw new AskRetrievalError('invalid_range', 'Focus date is invalid.');
  }
  const [plan, pendingCount, todos, habits, completions] = await Promise.all([
    getDailyPlan(dateKey),
    countPendingTodos({ due: 'today', todayDateKey: dateKey }),
    // Resolve top priorities against ALL todos so completed ones keep their
    // place (and their real completed flag) instead of vanishing.
    listTodos(),
    listHabits(),
    getAllHabitCompletionsForRange(dateKey, dateKey),
  ]);
  const topTodoIds = plan ? parseTopTodoIds(plan.top_todo_ids) : [];
  type TodoRow = Awaited<ReturnType<typeof listTodos>>[number];
  const todoById = new Map(todos.map((todo) => [todo.id, todo]));
  const topTodos = topTodoIds
    .map((id) => todoById.get(id))
    .filter((todo): todo is TodoRow => todo !== undefined)
    .slice(0, MAX_TOP_PRIORITIES)
    .map((todo) => ({ title: todo.title, completed: todo.completed === 1 }));

  // Remaining-habit load for the day mirrors the daily-overview schedule math.
  const completionByHabit = new Map(completions.map((row) => [row.habit_id, row.count]));
  let scheduledCount = 0;
  let habitCompletedCount = 0;
  for (const habit of habits) {
    const creationDateKey = timestampToLocalDateKey(habit.created_at);
    if (
      !isHabitScheduledOn(
        parseHabitRuleHistory(habit.rule_history),
        dateKey,
        habit.target_per_day,
        creationDateKey,
      )
    ) {
      continue;
    }
    scheduledCount += 1;
    const target = getHabitTargetForDate(
      parseHabitRuleHistory(habit.rule_history),
      dateKey,
      habit.target_per_day,
      creationDateKey,
    );
    if ((completionByHabit.get(habit.id) ?? 0) >= target) habitCompletedCount += 1;
  }

  return {
    dateKey,
    planIntention: plan?.intention?.trim() ? plan.intention.trim() : null,
    topTodos,
    pendingTodoCount: pendingCount,
    habitsRemainingCount: Math.max(0, scheduledCount - habitCompletedCount),
  };
}
