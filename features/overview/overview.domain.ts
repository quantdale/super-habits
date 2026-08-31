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

export const DEFAULT_CARD_LAYOUT: OverviewCardId[] = [
  'plan',
  'todos',
  'habits',
  'focus',
  'workout',
  'calories',
];

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
  // Orientation stability: customization may reorder or hide individual
  // cards, but an empty/all-hidden layout must not erase all daily
  // orientation — fall back to the default order instead of zero cards.
  if (result.length === 0) return [...DEFAULT_CARD_LAYOUT];
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

/**
 * Long local date label for the Today header (e.g. "Thursday, August 21").
 * Uses Intl with the device locale — no new dependencies.
 */
export function formatTodayHeading(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
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
  /** Tasks completed today (by `completed_at` local date) for the progress strip. */
  completedTodayCount: number;
  /** Bounded preview list: overdue first, then due today, then top pending. */
  preview: Todo[];
};

export function shapeTodosSummary(todos: readonly Todo[], todayKey: string): TodosSummary {
  const pending = todos.filter((t) => t.completed === 0);
  const overdue = pending.filter((t) => t.due_date !== null && t.due_date < todayKey);
  const dueToday = pending.filter((t) => t.due_date === todayKey);
  const rest = pending.filter((t) => t.due_date === null || t.due_date > todayKey);
  const completedTodayCount = todos.filter(
    (t) =>
      t.completed === 1 &&
      typeof t.completed_at === 'string' &&
      timestampToLocalDateKey(t.completed_at) === todayKey,
  ).length;
  return {
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    pendingCount: pending.length,
    completedTodayCount,
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
  todayState?: WorkoutTodayState;
  plannedWorkoutName?: string | null;
};

export type WorkoutTodayState = 'planned' | 'resumable' | 'completed' | 'rest' | 'unplanned';

export type WorkoutTodayContext = {
  state: WorkoutTodayState;
  plannedWorkoutName: string | null;
};

export function shapeWorkoutSummary(
  logs: readonly { created_at?: string; date_key?: string; routine_id?: string }[],
  routineNames: ReadonlyMap<string, string>,
  weekDateKeys: readonly string[],
  today?: WorkoutTodayContext,
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
  const summary: WorkoutSummary = {
    sessionsThisWeek: inWeek.length,
    lastWorkoutName: last?.name ?? null,
    lastWorkoutDateKey: last?.key ?? null,
  };
  if (today) {
    summary.todayState = today.state;
    summary.plannedWorkoutName = today.plannedWorkoutName;
  }
  return summary;
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

/** Minimal per-module signals the empty-state chain needs. */
type EmptyStateSummaries = {
  plan: Pick<PlanProgressSummary, 'hasPlan'>;
  todos: Pick<TodosSummary, 'pendingCount'>;
  habits: Pick<HabitsSummary, 'scheduledToday'>;
  focus: Pick<FocusWeekSummary, 'sessionCount'>;
  workout: Pick<WorkoutSummary, 'sessionsThisWeek'>;
  calories: Pick<CaloriesSummary, 'consumed'>;
  projects: Pick<ProjectsSummary, 'activeCount'>;
  goals: Pick<GoalsSummary, 'activeCount'>;
};

/**
 * Ordered candidate list mirroring the domain chain in card order (plan →
 * todos → habits → focus → workout → calories → projects → goals). Kept in
 * one place so `pickEmptyStateCta` and `listEmptyStateCtas` never drift.
 */
const EMPTY_STATE_CHAIN: { when: (s: EmptyStateSummaries) => boolean; cta: EmptyStateCta }[] = [
  {
    when: (s) => s.plan.hasPlan,
    cta: { label: 'Review your plan', destination: { kind: 'planning', view: 'today' } },
  },
  {
    when: (s) => s.todos.pendingCount > 0,
    cta: { label: 'Finish your tasks', destination: { kind: 'section', section: 'todos' } },
  },
  {
    when: (s) => s.habits.scheduledToday > 0,
    cta: { label: 'Check on your habits', destination: { kind: 'section', section: 'habits' } },
  },
  {
    when: (s) => s.focus.sessionCount > 0,
    cta: { label: 'Start a focus session', destination: { kind: 'section', section: 'pomodoro' } },
  },
  {
    when: (s) => s.workout.sessionsThisWeek > 0,
    cta: { label: 'Log a workout', destination: { kind: 'section', section: 'workout' } },
  },
  {
    when: (s) => s.calories.consumed > 0,
    cta: { label: 'Log a meal', destination: { kind: 'section', section: 'calories' } },
  },
  {
    when: (s) => s.projects.activeCount > 0,
    cta: { label: 'Open your projects', destination: { kind: 'planning', view: 'projects' } },
  },
  {
    when: (s) => s.goals.activeCount > 0,
    cta: { label: 'Review your goals', destination: { kind: 'planning', view: 'goals' } },
  },
];

/** Fixed first-run starters appended when the chain has no match yet. */
const EMPTY_STATE_STARTERS: EmptyStateCta[] = [
  { label: 'Add your first task', destination: { kind: 'section', section: 'todos' } },
  { label: 'Track a habit', destination: { kind: 'section', section: 'habits' } },
  { label: 'Start a focus session', destination: { kind: 'section', section: 'pomodoro' } },
];

function pickChainMatch(summaries: EmptyStateSummaries): EmptyStateCta | null {
  for (const candidate of EMPTY_STATE_CHAIN) {
    if (candidate.when(summaries)) return candidate.cta;
  }
  return null;
}

/**
 * Pick the dashboard empty-state CTA from the first non-empty domain in card
 * order (plan → todos → habits → focus → workout → calories → projects →
 * goals). Falls back to the Todos tab when nothing is tracked at all. Keeps
 * the CTA honest even if the "nothing tracked" gate and the summaries ever
 * drift apart.
 */
export function pickEmptyStateCta(summaries: EmptyStateSummaries): EmptyStateCta {
  return pickChainMatch(summaries) ?? EMPTY_STATE_STARTERS[0];
}

/**
 * Guided-starter CTA list for the zero-data panel: the primary CTA from the
 * existing chain plus up to two follow-up options (next chain matches, then
 * fixed first-run starters). Still one panel — no wizard.
 */
export function listEmptyStateCtas(summaries: EmptyStateSummaries): EmptyStateCta[] {
  const result: EmptyStateCta[] = [];
  const add = (cta: EmptyStateCta) => {
    if (result.length < 3 && !result.some((existing) => existing.label === cta.label)) {
      result.push(cta);
    }
  };
  for (const candidate of EMPTY_STATE_CHAIN) {
    if (candidate.when(summaries)) add(candidate.cta);
  }
  for (const starter of EMPTY_STATE_STARTERS) add(starter);
  return result.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Next Best Action (docs/ui-ux/04-roadmap-and-acceptance.md Phase 4.1)
// ---------------------------------------------------------------------------

/** Section the Next Best Action deep-links to (DashboardCard-style keys). */
export type NextBestActionSectionKey = 'todos' | 'habits' | 'focus' | 'workout' | 'calories';

export type NextBestAction = {
  sectionKey: NextBestActionSectionKey;
  /** Concrete action title (e.g. the task title or "{n} habits left today"). */
  title: string;
  /** Transparent, human-readable reason this action is surfaced. */
  reason: string;
};

export type NextBestActionInput = {
  todayKey: string;
  todos: Pick<TodosSummary, 'overdueCount' | 'dueTodayCount' | 'preview'>;
  habits: Pick<HabitsSummary, 'scheduledToday' | 'completedToday'>;
  focus: Pick<FocusWeekSummary, 'sessionCount' | 'perDayMinutes'>;
  /** True when a Pomodoro timer intent exists for today (running/pausable). */
  focusTimerActive: boolean;
  workout: Pick<WorkoutSummary, 'lastWorkoutDateKey' | 'todayState' | 'plannedWorkoutName'>;
  /** Saved routines count — a routine counts as the user's planned workout. */
  workoutRoutineCount: number;
  calories: Pick<CaloriesSummary, 'consumed'>;
  /** True when calories have any recent entries (module actively used). */
  caloriesInUse: boolean;
};

/**
 * Deterministic cross-feature Next Best Action, ranked strictly:
 * overdue task → due-today task → incomplete scheduled habits → running/
 * pausable focus session (or start one when none today) → planned-but-not-
 * started workout today → calories not yet logged today. Each step only
 * fires for modules that actually have data; returns null when nothing
 * qualifies so the hero stays hidden instead of guessing. No opaque score —
 * every action carries an explicit reason string.
 */
export function pickNextBestAction(input: NextBestActionInput): NextBestAction | null {
  const { todayKey } = input;

  // 1–2. Overdue, then due-today tasks (`preview` is ordered overdue-first).
  if (input.todos.overdueCount > 0) {
    const todo = input.todos.preview.find(
      (t) => t.completed === 0 && t.due_date !== null && t.due_date < todayKey,
    );
    return {
      sectionKey: 'todos',
      title: todo ? todo.title : 'Handle your overdue tasks',
      reason: 'Overdue',
    };
  }
  if (input.todos.dueTodayCount > 0) {
    const todo = input.todos.preview.find((t) => t.completed === 0 && t.due_date === todayKey);
    return {
      sectionKey: 'todos',
      title: todo ? todo.title : 'Finish your tasks due today',
      reason: 'Due today',
    };
  }

  // 3. Incomplete scheduled habits.
  const habitsLeft = input.habits.scheduledToday - input.habits.completedToday;
  if (input.habits.scheduledToday > 0 && habitsLeft > 0) {
    return {
      sectionKey: 'habits',
      title: `${habitsLeft} ${habitsLeft === 1 ? 'habit' : 'habits'} left today`,
      reason: `${habitsLeft} scheduled left`,
    };
  }

  // 4. Focus: resume a live session before suggesting a fresh one.
  if (input.focusTimerActive) {
    return {
      sectionKey: 'focus',
      title: 'Resume your focus session',
      reason: 'Session in progress',
    };
  }
  const focusMinutesToday =
    input.focus.perDayMinutes.find((day) => day.dateKey === todayKey)?.minutes ?? 0;
  if (input.focus.sessionCount > 0 && focusMinutesToday === 0) {
    return {
      sectionKey: 'focus',
      title: 'Start a focus session',
      reason: 'No focus yet today',
    };
  }

  // 5. Workout state is schedule-aware when available. Keep the routine-count
  // fallback for callers and historical tests that predate the weekly plan.
  if (input.workout.todayState === 'resumable') {
    return {
      sectionKey: 'workout',
      title: "Resume today's workout",
      reason: 'Workout in progress',
    };
  }
  if (input.workout.todayState === 'planned') {
    return {
      sectionKey: 'workout',
      title: input.workout.plannedWorkoutName
        ? `Start ${input.workout.plannedWorkoutName}`
        : "Start today's workout",
      reason: 'Planned for today',
    };
  }
  if (
    input.workout.todayState === undefined &&
    input.workoutRoutineCount > 0 &&
    input.workout.lastWorkoutDateKey !== todayKey
  ) {
    return {
      sectionKey: 'workout',
      title: "Start today's workout",
      reason: 'Planned for today',
    };
  }

  // 6. Calories not yet logged today — only for modules actually in use.
  if (input.caloriesInUse && input.calories.consumed === 0) {
    return {
      sectionKey: 'calories',
      title: 'Log your first meal',
      reason: 'Nothing logged today',
    };
  }

  return null;
}
