import { describe, expect, it } from 'vitest';
import {
  buildExerciseHistory,
  buildPreviousSetLookup,
  computePersonalRecords,
  computeSessionTotalVolume,
  computeTrainingTotals,
  convertWeight,
  findNewPersonalRecords,
  lookupPreviousSet,
  type ExerciseHistoryEntry,
  type LoggedSet,
} from '@/features/workout/workout.domain';

const KG_TO_LB = 2.2046226218;

describe('unit-aware PR detection (mixed kg/lb history)', () => {
  it('a 100 lb set must not beat an 80 kg PR', () => {
    const newRecords = findNewPersonalRecords(
      [{ exerciseName: 'Bench Press', weight: 100, reps: 1, weightUnit: 'lb' }],
      [{ exerciseName: 'Bench Press', weight: 80, reps: 1, weightUnit: 'kg' }],
    );
    expect(newRecords).toEqual([]);
  });

  it('an 80 kg set beats a 100 lb historical best', () => {
    const newRecords = findNewPersonalRecords(
      [{ exerciseName: 'Bench Press', weight: 80, reps: 1, weightUnit: 'kg' }],
      [{ exerciseName: 'Bench Press', weight: 100, reps: 1, weightUnit: 'lb' }],
    );
    expect(newRecords).toEqual(['Bench Press']);
  });

  it('legacy null-unit sets are treated as kg, never fabricated', () => {
    expect(
      findNewPersonalRecords(
        [{ exerciseName: 'Squat', weight: 80, reps: 1 }],
        [{ exerciseName: 'Squat', weight: 70, reps: 1, weightUnit: 'kg' }],
      ),
    ).toEqual(['Squat']);
    expect(
      findNewPersonalRecords(
        [{ exerciseName: 'Squat', weight: 80, reps: 1, weightUnit: null }],
        [{ exerciseName: 'Squat', weight: 90, reps: 1, weightUnit: 'kg' }],
      ),
    ).toEqual([]);
  });

  it('picks the true best set across units and reports scalars in the display unit', () => {
    const mixed: LoggedSet[] = [
      { exerciseName: 'Bench Press', weight: 100, reps: 1, weightUnit: 'lb' }, // 45.4 kg
      { exerciseName: 'Bench Press', weight: 80, reps: 1, weightUnit: 'kg' },
    ];
    const inKg = computePersonalRecords(mixed, 'kg');
    expect(inKg[0].bestTopSetWeight).toBe(80);
    expect(inKg[0].bestEstimated1RM).toBeCloseTo(80, 6);

    const inLb = computePersonalRecords(mixed, 'lb');
    expect(inLb[0].bestTopSetWeight).toBeCloseTo(80 * KG_TO_LB, 6);
    expect(inLb[0].bestEstimated1RM).toBeCloseTo(80 * KG_TO_LB, 6);
  });
});

describe('unit-aware volume totals', () => {
  it('converts mixed-unit sets to the display unit via convertWeight', () => {
    const sets = [
      { weight: 100, reps: 1, completed: true, weightUnit: 'kg' as const },
      { weight: 50, reps: 1, completed: true, weightUnit: 'lb' as const },
    ];
    expect(computeSessionTotalVolume(sets, 'kg')).toBeCloseTo(
      100 + convertWeight(50, 'lb', 'kg'),
      6,
    );
    expect(computeSessionTotalVolume(sets, 'lb')).toBeCloseTo(
      convertWeight(100, 'kg', 'lb') + 50,
      6,
    );
  });

  it('legacy null-unit sets count as kg', () => {
    expect(computeSessionTotalVolume([{ weight: 100, reps: 2, completed: true }], 'kg')).toBe(200);
    expect(
      computeSessionTotalVolume([{ weight: 100, reps: 2, completed: true }], 'lb'),
    ).toBeCloseTo(200 * KG_TO_LB, 6);
  });

  it('computeTrainingTotals measurableVolume converts to the display unit', () => {
    const sessions = [
      {
        completedAt: '2026-10-01T10:00:00.000Z',
        sets: [
          { completed: true, weight: 100, reps: 1, weightUnit: 'kg' as const },
          { completed: true, weight: 50, reps: 1, weightUnit: 'lb' as const },
        ],
      },
    ];
    expect(computeTrainingTotals(sessions, 'kg').measurableVolume).toBeCloseTo(
      100 + convertWeight(50, 'lb', 'kg'),
      6,
    );
  });

  it('buildExerciseHistory normalizes mixed-unit history to the display unit', () => {
    const entries: ExerciseHistoryEntry[] = [
      {
        logId: 'a',
        completedAt: '2026-10-01T10:00:00.000Z',
        completed: true,
        setNumber: 1,
        exerciseName: 'Bench Press',
        weight: 100,
        reps: 1,
        weightUnit: 'lb',
      },
      {
        logId: 'b',
        completedAt: '2026-10-02T10:00:00.000Z',
        completed: true,
        setNumber: 1,
        exerciseName: 'Bench Press',
        weight: 80,
        reps: 1,
        weightUnit: 'kg',
      },
    ];
    const history = buildExerciseHistory(entries, 'kg');
    expect(history).not.toBeNull();
    expect(history!.bestEstimated1RM).toBeCloseTo(80, 6);
    expect(history!.measurableVolume).toBeCloseTo(convertWeight(100, 'lb', 'kg') + 80, 6);
  });
});

describe('unit-aware progression seeding', () => {
  it('buildPreviousSetLookup normalizes previous weights to the display unit', () => {
    const lookup = buildPreviousSetLookup(
      [{ exerciseName: 'Bench Press', setNumber: 1, weight: 100, reps: 5, weightUnit: 'kg' }],
      'lb',
    );
    const row = lookupPreviousSet(lookup, 'Bench Press', 1);
    expect(row).not.toBeNull();
    expect(row!.weight).toBeCloseTo(100 * KG_TO_LB, 6);
  });

  it('legacy null-unit previous rows are kg', () => {
    const lookup = buildPreviousSetLookup(
      [{ exerciseName: 'Bench Press', setNumber: 1, weight: 100, reps: 5 }],
      'kg',
    );
    expect(lookupPreviousSet(lookup, 'Bench Press', 1)!.weight).toBe(100);
  });
});

describe('display-unit reporting (History detail / Progress / Totals)', () => {
  it("buildExerciseHistory reports 1RM and volume in the user's lb display unit", () => {
    const entries: ExerciseHistoryEntry[] = [
      {
        logId: 'a',
        completedAt: '2026-10-01T10:00:00.000Z',
        completed: true,
        setNumber: 1,
        exerciseName: 'Bench Press',
        weight: 100,
        reps: 1,
        weightUnit: 'lb',
      },
      {
        logId: 'b',
        completedAt: '2026-10-02T10:00:00.000Z',
        completed: true,
        setNumber: 1,
        exerciseName: 'Bench Press',
        weight: 80,
        reps: 1,
        weightUnit: 'kg',
      },
    ];
    const history = buildExerciseHistory(entries, 'lb');
    expect(history!.bestEstimated1RM).toBeCloseTo(80 * KG_TO_LB, 6);
    expect(history!.measurableVolume).toBeCloseTo(100 + 80 * KG_TO_LB, 6);
  });

  it("computeTrainingTotals measurableVolume reports in the user's lb display unit", () => {
    const sessions = [
      {
        completedAt: '2026-10-01T10:00:00.000Z',
        sets: [
          { completed: true, weight: 100, reps: 1, weightUnit: 'kg' as const },
          { completed: true, weight: 50, reps: 1, weightUnit: 'lb' as const },
        ],
      },
    ];
    expect(computeTrainingTotals(sessions, 'lb').measurableVolume).toBeCloseTo(
      100 * KG_TO_LB + 50,
      6,
    );
  });

  it("computePersonalRecords reports best lifts in the user's lb display unit", () => {
    const records = computePersonalRecords(
      [{ exerciseName: 'Bench Press', weight: 80, reps: 5, weightUnit: 'kg' }],
      'lb',
    );
    expect(records[0].bestTopSetWeight).toBeCloseTo(80 * KG_TO_LB, 6);
    expect(records[0].bestEstimated1RM).toBeCloseTo(80 * (1 + 5 / 30) * KG_TO_LB, 6);
  });
});
