import { formatLastPerformedLabel } from './workout.domain';
import type { WorkoutWeeklyPlanEntry, WorkoutRoutine } from '@/core/db/types';

/**
 * Pure view models for the Workout landing. No DB, no React: the screen
 * resolves data, these helpers decide what the landing says and in what
 * order the training state wins. Keeping the rules here makes the landing
 * hierarchy unit-testable (SYS-20: rest day must not own the hero; a valid
 * draft owns one dominant Resume).
 */

export type TrainingStateKind = 'resume' | 'scheduled' | 'rest' | 'free';

export type TrainingAction = 'resume' | 'start-scheduled' | 'choose-routine' | 'none';

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
  const { schedule, scheduledRoutine, completedToday, draftRoutineName, hasDraft } = input;

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

export type WeekStripCell = {
  weekday: number;
  dayLabel: string;
  isToday: boolean;
  /** 'workout' = a routine is assigned; 'rest' = explicit rest; 'unassigned' = nothing planned. */
  state: 'workout' | 'rest' | 'unassigned';
  routineName: string | null;
  /** True when today's cell reflects a one-day override over the template. */
  isOverride: boolean;
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
}): WeekStripCell[] {
  const { weeklyPlan, routines, todayWeekday, todayResolution } = input;
  const nameById = new Map(routines.map((routine) => [routine.id, routine.name]));
  const entryByDay = new Map(weeklyPlan.map((entry) => [entry.weekday, entry]));
  return Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => {
    const isToday = weekday === todayWeekday;
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
      };
    }
    return {
      weekday,
      dayLabel: weekdayShortLabel(weekday),
      isToday,
      state: 'unassigned' as const,
      routineName: null,
      isOverride: false,
    };
  });
}
