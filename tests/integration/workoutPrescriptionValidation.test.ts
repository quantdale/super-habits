import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

type Prescription = import('@/features/workout/workout.data').RoutineSetUpdate;
const invalid: [string, Prescription][] = [
  ['negative load', { targetLoad: -1 }],
  ['NaN load', { targetLoad: Number.NaN }],
  ['infinite load', { targetLoad: Infinity }],
  ['negative distance', { targetDistance: -1 }],
  ['NaN distance', { targetDistance: Number.NaN }],
  ['infinite distance', { targetDistance: Infinity }],
  ['negative pace', { targetPace: -1 }],
  ['NaN pace', { targetPace: Number.NaN }],
  ['infinite pace', { targetPace: Infinity }],
  ['zero reps minimum', { targetRepsMin: 0 }],
  ['fractional reps minimum', { targetRepsMin: 1.5 }],
  ['infinite reps maximum', { targetRepsMax: Infinity }],
  ['negative reps maximum', { targetRepsMax: -1 }],
  ['fractional duration', { targetDurationSeconds: 1.5 }],
  ['negative duration', { targetDurationSeconds: -1 }],
  ['NaN duration', { targetDurationSeconds: Number.NaN }],
  ['reversed rep range', { targetRepsMin: 15, targetRepsMax: 10 }],
];

const valid = {
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetLoad: 20.25,
  targetDurationSeconds: 60,
  targetDistance: 2.5,
  targetPace: 4.75,
};

describe('workout prescription persistence contracts', () => {
  let db: TestDatabase;
  let exerciseId: string;
  let setId: string;
  beforeEach(async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Validated prescriptions', '');
    const routineId = (await workout.listRoutines())[0].id;
    exerciseId = await workout.addExercise({ routineId, name: 'Row' });
    setId = await workout.addSet({ exerciseId, activeSeconds: 40, restSeconds: 20, ...valid });
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  async function state() {
    return {
      sets: await db.getAllAsync('SELECT * FROM routine_exercise_sets ORDER BY id'),
      routines: await db.getAllAsync('SELECT * FROM workout_routines ORDER BY id'),
      intents: await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id'),
    };
  }

  it.each(invalid)(
    'rejects %s on update without changing a row, parent timestamp or outbox',
    async (_name, input) => {
      const before = await state();
      const { updateSetPrescription } = await import('@/features/workout/workout.data');
      await expect(updateSetPrescription(setId, input)).rejects.toThrow(/Target|reps/);
      expect(await state()).toEqual(before);
    },
  );

  it.each(invalid)(
    'rejects %s on insert without a partial row or backup intent',
    async (_name, input) => {
      const before = await state();
      const { addSet } = await import('@/features/workout/workout.data');
      await expect(
        addSet({ exerciseId, activeSeconds: 40, restSeconds: 20, ...input }),
      ).rejects.toThrow(/Target|reps/);
      expect(await state()).toEqual(before);
    },
  );

  it('checks a partial update against the stored sibling rep bound', async () => {
    const { updateSetPrescription } = await import('@/features/workout/workout.data');
    const before = await state();
    await expect(updateSetPrescription(setId, { targetRepsMax: 7 })).rejects.toThrow(/reps/);
    expect(await state()).toEqual(before);
  });

  it.each([0, -1, 1.5, Number.NaN, Infinity])(
    'rejects invalid explicit set number %s',
    async (setNumber) => {
      const before = await state();
      const { addSet } = await import('@/features/workout/workout.data');
      await expect(
        addSet({ exerciseId, setNumber, activeSeconds: 40, restSeconds: 20 }),
      ).rejects.toThrow(/Set number/);
      expect(await state()).toEqual(before);
    },
  );

  it.each([
    { activeSeconds: Number.NaN },
    { activeSeconds: 30.5 },
    { restSeconds: Number.NaN },
    { restSeconds: 0.5 },
  ])('rejects non-whole/NaN timing %j', async (timing) => {
    const before = await state();
    const workout = await import('@/features/workout/workout.data');
    await expect(
      workout.addSet({ exerciseId, activeSeconds: 40, restSeconds: 20, ...timing }),
    ).rejects.toThrow(/whole seconds/);
    await expect(workout.updateSet(setId, timing)).rejects.toThrow(/whole seconds/);
    expect(await state()).toEqual(before);
  });

  it('preserves valid decimals, zero values, null clearing and recovery compatibility', async () => {
    const workout = await import('@/features/workout/workout.data');
    const { validateBackupRow } = await import('@/core/backup/backupValidators');
    let rows = await workout.listSets(exerciseId);
    expect(validateBackupRow('routine_exercise_sets', rows[0]).ok).toBe(true);
    expect(rows[0].target_load).toBe(20.25);
    await workout.updateSetPrescription(setId, {
      targetLoad: 0,
      targetPace: 0,
      targetDistance: 0,
      targetDurationSeconds: 0,
    });
    rows = await workout.listSets(exerciseId);
    expect(rows[0]).toMatchObject({
      target_load: 0,
      target_pace: 0,
      target_distance: 0,
      target_duration_seconds: 0,
    });
    expect(validateBackupRow('routine_exercise_sets', rows[0]).ok).toBe(true);
    await workout.updateSetPrescription(setId, {
      targetRepsMin: null,
      targetRepsMax: null,
      targetLoad: null,
      targetDurationSeconds: null,
      targetDistance: null,
      targetPace: null,
    });
    rows = await workout.listSets(exerciseId);
    expect(rows[0]).toMatchObject({
      target_reps_min: null,
      target_reps_max: null,
      target_load: null,
      target_duration_seconds: null,
      target_distance: null,
      target_pace: null,
    });
    expect(validateBackupRow('routine_exercise_sets', rows[0]).ok).toBe(true);
  });
});
