import type { WorkoutLog } from './types';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
import type {
  BodyWeightEntry,
  WorkoutEffortScale,
  WorkoutModality,
  WorkoutPlanKind,
  WorkoutProgressionMode,
  WorkoutScheduleOverride,
  WorkoutWeeklyPlanEntry,
  WorkoutWeightUnit,
} from '@/core/db/types';
import {
  buildDateRange,
  buildDateRangeOldestFirst,
  dateKeyToLocalDate,
  timestampToLocalDateKey,
  toDateKey,
} from '@/lib/time';

/**
 * Build ActivityDay array from workout logs.
 * A day is "active" if at least one session was logged.
 */
export function buildWorkoutActivityDays(logs: WorkoutLog[], days: number = 364): ActivityDay[] {
  const set = new Set<string>();
  for (const log of logs) {
    set.add(timestampToLocalDateKey(log.completed_at));
  }
  return buildDateRange(days).map((dateKey) => ({
    dateKey,
    active: set.has(dateKey),
  }));
}

export function buildWorkoutHeatmapDays(logs: WorkoutLog[], days: number = 364): HeatmapDay[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const key = timestampToLocalDateKey(log.completed_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buildDateRangeOldestFirst(days).map((dateKey) => ({
    dateKey,
    value: Math.min(3, map.get(dateKey) ?? 0),
  }));
}

/** Consecutive days with a workout, counting backward from today (heatmap days oldest → newest). */
export function computeWorkoutStreakFromHeatmapDays(heatmapDays: HeatmapDay[]): number {
  if (heatmapDays.length === 0) return 0;
  let streak = 0;
  for (let i = heatmapDays.length - 1; i >= 0; i--) {
    if (heatmapDays[i].value > 0) streak++;
    else break;
  }
  return streak;
}

/**
 * Format seconds into MM:SS display string.
 * e.g. 90 → "1:30", 45 → "0:45"
 */
export function formatWorkoutTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Compact relative label for a routine's last performance:
 * Today / Yesterday / "N days ago" / short date (year added once it is stale
 * enough to be ambiguous). Returns null for unparseable input.
 */
export function formatLastPerformedLabel(iso: string, now: Date = new Date()): string | null {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDayMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayGap = Math.round((startOfDayMs(now) - startOfDayMs(then)) / (24 * 60 * 60 * 1000));
  if (dayGap <= 0) return 'Today';
  if (dayGap === 1) return 'Yesterday';
  if (dayGap < 30) return `${dayGap} days ago`;
  const options: Intl.DateTimeFormatOptions =
    then.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' };
  return then.toLocaleDateString('en', options);
}

/**
 * Build the flat sequence of timer phases for a session.
 * Returns an ordered array that the session screen steps through.
 */
export type TimerPhase = {
  exerciseName: string;
  exerciseIndex: number;
  setNumber: number;
  totalSets: number;
  phase: 'active' | 'rest';
  durationSeconds: number;
  modality?: WorkoutModality;
  supersetGroup?: string | null;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  targetLoad?: number | null;
  targetDurationSeconds?: number | null;
  targetDistance?: number | null;
  targetPace?: number | null;
};

export function buildTimerSequence(
  exercises: {
    name: string;
    modality?: WorkoutModality;
    superset_group?: string | null;
    sets: {
      set_number: number;
      active_seconds: number;
      rest_seconds: number;
      target_reps_min?: number | null;
      target_reps_max?: number | null;
      target_load?: number | null;
      target_duration_seconds?: number | null;
      target_distance?: number | null;
      target_pace?: number | null;
    }[];
  }[],
): TimerPhase[] {
  const sequence: TimerPhase[] = [];

  exercises.forEach((exercise, exIndex) => {
    exercise.sets.forEach((set) => {
      sequence.push({
        exerciseName: exercise.name,
        exerciseIndex: exIndex,
        setNumber: set.set_number,
        totalSets: exercise.sets.length,
        phase: 'active',
        durationSeconds:
          (exercise.modality === 'timed' || exercise.modality === 'cardio') &&
          set.target_duration_seconds != null
            ? set.target_duration_seconds
            : set.active_seconds,
        ...(exercise.modality ? { modality: exercise.modality } : {}),
        ...(exercise.superset_group !== undefined
          ? { supersetGroup: exercise.superset_group }
          : {}),
        ...(set.target_reps_min !== undefined ? { targetRepsMin: set.target_reps_min } : {}),
        ...(set.target_reps_max !== undefined ? { targetRepsMax: set.target_reps_max } : {}),
        ...(set.target_load !== undefined ? { targetLoad: set.target_load } : {}),
        ...(set.target_duration_seconds !== undefined
          ? { targetDurationSeconds: set.target_duration_seconds }
          : {}),
        ...(set.target_distance !== undefined ? { targetDistance: set.target_distance } : {}),
        ...(set.target_pace !== undefined ? { targetPace: set.target_pace } : {}),
      });
      const nextExercise = exercises[exIndex + 1];
      const staysInsideSuperset =
        set.set_number === exercise.sets.length &&
        Boolean(exercise.superset_group) &&
        nextExercise?.superset_group === exercise.superset_group;
      const isLastSet = exIndex === exercises.length - 1 && set.set_number === exercise.sets.length;
      if (!isLastSet && !staysInsideSuperset) {
        sequence.push({
          exerciseName: exercise.name,
          exerciseIndex: exIndex,
          setNumber: set.set_number,
          totalSets: exercise.sets.length,
          phase: 'rest',
          durationSeconds: set.rest_seconds,
          ...(exercise.modality ? { modality: exercise.modality } : {}),
          ...(exercise.superset_group !== undefined
            ? { supersetGroup: exercise.superset_group }
            : {}),
        });
      }
    });
  });

  return sequence;
}

// --- Personal records ---

/** A single weighted set performed in a session (weight in the user's unit).
 * weight/reps are null when they were not recorded — unknown, never zero. */
export type LoggedSet = {
  exerciseName: string;
  weight: number | null;
  reps: number | null;
};

/** Best lifts found for one exercise across a set history. */
export type PersonalRecord = {
  exerciseName: string;
  /** Best Epley estimated 1RM across all sets. */
  bestEstimated1RM: number;
  /** The set that produced bestEstimated1RM. */
  best1RMSet: LoggedSet | null;
  /** Heaviest single set (top set) regardless of reps. */
  bestTopSetWeight: number;
  bestTopSet: LoggedSet | null;
};

/**
 * Epley estimated one-rep max: weight * (1 + reps / 30).
 * A single rep estimates to the weight itself; invalid input returns 0.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return 0;
  if (weight <= 0 || reps <= 0) return 0;
  // Epley becomes noisy and deceptive at very high reps; keep PRs useful for
  // normal strength work and leave endurance/timed metrics to their own views.
  if (reps > 30) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** A LoggedSet whose weight/reps are recorded and valid for 1RM math. */
export type ValidLoggedSet = LoggedSet & { weight: number; reps: number };

/** True when both values are recorded, finite, and positive — null means
 * "not recorded" and is never treated as a zero measurement. */
export function isValidLoggedSet(set: LoggedSet): set is ValidLoggedSet {
  return (
    set.weight !== null &&
    set.reps !== null &&
    Number.isFinite(set.weight) &&
    Number.isFinite(set.reps) &&
    set.weight > 0 &&
    set.reps > 0 &&
    set.reps <= 30
  );
}

/** Prefer higher estimated 1RM; break ties by heavier weight, then more reps. */
function isFirstSetBetter(a: ValidLoggedSet, b: ValidLoggedSet): boolean {
  const a1rm = estimate1RM(a.weight, a.reps);
  const b1rm = estimate1RM(b.weight, b.reps);
  if (a1rm !== b1rm) return a1rm > b1rm;
  if (a.weight !== b.weight) return a.weight > b.weight;
  return a.reps > b.reps;
}

/**
 * Compute personal records per exercise from a flat set history.
 * Sets without recorded weight/reps (null) are skipped; exercises with no
 * valid weighted sets are omitted.
 */
export function computePersonalRecords(sets: LoggedSet[]): PersonalRecord[] {
  const byExercise = new Map<string, ValidLoggedSet[]>();
  for (const set of sets) {
    if (!isValidLoggedSet(set)) continue;
    const list = byExercise.get(set.exerciseName) ?? [];
    list.push(set);
    byExercise.set(set.exerciseName, list);
  }

  const records: PersonalRecord[] = [];
  for (const [exerciseName, exerciseSets] of byExercise) {
    let best1RMSet: ValidLoggedSet | null = null;
    let bestTopSet: ValidLoggedSet | null = null;
    for (const set of exerciseSets) {
      if (!best1RMSet || isFirstSetBetter(set, best1RMSet)) best1RMSet = set;
      if (!bestTopSet || set.weight > bestTopSet.weight) bestTopSet = set;
    }
    records.push({
      exerciseName,
      bestEstimated1RM: best1RMSet ? estimate1RM(best1RMSet.weight, best1RMSet.reps) : 0,
      best1RMSet,
      bestTopSetWeight: bestTopSet?.weight ?? 0,
      bestTopSet,
    });
  }
  records.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  return records;
}

/**
 * Return exercise names where the current session beats the historical best
 * estimated 1RM (strictly). Exercises with no history count as new records
 * when the session has at least one valid weighted set.
 */
export function findNewPersonalRecords(
  sessionSets: LoggedSet[],
  historySets: LoggedSet[],
): string[] {
  const historyBest = new Map<string, number>();
  for (const record of computePersonalRecords(historySets)) {
    historyBest.set(record.exerciseName, record.bestEstimated1RM);
  }

  const names: string[] = [];
  for (const record of computePersonalRecords(sessionSets)) {
    const prior = historyBest.get(record.exerciseName);
    if (prior === undefined || record.bestEstimated1RM > prior) {
      names.push(record.exerciseName);
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

// --- Volume ---

/** Total completed sets across a session's logged exercises. */
export function computeSessionTotalSets(sessionExercises: { setsCompleted: number }[]): number {
  return sessionExercises.reduce((total, ex) => total + ex.setsCompleted, 0);
}

/**
 * Σ weight×reps across completed sets. Sets without recorded weight/reps are
 * skipped — unknown contributes nothing rather than fabricating volume.
 */
export function computeSessionTotalVolume(
  sets: {
    weight: number | null;
    reps: number | null;
    completed: boolean;
    modality?: WorkoutModality;
  }[],
): number {
  let total = 0;
  for (const set of sets) {
    if (
      !set.completed ||
      set.weight === null ||
      set.reps === null ||
      (set.modality !== undefined &&
        set.modality !== 'weighted_strength' &&
        set.modality !== 'bodyweight')
    )
      continue;
    if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) continue;
    total += set.weight * set.reps;
  }
  return total;
}

/** Modality-aware volume: only known load × reps is measurable. */
export function computeModalityVolume(input: {
  modality: WorkoutModality;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}): number | null {
  if (
    !input.completed ||
    input.weight === null ||
    input.reps === null ||
    !Number.isFinite(input.weight) ||
    !Number.isFinite(input.reps) ||
    input.weight < 0 ||
    input.reps < 0 ||
    (input.modality !== 'weighted_strength' && input.modality !== 'bodyweight')
  ) {
    return null;
  }
  // For bodyweight this is additional external load only; the app never
  // pretends to know the user's body mass.
  return input.weight * input.reps;
}

export type NormalizedEffort = {
  scale: Exclude<WorkoutEffortScale, 'off'>;
  value: number;
} | null;

export function normalizeEffort(
  scale: string | null | undefined,
  value: number | string | null | undefined,
): NormalizedEffort {
  if (scale !== 'rir' && scale !== 'rpe') return null;
  const parsed = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
  if (scale === 'rir' && (parsed < 0 || parsed > 10)) return null;
  if (scale === 'rpe' && (parsed < 1 || parsed > 10)) return null;
  return { scale, value: Math.round(parsed * 10) / 10 };
}

export type WeeklyVolumePoint = {
  /** Local date key of the week's Monday. */
  weekStartKey: string;
  label: string;
  totalSets: number;
  sessions: number;
};

function mondayDateKeyFor(timestampIso: string): string {
  const d = dateKeyToLocalDate(timestampToLocalDateKey(timestampIso));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateKey(d);
}

/**
 * Aggregate sessions into weekly volume buckets (Monday-start, oldest first)
 * for the last N weeks including the current one. Weeks with no sessions
 * still appear with zero volume so charts stay aligned.
 */
export function buildVolumePerWeek(
  sessions: { completedAt: string; totalSets: number }[],
  weeks: number = 8,
  asOf: Date = new Date(),
): WeeklyVolumePoint[] {
  const buckets = new Map<string, { totalSets: number; sessions: number }>();
  const today = new Date(asOf);
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const orderedWeekKeys: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const key = toDateKey(weekStart);
    orderedWeekKeys.push(key);
    buckets.set(key, { totalSets: 0, sessions: 0 });
  }

  for (const session of sessions) {
    const key = mondayDateKeyFor(session.completedAt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.totalSets += session.totalSets;
    bucket.sessions += 1;
  }

  return orderedWeekKeys.map((weekStartKey) => {
    const bucket = buckets.get(weekStartKey) ?? { totalSets: 0, sessions: 0 };
    const d = dateKeyToLocalDate(weekStartKey);
    return {
      weekStartKey,
      label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      totalSets: bucket.totalSets,
      sessions: bucket.sessions,
    };
  });
}

/**
 * Apply the user's default rest seconds to any set that has no explicit rest
 * (rest_seconds === 0), so unset sets inherit the configured default.
 */
export function applyRestDefault(
  exercises: {
    name: string;
    modality?: WorkoutModality;
    superset_group?: string | null;
    sets: {
      set_number: number;
      active_seconds: number;
      rest_seconds: number;
      target_reps_min?: number | null;
      target_reps_max?: number | null;
      target_load?: number | null;
      target_duration_seconds?: number | null;
      target_distance?: number | null;
      target_pace?: number | null;
    }[];
  }[],
  defaultRestSeconds: number,
): {
  name: string;
  modality?: WorkoutModality;
  superset_group?: string | null;
  sets: {
    set_number: number;
    active_seconds: number;
    rest_seconds: number;
    target_reps_min?: number | null;
    target_reps_max?: number | null;
    target_load?: number | null;
    target_duration_seconds?: number | null;
    target_distance?: number | null;
    target_pace?: number | null;
  }[];
}[] {
  if (!Number.isFinite(defaultRestSeconds) || defaultRestSeconds <= 0) return exercises;
  return exercises.map((ex) => ({
    name: ex.name,
    ...(ex.modality !== undefined ? { modality: ex.modality } : {}),
    ...(ex.superset_group !== undefined ? { superset_group: ex.superset_group } : {}),
    sets: ex.sets.map((set) => ({
      ...set,
      rest_seconds: set.rest_seconds > 0 ? set.rest_seconds : Math.round(defaultRestSeconds),
    })),
  }));
}

/**
 * Whether a timer phase was performed to its natural end ('completed') or
 * advanced past via Skip ('skipped'). Skipped active phases are not counted
 * as completed work when the session is logged.
 */
export type PhaseDisposition = 'completed' | 'skipped';

/** Free-text values captured per active phase (raw input strings). */
export type EnteredSetValues = {
  weight: string;
  reps: string;
  duration?: string;
  distance?: string;
  pace?: string;
  effort?: string;
};

/** One recorded active phase, ready to persist as a workout_session_sets row. */
export type SessionSetRecord = {
  exerciseName: string;
  setNumber: number;
  /** null = not recorded (unknown), never a measured zero. */
  weight: number | null;
  /** null = not recorded (unknown). */
  reps: number | null;
  completed: boolean;
  durationSeconds?: number | null;
  distance?: number | null;
  pace?: number | null;
  effortValue?: number | null;
  effortScale?: Exclude<WorkoutEffortScale, 'off'> | null;
};

/**
 * Summarize which exercises were completed and how many sets each had — used
 * when logging the session. Active phases marked 'skipped' in `dispositions`
 * do not count toward setsCompleted; phases without a disposition count as
 * completed (natural timeout).
 */
export function summarizeCompletedSets(
  sequence: TimerPhase[],
  completedUpToIndex: number,
  dispositions?: Readonly<Record<number, PhaseDisposition>>,
): { exerciseName: string; setsCompleted: number }[] {
  const map = new Map<string, number>();
  for (let i = 0; i <= completedUpToIndex; i++) {
    const phase = sequence[i];
    if (!phase || phase.phase !== 'active') continue;
    if (dispositions?.[i] === 'skipped') continue;
    map.set(phase.exerciseName, (map.get(phase.exerciseName) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([exerciseName, setsCompleted]) => ({
    exerciseName,
    setsCompleted,
  }));
}

/** Parse optional free-text numeric entry; empty/invalid/negative → null. */
export function parseOptionalMeasurement(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Collect one record per active phase up to `completedUpToIndex`, pairing the
 * phase's disposition with whatever weight/reps the user entered for it.
 * This is the provenance source for workout_session_sets rows.
 */
export function collectSessionSetRecords(
  sequence: TimerPhase[],
  completedUpToIndex: number,
  dispositions: Readonly<Record<number, PhaseDisposition>>,
  enteredValues: Readonly<Record<number, EnteredSetValues>>,
  effortScale: WorkoutEffortScale = 'off',
): SessionSetRecord[] {
  const records: SessionSetRecord[] = [];
  for (let i = 0; i <= completedUpToIndex; i++) {
    const phase = sequence[i];
    if (!phase || phase.phase !== 'active') continue;
    const entered = enteredValues[i];
    const isExplicitTimed = phase.modality === 'timed' || phase.modality === 'cardio';
    const record: SessionSetRecord = {
      exerciseName: phase.exerciseName,
      setNumber: phase.setNumber,
      // A missing modality is the legacy free-text compatibility path and is
      // intentionally treated like the historic weighted entry flow. Known
      // timed/cardio catalog exercises never get fabricated weight × reps.
      weight: isExplicitTimed ? null : parseOptionalMeasurement(entered?.weight),
      reps: isExplicitTimed ? null : parseOptionalMeasurement(entered?.reps),
      completed: dispositions[i] !== 'skipped',
    };
    if (isExplicitTimed) {
      record.durationSeconds =
        parseOptionalMeasurement(entered?.duration) ??
        (record.completed ? Math.max(0, Math.round(phase.durationSeconds)) : null);
    }
    if (phase.modality === 'cardio') {
      record.distance = parseOptionalMeasurement(entered?.distance);
      record.pace = parseOptionalMeasurement(entered?.pace);
    }
    if (effortScale !== 'off') {
      const effort = parseOptionalMeasurement(entered?.effort);
      const normalized = normalizeEffort(effortScale, effort);
      if (normalized !== null) {
        record.effortValue = normalized.value;
        record.effortScale = normalized.scale;
      }
    }
    records.push(record);
  }
  return records;
}

// --- Previous-session set lookup (per-set entry defaults) ---

/** A recorded weighted set from an earlier session (newest-first ordering). */
export type PreviousSetRow = {
  exerciseName: string;
  setNumber: number;
  weight: number;
  reps: number;
};

export type PreviousSetLookup = {
  /** Most recent value for an exact exercise name + set number. */
  byExerciseSet: Map<string, PreviousSetRow>;
  /** Most recent value for the exercise name at any set number. */
  byExercise: Map<string, PreviousSetRow>;
};

/**
 * Index previous-session rows for default seeding. Rows must be ordered
 * newest-first; the first occurrence of each key wins.
 */
export function buildPreviousSetLookup(rows: PreviousSetRow[]): PreviousSetLookup {
  const byExerciseSet = new Map<string, PreviousSetRow>();
  const byExercise = new Map<string, PreviousSetRow>();
  for (const row of rows) {
    const exactKey = `${row.exerciseName}::${row.setNumber}`;
    if (!byExerciseSet.has(exactKey)) byExerciseSet.set(exactKey, row);
    if (!byExercise.has(row.exerciseName)) byExercise.set(row.exerciseName, row);
  }
  return { byExerciseSet, byExercise };
}

/** Previous-session values for a set, falling back from exact set number to
 * the exercise's most recent set of any number. Returns null when unknown. */
export function lookupPreviousSet(
  lookup: PreviousSetLookup | null,
  exerciseName: string,
  setNumber: number,
): PreviousSetRow | null {
  if (!lookup) return null;
  return (
    lookup.byExerciseSet.get(`${exerciseName}::${setNumber}`) ??
    lookup.byExercise.get(exerciseName) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Gym V2 pure training domain
// ---------------------------------------------------------------------------

export type ScheduleResolution = {
  dateKey: string;
  source: 'override' | 'weekly' | 'rest';
  planKind: WorkoutPlanKind;
  routineId: string | null;
  movedFromDateKey: string | null;
  note: string | null;
};

function mondayWeekdayForDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(year, month - 1, day, 12, 0, 0, 0);
  return ((value.getDay() + 6) % 7) + 1;
}

/** Resolve one local-calendar date without mutating the recurring plan. */
export function resolveWorkoutSchedule(
  dateKey: string,
  weeklyPlan: readonly WorkoutWeeklyPlanEntry[],
  overrides: readonly WorkoutScheduleOverride[],
): ScheduleResolution {
  const override = overrides.find(
    (entry) => entry.date_key === dateKey && entry.deleted_at === null,
  );
  if (override) {
    return {
      dateKey,
      source: 'override',
      planKind: override.override_kind,
      routineId: override.routine_id,
      movedFromDateKey: override.moved_from_date_key,
      note: override.note,
    };
  }
  const weekly = weeklyPlan.find(
    (entry) => entry.weekday === mondayWeekdayForDateKey(dateKey) && entry.deleted_at === null,
  );
  if (!weekly) {
    return {
      dateKey,
      source: 'rest',
      planKind: 'rest',
      routineId: null,
      movedFromDateKey: null,
      note: null,
    };
  }
  return {
    dateKey,
    source: 'weekly',
    planKind: weekly.plan_kind,
    routineId: weekly.routine_id,
    movedFromDateKey: null,
    note: weekly.note,
  };
}

export type ProgressionSet = {
  completed: boolean;
  weight: number | null;
  reps: number | null;
};

export type ProgressionInput = {
  mode: WorkoutProgressionMode;
  currentLoad: number | null;
  increment: number | null;
  minReps: number | null;
  maxReps: number | null;
  latestSets: readonly ProgressionSet[];
};

export type ProgressionRecommendation = {
  mode: WorkoutProgressionMode;
  action: 'hold' | 'increase_load' | 'increase_reps';
  nextLoad: number | null;
  nextRepsMin: number | null;
  nextRepsMax: number | null;
  reasonCode:
    | 'manual'
    | 'insufficient_history'
    | 'unknown_or_skipped'
    | 'completed_prescription'
    | 'range_not_capped';
  explanation: string;
};

const holdRecommendation = (
  input: ProgressionInput,
  reasonCode: ProgressionRecommendation['reasonCode'],
  explanation: string,
): ProgressionRecommendation => ({
  mode: input.mode,
  action: 'hold',
  nextLoad: input.currentLoad,
  nextRepsMin: input.minReps,
  nextRepsMax: input.maxReps,
  reasonCode,
  explanation,
});

/**
 * Deterministic progression V1. `latestSets` is one completed session only;
 * callers choose the latest immutable history before invoking this reducer.
 */
export function recommendProgression(input: ProgressionInput): ProgressionRecommendation {
  if (input.mode === 'none') {
    return holdRecommendation(
      input,
      'manual',
      'Manual mode records history but proposes no change.',
    );
  }
  if (input.latestSets.length === 0) {
    return holdRecommendation(
      input,
      'insufficient_history',
      'There is not enough completed history to recommend a change.',
    );
  }
  if (
    input.latestSets.some(
      (set) =>
        !set.completed ||
        set.reps === null ||
        !Number.isFinite(set.reps) ||
        set.reps <= 0 ||
        (input.mode === 'linear' && (set.weight === null || !Number.isFinite(set.weight))),
    )
  ) {
    return holdRecommendation(
      input,
      'unknown_or_skipped',
      'Progression is held because a set was skipped, incomplete, or recorded without enough information.',
    );
  }

  if (input.mode === 'linear') {
    const increment = input.increment;
    const targetReps = input.minReps ?? input.maxReps;
    const allMeetTarget =
      targetReps === null || input.latestSets.every((set) => (set.reps ?? 0) >= targetReps);
    if (!allMeetTarget || input.currentLoad === null || increment === null || increment <= 0) {
      return holdRecommendation(
        input,
        'range_not_capped',
        'The prescribed work was recorded, but the load increment or target is not configured yet.',
      );
    }
    const nextLoad = Math.round((input.currentLoad + increment) * 100) / 100;
    return {
      ...holdRecommendation(
        input,
        'completed_prescription',
        `All prescribed work was completed; next load increases by ${increment}.`,
      ),
      action: 'increase_load',
      nextLoad,
    };
  }

  const minReps = input.minReps;
  const maxReps = input.maxReps;
  if (minReps === null || maxReps === null || minReps <= 0 || maxReps < minReps) {
    return holdRecommendation(
      input,
      'insufficient_history',
      'Double progression needs a valid rep range.',
    );
  }
  const allAtCeiling = input.latestSets.every((set) => (set.reps ?? 0) >= maxReps);
  if (!allAtCeiling) {
    const nextMin = Math.min(maxReps, minReps + 1);
    const nextMax = Math.min(maxReps, maxReps + 1);
    return {
      ...holdRecommendation(
        input,
        'range_not_capped',
        `The rep range is still building toward ${maxReps}; add one rep before adding load.`,
      ),
      action: 'increase_reps',
      nextRepsMin: nextMin,
      nextRepsMax: nextMax,
    };
  }
  if (input.currentLoad === null || input.increment === null || input.increment <= 0) {
    return holdRecommendation(
      input,
      'range_not_capped',
      'The rep ceiling was reached, but no load increment is configured.',
    );
  }
  return {
    ...holdRecommendation(
      input,
      'completed_prescription',
      `Every qualifying set reached ${maxReps} reps; load increases by ${input.increment}.`,
    ),
    action: 'increase_load',
    nextLoad: Math.round((input.currentLoad + input.increment) * 100) / 100,
    nextRepsMin: minReps,
    nextRepsMax: maxReps,
  };
}

export type BodyWeightTrend = {
  first: BodyWeightEntry | null;
  latest: BodyWeightEntry | null;
  change: number | null;
  direction: 'up' | 'down' | 'steady' | 'insufficient_data';
};

export function convertWeight(
  value: number,
  from: WorkoutWeightUnit,
  to: WorkoutWeightUnit,
): number {
  if (from === to) return value;
  return from === 'kg' ? value * 2.2046226218 : value / 2.2046226218;
}

export function computeBodyWeightTrend(entries: readonly BodyWeightEntry[]): BodyWeightTrend {
  const ordered = [...entries]
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  const first = ordered[0] ?? null;
  const latest = ordered[ordered.length - 1] ?? null;
  if (!first || !latest || first.id === latest.id) {
    return { first, latest, change: null, direction: 'insufficient_data' };
  }
  const latestInFirstUnit = convertWeight(latest.weight, latest.unit, first.unit);
  const change = latestInFirstUnit - first.weight;
  const epsilon = 0.01;
  return {
    first,
    latest,
    change,
    direction: change > epsilon ? 'up' : change < -epsilon ? 'down' : 'steady',
  };
}

export type TrainingTotals = {
  sessions: number;
  completedSets: number;
  durationSeconds: number;
  measurableVolume: number;
  trainingDays: number;
  recentPrs: number;
};

export function computeTrainingTotals(
  sessions: readonly {
    completedAt: string;
    durationSeconds?: number | null;
    sets: readonly {
      completed: boolean;
      weight: number | null;
      reps: number | null;
      modality?: WorkoutModality;
    }[];
    isPr?: boolean;
  }[],
): TrainingTotals {
  const days = new Set<string>();
  let completedSets = 0;
  let durationSeconds = 0;
  let measurableVolume = 0;
  let recentPrs = 0;
  for (const session of sessions) {
    days.add(timestampToLocalDateKey(session.completedAt));
    if (typeof session.durationSeconds === 'number' && Number.isFinite(session.durationSeconds)) {
      durationSeconds += Math.max(0, session.durationSeconds);
    }
    for (const set of session.sets) {
      if (set.completed) completedSets += 1;
      measurableVolume +=
        computeModalityVolume({
          modality: set.modality ?? 'weighted_strength',
          weight: set.weight,
          reps: set.reps,
          completed: set.completed,
        }) ?? 0;
    }
    if (session.isPr) recentPrs += 1;
  }
  return {
    sessions: sessions.length,
    completedSets,
    durationSeconds,
    measurableVolume,
    trainingDays: days.size,
    recentPrs,
  };
}

export function computeBodyAreaDistribution(
  exercises: readonly { primaryArea: string; setsCompleted: number }[],
): { area: string; sets: number }[] {
  const totals = new Map<string, number>();
  for (const exercise of exercises) {
    if (!exercise.primaryArea || exercise.setsCompleted <= 0) continue;
    totals.set(
      exercise.primaryArea,
      (totals.get(exercise.primaryArea) ?? 0) + exercise.setsCompleted,
    );
  }
  return [...totals.entries()]
    .map(([area, sets]) => ({ area, sets }))
    .sort((a, b) => b.sets - a.sets || a.area.localeCompare(b.area));
}
