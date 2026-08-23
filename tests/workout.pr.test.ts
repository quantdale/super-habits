import { describe, expect, it } from 'vitest';
import {
  applyRestDefault,
  buildVolumePerWeek,
  computePersonalRecords,
  computeSessionTotalSets,
  estimate1RM,
  findNewPersonalRecords,
  type LoggedSet,
} from '@/features/workout/workout.domain';

describe('estimate1RM (Epley)', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it('applies weight * (1 + reps / 30)', () => {
    expect(estimate1RM(100, 6)).toBeCloseTo(120, 10);
    expect(estimate1RM(80, 10)).toBeCloseTo(80 * (1 + 10 / 30), 10);
  });
  it('returns 0 for invalid input', () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(-50, 5)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM(100, -2)).toBe(0);
    expect(estimate1RM(Number.NaN, 5)).toBe(0);
    expect(estimate1RM(100, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('computePersonalRecords', () => {
  it('finds best estimated 1RM and best top set per exercise', () => {
    const sets: LoggedSet[] = [
      { exerciseName: 'Bench Press', weight: 100, reps: 5 },
      { exerciseName: 'Bench Press', weight: 90, reps: 10 },
      { exerciseName: 'Squat', weight: 140, reps: 3 },
    ];
    const records = computePersonalRecords(sets);
    expect(records).toHaveLength(2);

    const bench = records.find((r) => r.exerciseName === 'Bench Press');
    expect(bench).toBeDefined();
    // 100x5 → ~116.67; 90x10 → 120 → 90x10 wins on 1RM.
    expect(bench!.best1RMSet).toEqual({ exerciseName: 'Bench Press', weight: 90, reps: 10 });
    expect(bench!.bestEstimated1RM).toBeCloseTo(120, 10);
    // Top set is heaviest regardless of reps.
    expect(bench!.bestTopSetWeight).toBe(100);
    expect(bench!.bestTopSet).toEqual({ exerciseName: 'Bench Press', weight: 100, reps: 5 });

    const squat = records.find((r) => r.exerciseName === 'Squat');
    expect(squat!.bestEstimated1RM).toBeCloseTo(140 * (1 + 3 / 30), 10);
  });

  it('ignores invalid sets and returns empty for no valid history', () => {
    expect(computePersonalRecords([])).toEqual([]);
    const records = computePersonalRecords([
      { exerciseName: 'Row', weight: 0, reps: 8 },
      { exerciseName: 'Row', weight: 60, reps: -1 },
      { exerciseName: 'Row', weight: Number.NaN, reps: 5 },
    ]);
    expect(records).toEqual([]);
  });

  it('skips sets with unrecorded (null) weight/reps instead of treating them as zero', () => {
    const records = computePersonalRecords([
      { exerciseName: 'Row', weight: null, reps: null },
      { exerciseName: 'Row', weight: 60, reps: null },
      { exerciseName: 'Row', weight: null, reps: 10 },
      { exerciseName: 'Row', weight: 70, reps: 5 },
    ]);
    // Only the fully-recorded set produces a record.
    expect(records).toHaveLength(1);
    expect(records[0].best1RMSet).toEqual({ exerciseName: 'Row', weight: 70, reps: 5 });
    expect(records[0].bestTopSetWeight).toBe(70);
  });

  it('returns empty when every set has unknown values (legacy sessions)', () => {
    expect(computePersonalRecords([{ exerciseName: 'Row', weight: null, reps: null }])).toEqual([]);
  });

  it('breaks 1RM ties by heavier weight then more reps', () => {
    const records = computePersonalRecords([
      { exerciseName: 'Curl', weight: 40, reps: 12 },
      { exerciseName: 'Curl', weight: 52, reps: 3 },
    ]);
    // 40x12 → 56; 52x3 → 57.2 → second wins.
    expect(records[0].best1RMSet).toEqual({ exerciseName: 'Curl', weight: 52, reps: 3 });
  });
});

describe('findNewPersonalRecords', () => {
  it('flags exercises beating the historical best 1RM', () => {
    const history: LoggedSet[] = [{ exerciseName: 'Bench Press', weight: 100, reps: 5 }];
    const session: LoggedSet[] = [
      { exerciseName: 'Bench Press', weight: 95, reps: 8 }, // 117.33 > 116.67
      { exerciseName: 'Squat', weight: 120, reps: 5 },
    ];
    expect(findNewPersonalRecords(session, history)).toEqual(['Bench Press', 'Squat']);
  });

  it('does not flag equal or worse performances', () => {
    const history: LoggedSet[] = [{ exerciseName: 'Bench Press', weight: 100, reps: 1 }];
    expect(
      findNewPersonalRecords([{ exerciseName: 'Bench Press', weight: 100, reps: 1 }], history),
    ).toEqual([]);
    expect(
      findNewPersonalRecords([{ exerciseName: 'Bench Press', weight: 90, reps: 1 }], history),
    ).toEqual([]);
  });

  it('ignores unrecorded (null) session sets — unknown values never set records', () => {
    const history: LoggedSet[] = [{ exerciseName: 'Bench Press', weight: 100, reps: 1 }];
    expect(
      findNewPersonalRecords(
        [
          { exerciseName: 'Bench Press', weight: null, reps: null },
          { exerciseName: 'Bench Press', weight: 140, reps: null },
        ],
        history,
      ),
    ).toEqual([]);
  });

  it('flags a first recorded value as a record even when history is all-unknown', () => {
    const history: LoggedSet[] = [{ exerciseName: 'Row', weight: null, reps: null }];
    expect(findNewPersonalRecords([{ exerciseName: 'Row', weight: 50, reps: 8 }], history)).toEqual(
      ['Row'],
    );
  });
});

describe('buildVolumePerWeek', () => {
  it('buckets sessions into Monday-start weeks oldest first with zero weeks included', () => {
    // 2026-08-20 is a Thursday; its Monday is 2026-08-17.
    const points = buildVolumePerWeek(
      [
        { completedAt: '2026-08-18T10:00:00.000Z', totalSets: 12 },
        { completedAt: '2026-08-19T10:00:00.000Z', totalSets: 8 },
        { completedAt: '2026-07-29T10:00:00.000Z', totalSets: 20 },
      ],
      4,
      new Date('2026-08-20T12:00:00'),
    );
    expect(points).toHaveLength(4);
    expect(points[3].weekStartKey).toBe('2026-08-17');
    expect(points[3].totalSets).toBe(20);
    expect(points[3].sessions).toBe(2);
    expect(points[0].weekStartKey).toBe('2026-07-27');
    expect(points[0].totalSets).toBe(20);
    expect(points[0].sessions).toBe(1);
  });

  it('drops sessions outside the window instead of stretching the chart', () => {
    const points = buildVolumePerWeek(
      [{ completedAt: '2020-01-01T10:00:00.000Z', totalSets: 15 }],
      4,
    );
    expect(points.reduce((t, p) => t + p.totalSets, 0)).toBe(0);
  });
});

describe('computeSessionTotalSets', () => {
  it('sums completed sets across exercises', () => {
    expect(computeSessionTotalSets([{ setsCompleted: 3 }, { setsCompleted: 4 }])).toBe(7);
    expect(computeSessionTotalSets([])).toBe(0);
  });
});

describe('applyRestDefault', () => {
  // Documented role after the F3 precedence change: per-set rest_seconds
  // values are authoritative (addDefaultSet seeds them from the preference);
  // this merge is only a legacy fallback for pre-existing 0 rows.
  it('fills zero-rest sets with the default and keeps explicit rest', () => {
    const input = [
      {
        name: 'Press',
        sets: [
          { set_number: 1, active_seconds: 40, rest_seconds: 0 },
          { set_number: 2, active_seconds: 40, rest_seconds: 45 },
        ],
      },
    ];
    expect(applyRestDefault(input, 60)).toEqual([
      {
        name: 'Press',
        sets: [
          { set_number: 1, active_seconds: 40, rest_seconds: 60 },
          { set_number: 2, active_seconds: 40, rest_seconds: 45 },
        ],
      },
    ]);
  });

  it('leaves input untouched for non-positive defaults', () => {
    const input = [
      { name: 'Press', sets: [{ set_number: 1, active_seconds: 40, rest_seconds: 0 }] },
    ];
    expect(applyRestDefault(input, 0)).toBe(input);
    expect(applyRestDefault(input, Number.NaN)).toBe(input);
  });
});
