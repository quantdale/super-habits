/**
 * Pure aggregation/formatting logic for the customizable Overview dashboard.
 * No DB, no React, no side effects — fully unit-testable.
 */

import type { DailyPlan } from '@/core/db/types';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { isHabitScheduledOn } from '@/features/habits/habits.domain';
import type { Goal } from '@/features/goals/goals.types';
import type { Project } from '@/features/projects/projects.types';
import type { Todo } from '@/features/todos/types';
import { caloriesTotal } from '@/features/calories/calories.domain';

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
  /** Ratio 0–1 of completed targets across scheduled habits today. */
  progressRatio: number;
  rings: { id: string; name: string; color: string; count: number; target: number }[];
};

export function shapeHabitsSummary(
  habits: readonly {
    id: string;
    name: string;
    color: string;
    target_per_day: number;
    rule_history?: string | null;
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
  const scheduled = habits.filter((habit) =>
    isHabitScheduledOn(habit.rule_history, todayKey, habit.target_per_day),
  );
  const rings = scheduled.slice(0, 6).map((habit) => ({
    id: habit.id,
    name: habit.name,
    color: habit.color,
    count: Math.min(countByHabit.get(habit.id) ?? 0, habit.target_per_day),
    target: habit.target_per_day,
  }));
  const completedToday = rings.filter((ring) => ring.count >= ring.target).length;
  return {
    scheduledToday: scheduled.length,
    completedToday,
    progressRatio:
      rings.length === 0
        ? 0
        : rings.reduce((sum, ring) => sum + ring.count / Math.max(1, ring.target), 0) /
          rings.length,
    rings,
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
    const key = toDateKeyFromIso(session.started_at);
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

/** Local-calendar date key from an ISO timestamp without importing lib/time side effects. */
function toDateKeyFromIso(timestamp: string): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
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
    const key = log.date_key ?? (log.created_at ? toDateKeyFromIso(log.created_at) : null);
    return key !== null && weekKeys.has(key);
  });
  const last = [...logs]
    .map((log) => ({
      key: log.date_key ?? (log.created_at ? toDateKeyFromIso(log.created_at) : null),
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
