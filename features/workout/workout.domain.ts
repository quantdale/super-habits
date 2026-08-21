import type { WorkoutLog } from './types';
import type { ActivityDay, HeatmapDay } from '@/features/shared/activityTypes';
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
};

export function buildTimerSequence(
  exercises: {
    name: string;
    sets: {
      set_number: number;
      active_seconds: number;
      rest_seconds: number;
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
        durationSeconds: set.active_seconds,
      });
      const isLastSet = exIndex === exercises.length - 1 && set.set_number === exercise.sets.length;
      if (!isLastSet) {
        sequence.push({
          exerciseName: exercise.name,
          exerciseIndex: exIndex,
          setNumber: set.set_number,
          totalSets: exercise.sets.length,
          phase: 'rest',
          durationSeconds: set.rest_seconds,
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
    set.reps > 0
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
  sets: { weight: number | null; reps: number | null; completed: boolean }[],
): number {
  let total = 0;
  for (const set of sets) {
    if (!set.completed || set.weight === null || set.reps === null) continue;
    if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) continue;
    total += set.weight * set.reps;
  }
  return total;
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
): WeeklyVolumePoint[] {
  const buckets = new Map<string, { totalSets: number; sessions: number }>();
  const today = new Date();
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
    sets: {
      set_number: number;
      active_seconds: number;
      rest_seconds: number;
    }[];
  }[],
  defaultRestSeconds: number,
): {
  name: string;
  sets: { set_number: number; active_seconds: number; rest_seconds: number }[];
}[] {
  if (!Number.isFinite(defaultRestSeconds) || defaultRestSeconds <= 0) return exercises;
  return exercises.map((ex) => ({
    name: ex.name,
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

/** Free-text weight/reps entry captured per active phase (raw input strings). */
export type EnteredSetValues = { weight: string; reps: string };

/** One recorded active phase, ready to persist as a workout_session_sets row. */
export type SessionSetRecord = {
  exerciseName: string;
  setNumber: number;
  /** null = not recorded (unknown), never a measured zero. */
  weight: number | null;
  /** null = not recorded (unknown). */
  reps: number | null;
  completed: boolean;
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
): SessionSetRecord[] {
  const records: SessionSetRecord[] = [];
  for (let i = 0; i <= completedUpToIndex; i++) {
    const phase = sequence[i];
    if (!phase || phase.phase !== 'active') continue;
    const entered = enteredValues[i];
    records.push({
      exerciseName: phase.exerciseName,
      setNumber: phase.setNumber,
      weight: parseOptionalMeasurement(entered?.weight),
      reps: parseOptionalMeasurement(entered?.reps),
      completed: dispositions[i] !== 'skipped',
    });
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
