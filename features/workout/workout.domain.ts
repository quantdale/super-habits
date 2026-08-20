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
 * Build workout frequency data for bar chart.
 * Returns sessions per day for last N days, today first.
 */
export function buildWorkoutFrequency(
  logs: WorkoutLog[],
  days: number = 30,
): { dateKey: string; label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const log of logs) {
    const key = timestampToLocalDateKey(log.completed_at);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buildDateRange(days).map((dateKey) => {
    const d = dateKeyToLocalDate(dateKey);
    return {
      dateKey,
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      value: map.get(dateKey) ?? 0,
    };
  });
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
 * Parse "MM:SS" or plain seconds string into total seconds.
 * Returns 0 for invalid input.
 */
export function parseWorkoutTime(input: string): number {
  if (input == null) return 0;
  if (input.includes(':')) {
    const [m, s] = input.split(':').map(Number);
    if (Number.isFinite(m) && Number.isFinite(s)) {
      return m * 60 + s;
    }
    return 0;
  }
  const n = Number(input);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Calculate total session duration in seconds.
 * Sum of (active_seconds + rest_seconds) for every set
 * across all exercises — gives an estimate before starting.
 */
export function calculateSessionDuration(
  exercises: {
    sets: { active_seconds: number; rest_seconds: number }[];
  }[],
): number {
  return exercises.reduce((total, ex) => {
    return total + ex.sets.reduce((s, set) => s + set.active_seconds + set.rest_seconds, 0);
  }, 0);
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

/** A single weighted set performed in a session (weight in the user's unit). */
export type LoggedSet = {
  exerciseName: string;
  weight: number;
  reps: number;
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

/** Prefer higher estimated 1RM; break ties by heavier weight, then more reps. */
function isFirstSetBetter(a: LoggedSet, b: LoggedSet): boolean {
  const a1rm = estimate1RM(a.weight, a.reps);
  const b1rm = estimate1RM(b.weight, b.reps);
  if (a1rm !== b1rm) return a1rm > b1rm;
  if (a.weight !== b.weight) return a.weight > b.weight;
  return a.reps > b.reps;
}

/**
 * Compute personal records per exercise from a flat set history.
 * Exercises with no valid weighted sets are omitted.
 */
export function computePersonalRecords(sets: LoggedSet[]): PersonalRecord[] {
  const byExercise = new Map<string, LoggedSet[]>();
  for (const set of sets) {
    if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) continue;
    if (set.weight <= 0 || set.reps <= 0) continue;
    const list = byExercise.get(set.exerciseName) ?? [];
    list.push(set);
    byExercise.set(set.exerciseName, list);
  }

  const records: PersonalRecord[] = [];
  for (const [exerciseName, exerciseSets] of byExercise) {
    let best1RMSet: LoggedSet | null = null;
    let bestTopSet: LoggedSet | null = null;
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
export function computeSessionTotalSets(
  sessionExercises: { setsCompleted: number }[],
): number {
  return sessionExercises.reduce((total, ex) => total + ex.setsCompleted, 0);
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
): { name: string; sets: { set_number: number; active_seconds: number; rest_seconds: number }[] }[] {
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
 * Summarize which exercises were completed and how many sets
 * each had — used when logging the session.
 */
export function summarizeCompletedSets(
  sequence: TimerPhase[],
  completedUpToIndex: number,
): { exerciseName: string; setsCompleted: number }[] {
  const map = new Map<string, number>();
  for (let i = 0; i <= completedUpToIndex; i++) {
    const phase = sequence[i];
    if (!phase || phase.phase !== 'active') continue;
    map.set(phase.exerciseName, (map.get(phase.exerciseName) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([exerciseName, setsCompleted]) => ({
    exerciseName,
    setsCompleted,
  }));
}
