/**
 * Pure aggregation/formatting logic for the customizable Overview dashboard.
 * No DB, no React, no side effects — fully unit-testable.
 */

import type { DailyPlan, HabitLifecycleStatus } from '@/core/db/types';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { isHabitScheduledOn } from '@/features/habits/habits.domain';
import type { Goal } from '@/features/goals/goals.types';
import type { Project } from '@/features/projects/projects.types';
import type { Todo } from '@/features/todos/types';
import { caloriesTotal } from '@/features/calories/calories.domain';
import { timestampToLocalDateKey } from '@/lib/time';

// ---------------------------------------------------------------------------
// Card registry (ids + default layout)
// ---------------------------------------------------------------------------

export const OVERVIEW_CARD_IDS = [
  'plan',
  'todos',
  'habits',
  'focus',
  'workout',
  'calories',
  'projects',
  'goals',
] as const;

export type OverviewCardId = (typeof OVERVIEW_CARD_IDS)[number];

export const DEFAULT_CARD_LAYOUT: OverviewCardId[] = [...OVERVIEW_CARD_IDS];

// ---------------------------------------------------------------------------
// Card layout persistence helpers
// ---------------------------------------------------------------------------

/** Parse a raw AsyncStorage string into a valid ordered list of visible card ids. */
export function parseCardLayout(raw: string | null | undefined): OverviewCardId[] {
  if (!raw) return [...DEFAULT_CARD_LAYOUT];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [...DEFAULT_CARD_LAYOUT];
  }
  if (!Array.isArray(parsed)) return [...DEFAULT_CARD_LAYOUT];
  const seen = new Set<OverviewCardId>();
  const result: OverviewCardId[] = [];
  for (const item of parsed) {
    if (
      typeof item === 'string' &&
      (OVERVIEW_CARD_IDS as readonly string[]).includes(item) &&
      !seen.has(item as OverviewCardId)
    ) {
      seen.add(item as OverviewCardId);
      result.push(item as OverviewCardId);
    }
  }
  // An explicitly empty array means "hide everything" and is honored.
  return result;
}

/** Serialize a visible-card ordering for AsyncStorage (`superhabits.overview.cardLayout`). */
export function serializeCardLayout(visibleIds: readonly OverviewCardId[]): string {
  const seen = new Set<OverviewCardId>();
  const unique: OverviewCardId[] = [];
  for (const id of visibleIds) {
    if ((OVERVIEW_CARD_IDS as readonly string[]).includes(id) && !seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return JSON.stringify(unique);
}

export function isCardVisible(layout: readonly OverviewCardId[], id: OverviewCardId): boolean {
  return layout.includes(id);
}

/** Toggle a card's visibility while preserving the relative order of the rest. */
export function toggleCardVisibility(
  layout: readonly OverviewCardId[],
  id: OverviewCardId,
): OverviewCardId[] {
  if (layout.includes(id)) return layout.filter((entry) => entry !== id);
  // Re-insert at the default position so re-showing feels predictable.
  const next = [...layout];
  const defaultIndex = OVERVIEW_CARD_IDS.indexOf(id);
  let insertAt = next.length;
  for (let i = 0; i < next.length; i += 1) {
    if (OVERVIEW_CARD_IDS.indexOf(next[i]) > defaultIndex) {
      insertAt = i;
      break;
    }
  }
  next.splice(insertAt, 0, id);
  return next;
}

/** Move a card one position up (-1) or down (+1) within the visible layout. */
export function moveCard(
  layout: readonly OverviewCardId[],
  id: OverviewCardId,
  direction: -1 | 1,
): OverviewCardId[] {
  const index = layout.indexOf(id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= layout.length) return [...layout];
  const next = [...layout];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

// ---------------------------------------------------------------------------
// Greeting / date logic
// ---------------------------------------------------------------------------

export function getGreeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Human label for a due date relative to today's local date key. */
export function formatDueDateLabel(dueDate: string, todayKey: string): string {
  if (dueDate < todayKey) return 'Overdue';
  if (dueDate === todayKey) return 'Due today';
  return `Due ${dueDate}`;
}

// ---------------------------------------------------------------------------
// Per-card summary shaping
// ---------------------------------------------------------------------------

export type TodosSummary = {
  overdueCount: number;
  dueTodayCount: number;
  pendingCount: number;
  /** Bounded preview list: overdue first, then due today, then top pending. */
  preview: Todo[];
};

export function shapeTodosSummary(todos: readonly Todo[], todayKey: string): TodosSummary {
  const pending = todos.filter((t) => t.completed === 0);
  const overdue = pending.filter((t) => t.due_date !== null && t.due_date < todayKey);
  const dueToday = pending.filter((t) => t.due_date === todayKey);
  const rest = pending.filter((t) => t.due_date === null || t.due_date > todayKey);
  return {
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    pendingCount: pending.length,
    preview: [...overdue, ...dueToday, ...rest].slice(0, 4),
  };
}

export type PlanProgressSummary = {
  hasPlan: boolean;
  status: DailyPlan['status'] | null;
  intention: string | null;
  totalPriorities: number;
  completedPriorities: number;
};

export function shapePlanProgressSummary(
  plan: DailyPlan | null,
  todos: readonly Todo[],
): PlanProgressSummary {
  if (!plan) {
    return {
      hasPlan: false,
      status: null,
      intention: null,
      totalPriorities: 0,
      completedPriorities: 0,
    };
  }
  const ids = parseTopTodoIds(plan.top_todo_ids);
  const byId = new Map(todos.map((t) => [t.id, t]));
  const picked = ids.map((id) => byId.get(id)).filter((t): t is Todo => t !== undefined);
  return {
    hasPlan: true,
    status: plan.status,
    intention: plan.intention || null,
    totalPriorities: picked.length,
    completedPriorities: picked.filter((t) => t.completed === 1).length,
  };
}

export type HabitsSummary = {
  scheduledToday: number;
  completedToday: number;
  rings: { id: string; name: string; color: string; count: number; target: number }[];
};

/**
 * Durable habit lifecycle (migration 20): only `active` habits count toward
 * "today" obligations. Legacy rows without `status` are active. Paused means
 * excluded from today progress; archived is retired but not deleted.
 */
export function isActiveHabit(habit: { status?: HabitLifecycleStatus }): boolean {
  return habit.status !== 'paused' && habit.status !== 'archived';
}

export function shapeHabitsSummary(
  habits: readonly {
    id: string;
    name: string;
    color: string;
    target_per_day: number;
    rule_history?: string | null;
    status?: HabitLifecycleStatus;
  }[],
  completions: readonly { habit_id: string; date_key: string; count: number }[],
  todayKey: string,
): HabitsSummary {
  const countByHabit = new Map<string, number>();
  for (const row of completions) {
    if (row.date_key === todayKey) {
      countByHabit.set(row.habit_id, (countByHabit.get(row.habit_id) ?? 0) + row.count);
    }
  }
  // F1: paused/archived habits never render rings or inflate today's counts.
  const scheduled = habits
    .filter((habit) => isActiveHabit(habit))
    .filter((habit) => isHabitScheduledOn(habit.rule_history, todayKey, habit.target_per_day));
  const isComplete = (habit: (typeof scheduled)[number]): boolean =>
    Math.min(countByHabit.get(habit.id) ?? 0, habit.target_per_day) >= habit.target_per_day;
  return {
    scheduledToday: scheduled.length,
    // F2: numerator spans ALL scheduled habits; `rings` below stays a capped
    // display sample so the card never undercounts with more than 6 habits.
    completedToday: scheduled.filter(isComplete).length,
    rings: scheduled.slice(0, 6).map((habit) => ({
      id: habit.id,
      name: habit.name,
      color: habit.color,
      count: Math.min(countByHabit.get(habit.id) ?? 0, habit.target_per_day),
      target: habit.target_per_day,
    })),
  };
}

export type FocusWeekSummary = {
  focusMinutes: number;
  sessionCount: number;
  /** Minutes per day for the last `days` local days, oldest first. */
  perDayMinutes: { dateKey: string; minutes: number }[];
};

export function shapeFocusWeekSummary(
  sessions: readonly { started_at: string; duration_seconds: number; session_type: string }[],
  weekDateKeys: readonly string[],
): FocusWeekSummary {
  const minutesByKey = new Map<string, number>();
  let sessionCount = 0;
  for (const session of sessions) {
    if (session.session_type !== 'focus') continue;
    const key = safeTimestampToLocalDateKey(session.started_at);
    // Corrupt timestamps have no local day; skip instead of poisoning buckets.
    if (!key) continue;
    minutesByKey.set(key, (minutesByKey.get(key) ?? 0) + session.duration_seconds / 60);
    sessionCount += 1;
  }
  const perDayMinutes = weekDateKeys.map((dateKey) => ({
    dateKey,
    minutes: Math.round(minutesByKey.get(dateKey) ?? 0),
  }));
  return {
    focusMinutes: perDayMinutes.reduce((sum, day) => sum + day.minutes, 0),
    sessionCount,
    perDayMinutes,
  };
}

/**
 * Local-calendar date key from an ISO timestamp via the shared lib/time
 * helper. Returns null for corrupt input instead of a "NaN-NaN-NaN" key that
 * would poison date-key comparisons (mirrors habits.data's safe wrapper).
 */
function safeTimestampToLocalDateKey(timestamp: string): string | null {
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? null : timestampToLocalDateKey(timestamp);
}

export type WorkoutSummary = {
  sessionsThisWeek: number;
  lastWorkoutName: string | null;
  lastWorkoutDateKey: string | null;
};

export function shapeWorkoutSummary(
  logs: readonly { created_at?: string; date_key?: string; routine_id?: string }[],
  routineNames: ReadonlyMap<string, string>,
  weekDateKeys: readonly string[],
): WorkoutSummary {
  const weekKeys = new Set(weekDateKeys);
  const inWeek = logs.filter((log) => {
    const key =
      log.date_key ?? (log.created_at ? safeTimestampToLocalDateKey(log.created_at) : null);
    return key !== null && weekKeys.has(key);
  });
  const last = [...logs]
    .map((log) => ({
      key: log.date_key ?? (log.created_at ? safeTimestampToLocalDateKey(log.created_at) : null),
      name: log.routine_id ? (routineNames.get(log.routine_id) ?? null) : null,
    }))
    .filter((entry): entry is { key: string; name: string | null } => entry.key !== null)
    .sort((a, b) => b.key.localeCompare(a.key))[0];
  return {
    sessionsThisWeek: inWeek.length,
    lastWorkoutName: last?.name ?? null,
    lastWorkoutDateKey: last?.key ?? null,
  };
}

export type CaloriesSummary = {
  consumed: number;
  goal: number;
  remaining: number;
  ratio: number;
};

export function shapeCaloriesSummary(
  entries: readonly { calories: number }[],
  goal: number,
): CaloriesSummary {
  const consumed = caloriesTotal([...entries]);
  return {
    consumed,
    goal,
    remaining: Math.max(0, goal - consumed),
    ratio: goal > 0 ? consumed / goal : 0,
  };
}

export type ProjectsSummary = {
  activeCount: number;
  preview: { id: string; name: string; color: string }[];
};

export function shapeProjectsSummary(projects: readonly Project[]): ProjectsSummary {
  const active = projects.filter((p) => p.status === 'active');
  return {
    activeCount: active.length,
    preview: active.slice(0, 3).map((p) => ({ id: p.id, name: p.name, color: p.color })),
  };
}

export type GoalsSummary = {
  activeCount: number;
  averageProgress: number;
  preview: { id: string; title: string; progressPercent: number }[];
};

export function shapeGoalsSummary(goals: readonly Goal[]): GoalsSummary {
  const active = goals.filter((g) => g.status === 'active');
  return {
    activeCount: active.length,
    averageProgress:
      active.length === 0
        ? 0
        : Math.round(active.reduce((sum, g) => sum + g.progress_percent, 0) / active.length),
    preview: active
      .slice(0, 3)
      .map((g) => ({ id: g.id, title: g.title, progressPercent: g.progress_percent })),
  };
}

// ---------------------------------------------------------------------------
// Empty-state CTA (F9)
// ---------------------------------------------------------------------------

export type EmptyStateCta = {
  label: string;
  destination:
    | { kind: 'section'; section: 'todos' | 'habits' | 'pomodoro' | 'workout' | 'calories' }
    | { kind: 'planning'; view: 'today' | 'projects' | 'goals' };
};

/**
 * Pick the dashboard empty-state CTA from the first non-empty domain in card
 * order (plan → todos → habits → focus → workout → calories → projects →
 * goals). Falls back to the Todos tab when nothing is tracked at all. Keeps
 * the CTA honest even if the "nothing tracked" gate and the summaries ever
 * drift apart.
 */
export function pickEmptyStateCta(summaries: {
  plan: Pick<PlanProgressSummary, 'hasPlan'>;
  todos: Pick<TodosSummary, 'pendingCount'>;
  habits: Pick<HabitsSummary, 'scheduledToday'>;
  focus: Pick<FocusWeekSummary, 'sessionCount'>;
  workout: Pick<WorkoutSummary, 'sessionsThisWeek'>;
  calories: Pick<CaloriesSummary, 'consumed'>;
  projects: Pick<ProjectsSummary, 'activeCount'>;
  goals: Pick<GoalsSummary, 'activeCount'>;
}): EmptyStateCta {
  if (summaries.plan.hasPlan) {
    return { label: 'Review your plan', destination: { kind: 'planning', view: 'today' } };
  }
  if (summaries.todos.pendingCount > 0) {
    return { label: 'Finish your tasks', destination: { kind: 'section', section: 'todos' } };
  }
  if (summaries.habits.scheduledToday > 0) {
    return { label: 'Check on your habits', destination: { kind: 'section', section: 'habits' } };
  }
  if (summaries.focus.sessionCount > 0) {
    return {
      label: 'Start a focus session',
      destination: { kind: 'section', section: 'pomodoro' },
    };
  }
  if (summaries.workout.sessionsThisWeek > 0) {
    return { label: 'Log a workout', destination: { kind: 'section', section: 'workout' } };
  }
  if (summaries.calories.consumed > 0) {
    return { label: 'Log a meal', destination: { kind: 'section', section: 'calories' } };
  }
  if (summaries.projects.activeCount > 0) {
    return { label: 'Open your projects', destination: { kind: 'planning', view: 'projects' } };
  }
  if (summaries.goals.activeCount > 0) {
    return { label: 'Review your goals', destination: { kind: 'planning', view: 'goals' } };
  }
  return { label: 'Add your first task', destination: { kind: 'section', section: 'todos' } };
}
