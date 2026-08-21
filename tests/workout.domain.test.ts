import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTimerSequence,
  buildPreviousSetLookup,
  collectSessionSetRecords,
  formatWorkoutTime,
  lookupPreviousSet,
  summarizeCompletedSets,
  buildWorkoutActivityDays,
  buildWorkoutHeatmapDays,
  computeWorkoutStreakFromHeatmapDays,
} from '@/features/workout/workout.domain';
import type { HeatmapDay } from '@/features/shared/activityTypes';
import type { WorkoutLog } from '@/core/db/types';
import { toDateKey } from '@/lib/time';

function workoutLog(completedAt: string): WorkoutLog {
  return {
    id: 'wrk_test1',
    routine_id: 'routine_test',
    notes: null,
    completed_at: completedAt,
    created_at: completedAt,
  };
}

describe('formatWorkoutTime', () => {
  it('formats 90 seconds as 1:30', () => {
    expect(formatWorkoutTime(90)).toBe('1:30');
  });
  it('formats 45 seconds as 0:45', () => {
    expect(formatWorkoutTime(45)).toBe('0:45');
  });
  it('formats 0 as 0:00', () => {
    expect(formatWorkoutTime(0)).toBe('0:00');
  });
  it('pads single-digit seconds', () => {
    expect(formatWorkoutTime(65)).toBe('1:05');
  });
});

describe('buildTimerSequence', () => {
  const exercises = [
    {
      name: 'Rows',
      sets: [
        { set_number: 1, active_seconds: 40, rest_seconds: 20 },
        { set_number: 2, active_seconds: 40, rest_seconds: 20 },
      ],
    },
    {
      name: 'Curls',
      sets: [{ set_number: 1, active_seconds: 30, rest_seconds: 15 }],
    },
  ];

  it('builds correct number of phases', () => {
    expect(buildTimerSequence(exercises)).toHaveLength(5);
  });

  it('last phase is active (no rest after final set)', () => {
    const seq = buildTimerSequence(exercises);
    expect(seq[seq.length - 1].phase).toBe('active');
  });

  it('first phase is active', () => {
    expect(buildTimerSequence(exercises)[0].phase).toBe('active');
  });
});

describe('buildWorkoutActivityDays', () => {
  it('marks a day active when a log falls on that local date', () => {
    const iso = new Date().toISOString();
    const logs = [workoutLog(iso)];
    const days = buildWorkoutActivityDays(logs, 30);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    const d = String(new Date().getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    const todayEntry = days.find((x) => x.dateKey === todayKey);
    expect(todayEntry?.active).toBe(true);
  });
});

describe('buildWorkoutHeatmapDays', () => {
  it('returns 30 entries and caps intensity at 3', () => {
    const iso = new Date().toISOString();
    const logs = [workoutLog(iso), workoutLog(iso), workoutLog(iso), workoutLog(iso)];
    const heat = buildWorkoutHeatmapDays(logs, 30);
    expect(heat).toHaveLength(30);
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    const d = String(new Date().getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`;
    expect(heat.find((h) => h.dateKey === todayKey)?.value).toBe(3);
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps logs on opposite sides of local midnight on separate days', () => {
    const jan1Key = toDateKey(new Date(2026, 0, 1, 12, 0, 0, 0));
    const jan2Key = toDateKey(new Date(2026, 0, 2, 12, 0, 0, 0));
    const heat = buildWorkoutHeatmapDays(
      [
        workoutLog(new Date(2026, 0, 1, 23, 30, 0, 0).toISOString()),
        workoutLog(new Date(2026, 0, 2, 0, 30, 0, 0).toISOString()),
      ],
      2,
    );

    expect(heat).toEqual([
      { dateKey: jan1Key, value: 1 },
      { dateKey: jan2Key, value: 1 },
    ]);
  });
});

describe('computeWorkoutStreakFromHeatmapDays', () => {
  const days = (...values: number[]): HeatmapDay[] =>
    values.map((value, i) => ({ dateKey: `2025-01-${String(i + 1).padStart(2, '0')}`, value }));

  it('returns 0 for empty heatmap', () => {
    expect(computeWorkoutStreakFromHeatmapDays([])).toBe(0);
  });

  it('counts consecutive active days from the last element (today)', () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 0, 1, 1))).toBe(2);
  });

  it('returns 1 when only the last day is active', () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 0, 1, 0, 1))).toBe(1);
  });

  it('returns 0 when the last day is inactive even if yesterday was active', () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(1, 0))).toBe(0);
  });

  it('treats any value > 0 as active (e.g. intensity 3)', () => {
    expect(computeWorkoutStreakFromHeatmapDays(days(0, 3))).toBe(1);
  });
});

describe('summarizeCompletedSets', () => {
  // Sequence: Rows active(0), Rows rest(1), Rows active(2).
  const exercises = [
    {
      name: 'Rows',
      sets: [
        { set_number: 1, active_seconds: 40, rest_seconds: 20 },
        { set_number: 2, active_seconds: 40, rest_seconds: 20 },
      ],
    },
  ];
  const seq = buildTimerSequence(exercises);

  it('counts naturally-timed-out active phases per exercise', () => {
    const summary = summarizeCompletedSets(seq, 0);
    expect(summary).toEqual([{ exerciseName: 'Rows', setsCompleted: 1 }]);
  });

  it('does not count an active phase skipped via Skip (F1 fixed semantics)', () => {
    // Skip pressed on phase 0 marks it skipped; session advanced to rest.
    const summary = summarizeCompletedSets(seq, 1, { 0: 'skipped' });
    expect(summary).toEqual([]);
  });

  it('counts partial progress: skipped first set, timed-out second set', () => {
    const summary = summarizeCompletedSets(seq, 2, { 0: 'skipped', 2: 'completed' });
    expect(summary).toEqual([{ exerciseName: 'Rows', setsCompleted: 1 }]);
  });

  it('counts a skipped final phase as not completed (skip completes without advancing)', () => {
    const summary = summarizeCompletedSets(seq, 2, { 0: 'completed', 2: 'skipped' });
    expect(summary).toEqual([{ exerciseName: 'Rows', setsCompleted: 1 }]);
  });

  it('treats missing dispositions as completed for legacy callers', () => {
    const summary = summarizeCompletedSets(seq, 2);
    expect(summary).toEqual([{ exerciseName: 'Rows', setsCompleted: 2 }]);
  });
});

describe('collectSessionSetRecords', () => {
  const exercises = [
    {
      name: 'Bench',
      sets: [
        { set_number: 1, active_seconds: 30, rest_seconds: 10 },
        { set_number: 2, active_seconds: 30, rest_seconds: 10 },
      ],
    },
  ];
  const seq = buildTimerSequence(exercises);

  it('pairs each active phase with its disposition and entered values', () => {
    const records = collectSessionSetRecords(
      seq,
      2,
      { 0: 'completed', 2: 'skipped' },
      { 0: { weight: '80', reps: '8' }, 2: { weight: '82.5', reps: '6' } },
    );
    expect(records).toEqual([
      { exerciseName: 'Bench', setNumber: 1, weight: 80, reps: 8, completed: true },
      { exerciseName: 'Bench', setNumber: 2, weight: 82.5, reps: 6, completed: false },
    ]);
  });

  it('treats empty and invalid entries as unknown (null), never zero', () => {
    const records = collectSessionSetRecords(
      seq,
      0,
      { 0: 'completed' },
      { 0: { weight: '', reps: 'abc' } },
    );
    expect(records[0]).toEqual({
      exerciseName: 'Bench',
      setNumber: 1,
      weight: null,
      reps: null,
      completed: true,
    });
  });

  it('maps negative entries to null instead of persisting garbage', () => {
    const records = collectSessionSetRecords(seq, 0, {}, { 0: { weight: '-5', reps: '-1' } });
    expect(records[0].weight).toBeNull();
    expect(records[0].reps).toBeNull();
  });
});

describe('buildPreviousSetLookup / lookupPreviousSet', () => {
  const rows = [
    { exerciseName: 'Bench', setNumber: 2, weight: 82.5, reps: 6 },
    { exerciseName: 'Bench', setNumber: 1, weight: 80, reps: 8 },
    { exerciseName: 'Squat', setNumber: 1, weight: 120, reps: 5 },
  ];

  it('prefers the exact exercise+set number, newest first', () => {
    const lookup = buildPreviousSetLookup(rows);
    expect(lookupPreviousSet(lookup, 'Bench', 1)).toEqual({
      exerciseName: 'Bench',
      setNumber: 1,
      weight: 80,
      reps: 8,
    });
    expect(lookupPreviousSet(lookup, 'Bench', 2)?.weight).toBe(82.5);
  });

  it('falls back to the exercise most recent set for unseen set numbers', () => {
    const lookup = buildPreviousSetLookup(rows);
    expect(lookupPreviousSet(lookup, 'Bench', 3)).toEqual({
      exerciseName: 'Bench',
      setNumber: 2,
      weight: 82.5,
      reps: 6,
    });
  });

  it('returns null for unknown exercises or a null lookup', () => {
    const lookup = buildPreviousSetLookup(rows);
    expect(lookupPreviousSet(lookup, 'Row', 1)).toBeNull();
    expect(lookupPreviousSet(null, 'Bench', 1)).toBeNull();
  });
});
