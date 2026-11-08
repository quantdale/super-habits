import { formatLastPerformedLabel } from './workout.domain';
import type { WorkoutWeeklyPlanEntry, WorkoutRoutine } from '@/core/db/types';

/**
 * Pure view models for the Workout landing. No DB, no React: the screen
 * resolves data, these helpers decide what the landing says and in what
 * order the training state wins. Keeping the rules here makes the landing
 * hierarchy unit-testable (SYS-20: rest day must not own the hero; a valid
 * draft owns one dominant Resume).
 */

export type TrainingStateKind = 'resume' | 'pending-save' | 'scheduled' | 'rest' | 'free';

export type TrainingAction =
  'resume' | 'retry-save' | 'start-scheduled' | 'choose-routine' | 'none';

export type TrainingState = {
  kind: TrainingStateKind;
  /** Compact context line, e.g. "Today · Push Day" / "Today · Rest scheduled". */
  contextLine: string;
  /** One-line statement of the current training situation. */
  headline: string;
  /** Supporting sentence: counts, saved-progress explanation, or guidance. */
  detail: string;
  /** The landing's single dominant action. */
  primaryLabel: string | null;
  primaryAction: TrainingAction;
  /** Routine the primary action starts, when it starts a specific routine. */
  primaryRoutineId: string | null;
  /** True when the state must also explain that a scheduled workout exists. */
  completedToday: boolean;
};

export type TrainingStateInput = {
  /** Resolved schedule for today (weekly entry or one-day override). */
  schedule: { planKind: 'workout' | 'rest'; routineId: string | null } | null;
  /** Today's scheduled routine with exercises, when resolved. */
  scheduledRoutine: { id: string; name: string; exerciseCount: number; setCount: number } | null;
  completedToday: boolean;
  draftRoutineName: string | null;
  hasDraft: boolean;
  routineCount: number;
  /**
   * A finished session whose save has not committed (`AUD-SH04-A`).
   *
   * This outranks the draft and the schedule: a user who completed every set but
   * whose save failed must see the retry first, or their performed workout is
   * silently stranded behind a "start today's workout" hero.
   */
  pendingSave?: { routineName: string | null; lastError: string | null } | null;
};

const WEEKDAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday - 1] ?? `Day ${weekday}`;
}

export function weekdayShortLabel(weekday: number): string {
  return weekdayLabel(weekday).slice(0, 3);
}

/**
 * The training state wins in a fixed order: a persisted draft outranks the
 * schedule (resume is the one dominant action), then today's scheduled
 * routine, then rest context, then a free day. A rest day never produces a
 * hero — it is a compact line beside the reachable quick-start rows.
 */
export function buildTrainingState(input: TrainingStateInput): TrainingState {
  const { schedule, scheduledRoutine, completedToday, draftRoutineName, hasDraft, pendingSave } =
    input;

  if (pendingSave) {
    const name = pendingSave.routineName ?? 'Your workout';
    return {
      kind: 'pending-save',
      contextLine: `Today · ${name}`,
      headline: 'Workout finished — not saved yet',
      detail: pendingSave.lastError
        ? `${name} is finished. ${pendingSave.lastError}`
        : `${name} is finished but has not been saved. Its sets, durations and effort are kept until you save it or discard it.`,
      primaryLabel: 'Save finished workout',
      primaryAction: 'retry-save',
      primaryRoutineId: null,
      completedToday,
    };
  }

  if (hasDraft) {
    return {
      kind: 'resume',
      contextLine: `Today · ${draftRoutineName ?? 'Workout'}`,
      headline: 'Session in progress',
      detail: `${draftRoutineName ?? 'Your workout'} is saved where you left it — resume to keep logging sets.`,
      primaryLabel: 'Resume workout',
      primaryAction: 'resume',
      primaryRoutineId: null,
      completedToday,
    };
  }

  if (schedule?.planKind === 'workout' && scheduledRoutine) {
    return {
      kind: 'scheduled',
      contextLine: `Today · ${scheduledRoutine.name}`,
      headline: completedToday ? 'Session logged today' : scheduledRoutine.name,
      detail: completedToday
        ? `${scheduledRoutine.name} is in your history. Train again whenever you're ready.`
        : `${scheduledRoutine.exerciseCount} exercise${scheduledRoutine.exerciseCount === 1 ? '' : 's'} · ${scheduledRoutine.setCount} prescribed set${scheduledRoutine.setCount === 1 ? '' : 's'}`,
      primaryLabel: completedToday ? 'Start another session' : "Start today's workout",
      primaryAction: 'start-scheduled',
      primaryRoutineId: scheduledRoutine.id,
      completedToday,
    };
  }

  if (schedule?.planKind === 'rest') {
    return {
      kind: 'rest',
      contextLine: 'Today · Rest scheduled',
      headline: 'Rest day',
      detail:
        input.routineCount > 0
          ? 'Recover, or start any routine below — your weekly plan stays unchanged.'
          : 'Add a routine below to start training on your next work day.',
      primaryLabel: input.routineCount > 0 ? 'Choose a routine' : null,
      primaryAction: input.routineCount > 0 ? 'choose-routine' : 'none',
      primaryRoutineId: null,
      completedToday,
    };
  }

  return {
    kind: 'free',
    contextLine: 'Today · Nothing planned',
    headline: "Ready when you're",
    detail:
      input.routineCount > 0
        ? 'Start any routine below, or plan your week.'
        : 'Create your first routine below to start training.',
    primaryLabel: input.routineCount > 0 ? 'Choose a routine' : null,
    primaryAction: input.routineCount > 0 ? 'choose-routine' : 'none',
    primaryRoutineId: null,
    completedToday,
  };
}

export type RoutineCounts = {
  routineId: string;
  exerciseCount: number;
  setCount: number;
};

export type QuickStartRow = {
  routineId: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  /** "Yesterday" / "3 days ago" / short date, or null when never performed. */
  lastPerformedLabel: string | null;
  isScheduledToday: boolean;
};

/**
 * Compact quick-start rows: the routine identity plus the facts a person
 * needs to choose (size, recent use) and today's schedule marker. A draft
 * for a different routine must not change these rows — start targets the
 * row's routine only.
 */
export function buildQuickStartRows(
  routines: readonly WorkoutRoutine[],
  counts: readonly RoutineCounts[],
  lastPerformed: ReadonlyMap<string, string>,
  todayRoutineId: string | null,
  now: Date = new Date(),
): QuickStartRow[] {
  const countsById = new Map(counts.map((entry) => [entry.routineId, entry]));
  return routines.map((routine) => {
    const count = countsById.get(routine.id);
    const lastAt = lastPerformed.get(routine.id) ?? null;
    return {
      routineId: routine.id,
      name: routine.name,
      exerciseCount: count?.exerciseCount ?? 0,
      setCount: count?.setCount ?? 0,
      lastPerformedLabel: lastAt ? formatLastPerformedLabel(lastAt, now) : null,
      isScheduledToday: todayRoutineId === routine.id,
    };
  });
}

/**
 * Weekdays (1 = Monday … 7 = Sunday) that carry a completed session in the week
 * containing `todayKey`.
 *
 * Pure and clock-free: the week start is derived from `todayKey` (the app's
 * local-calendar key), never from `new Date()`, so a mounted screen that
 * crosses midnight or a Monday rollover cannot keep last week's completion
 * marks — the caller re-derives with the new key and this recomputes.
 *
 * `logs` are the log rows' `completed_at` timestamps; they are converted with
 * the same local-calendar `toDateKey` the rest of the app uses, so a session
 * logged at 23:55 local belongs to that local day, not to UTC's next day.
 */
export function completedWeekdaysForWeek(
  logs: readonly { completed_at: string }[],
  todayKey: string,
  toDateKeyImpl: (date: Date) => string = (date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },
): number[] {
  const [year, month, day] = todayKey.split('-').map(Number);
  if (!year || !month || !day) return [];
  const today = new Date(year, month - 1, day);
  const monday = new Date(year, month - 1, day);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const nextMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
  const startKey = toDateKeyImpl(monday);
  const endKey = toDateKeyImpl(nextMonday);
  const weekdays = new Set<number>();
  for (const log of logs) {
    const key = toDateKeyImpl(new Date(log.completed_at));
    // Half-open [Monday, next Monday): last Sunday is excluded by construction.
    if (key < startKey || key >= endKey) continue;
    const [y, m, d] = key.split('-').map(Number);
    weekdays.add(((new Date(y, m - 1, d).getDay() + 6) % 7) + 1);
  }
  return [...weekdays].sort((a, b) => a - b);
}

export type WeekStripCell = {
  weekday: number;
  dayLabel: string;
  isToday: boolean;
  /** 'workout' = a routine is assigned; 'rest' = explicit rest; 'unassigned' = nothing planned. */
  state: 'workout' | 'rest' | 'unassigned';
  routineName: string | null;
  /** True when today's cell reflects a one-day override over the template. */
  isOverride: boolean;
  /**
   * True when a completed session was actually logged on this date this week.
   *
   * Assignment and completion are DIFFERENT facts: a planned routine is
   * `state: 'workout'` whether or not it was trained, and only a real history
   * entry makes a node "done". Future days can never be done.
   */
  completed: boolean;
};

/**
 * The collapsed weekly strip. Template rows carry the recurring assignment;
 * today's cell carries the resolved schedule so an override is visible where
 * it matters, marked so the recurring template is never confused with it.
 */
export function buildWeekStrip(input: {
  weeklyPlan: readonly WorkoutWeeklyPlanEntry[];
  routines: readonly WorkoutRoutine[];
  todayWeekday: number;
  todayResolution?: { planKind: 'workout' | 'rest'; routineId: string | null; isOverride: boolean };
  /**
   * Weekdays (1 = Monday) whose date this week carries a completed session in
   * the workout history. Read-only derived data: the caller maps log
   * `completed_at` values onto the current week. Omitted = nothing completed.
   */
  completedWeekdays?: readonly number[];
}): WeekStripCell[] {
  const { weeklyPlan, routines, todayWeekday, todayResolution } = input;
  const nameById = new Map(routines.map((routine) => [routine.id, routine.name]));
  const entryByDay = new Map(weeklyPlan.map((entry) => [entry.weekday, entry]));
  const completedDays = new Set(input.completedWeekdays ?? []);
  return Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => {
    const isToday = weekday === todayWeekday;
    // Completion is only possible for days that have already happened (today
    // included): a future assignment is planned, never done.
    const completed = weekday <= todayWeekday && completedDays.has(weekday);
    if (isToday && todayResolution) {
      const routineName = todayResolution.routineId
        ? (nameById.get(todayResolution.routineId) ?? null)
        : null;
      return {
        weekday,
        dayLabel: weekdayShortLabel(weekday),
        isToday: true,
        state:
          todayResolution.planKind === 'workout' && routineName
            ? ('workout' as const)
            : ('rest' as const),
        routineName,
        isOverride: todayResolution.isOverride,
        completed,
      };
    }
    const entry = entryByDay.get(weekday);
    const routineName = entry?.routine_id ? (nameById.get(entry.routine_id) ?? null) : null;
    if (entry?.plan_kind === 'workout' && routineName) {
      return {
        weekday,
        dayLabel: weekdayShortLabel(weekday),
        isToday,
        state: 'workout' as const,
        routineName,
        isOverride: false,
        completed,
      };
    }
    if (entry?.plan_kind === 'rest') {
      return {
        weekday,
        dayLabel: weekdayShortLabel(weekday),
        isToday,
        state: 'rest' as const,
        routineName: null,
        isOverride: false,
        completed,
      };
    }
    return {
      weekday,
      dayLabel: weekdayShortLabel(weekday),
      isToday,
      state: 'unassigned' as const,
      routineName: null,
      isOverride: false,
      completed,
    };
  });
}
