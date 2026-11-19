import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Exercise-level progression prescriptions — writer ⊄ import-validator.
 *
 * PR #225 closed this class of hole for per-set prescriptions
 * (`lib/validation.ts` → `assertSetPrescriptionWrite`, called from `addSet`/
 * `updateSet`). The analogous exercise-level fields (`progression_mode`,
 * `progression_increment`, `progression_min_reps`, `progression_max_reps`)
 * stayed unvalidated in `addExercise`/`updateExercise`, while
 * `core/backup/backupValidators.ts` (ROUTINE_EXERCISE_RULES) already requires:
 *
 *   - mode ∈ {none, linear, double}
 *   - increment null | finite ≥ 0
 *   - min/max reps null | whole ≥ 1
 *
 * Two real failures follow from that gap, both reproduced here against a real
 * SQLite database through the real data layer:
 *
 *   1. The writer stores rows its own recovery validator rejects, so a backup
 *      of such a dataset cannot be imported (silent recovery loss).
 *   2. A partially edited rep range can be stored reversed (min > max), which
 *      `recommendProgression` treats as "no valid rep range" — progression
 *      silently stops working for that exercise with a message blaming
 *      insufficient history. This is reachable from the routine editor, which
 *      commits min and max independently.
 *
 * The recovery validators are deliberately NOT tightened: pre-existing backups
 * legitimately contain progression rows written before this contract existed
 * (including reversed ranges), and rejecting them would break Restore/import
 * compatibility. Only the writer is brought up to the validator's bounds, so
 * every writer-accepted row imports.
 *
 * The same holds for imported per-set prescriptions: a reversed `target_reps_*
 * range written before #225 still imports and can be repaired, but it may no
 * longer be RE-STORED by an unrelated edit (see the legacy compatibility test).
 */

type Progression = Partial<{
  progressionMode: 'none' | 'linear' | 'double';
  progressionIncrement: number | null;
  progressionMinReps: number | null;
  progressionMaxReps: number | null;
}>;

const invalid: [string, Progression][] = [
  ['negative increment', { progressionIncrement: -2.5 }],
  ['infinite increment', { progressionIncrement: Infinity }],
  ['NaN increment', { progressionIncrement: Number.NaN }],
  ['zero minimum reps', { progressionMinReps: 0 }],
  ['fractional minimum reps', { progressionMinReps: 1.5 }],
  ['negative maximum reps', { progressionMaxReps: -1 }],
  ['fractional maximum reps', { progressionMaxReps: 2.5 }],
  ['reversed progression range', { progressionMinReps: 12, progressionMaxReps: 8 }],
];

describe('workout progression prescription contracts', () => {
  let db: TestDatabase;
  let routineId: string;
  let exerciseId: string;

  beforeEach(async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Progression contracts', '');
    routineId = (await workout.listRoutines())[0].id;
    exerciseId = await workout.addExercise({
      routineId,
      name: 'Bench press',
      progressionMode: 'double',
      progressionIncrement: 2.5,
      progressionMinReps: 8,
      progressionMaxReps: 12,
    });
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  async function state() {
    return {
      exercises: await db.getAllAsync('SELECT * FROM routine_exercises ORDER BY id'),
      routines: await db.getAllAsync('SELECT * FROM workout_routines ORDER BY id'),
      intents: await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id'),
    };
  }

  /** The import/restore contract these entity rows must satisfy. */
  async function validate(entity: 'routine_exercises' | 'routine_exercise_sets', row: unknown) {
    const { validateBackupRow } = await import('@/core/backup/backupValidators');
    return validateBackupRow(entity, row);
  }

  it.each(invalid)(
    'rejects %s on insert without a partial row or backup intent',
    async (_name, input) => {
      const workout = await import('@/features/workout/workout.data');
      const before = await state();
      await expect(
        workout.addExercise({ routineId, name: 'Incline press', ...input }),
      ).rejects.toThrow(/Progression/);
      expect(await state()).toEqual(before);
    },
  );

  it.each(invalid)(
    'rejects %s on update without changing a row, parent timestamp or outbox',
    async (_name, input) => {
      const workout = await import('@/features/workout/workout.data');
      const before = await state();
      await expect(workout.updateExercise(exerciseId, input)).rejects.toThrow(/Progression/);
      expect(await state()).toEqual(before);
    },
  );

  it.each([
    ['minimum above the stored maximum', { progressionMinReps: 13 }],
    ['maximum below the stored minimum', { progressionMaxReps: 7 }],
  ])('checks a partial update against the stored sibling bound (%s)', async (_name, input) => {
    const workout = await import('@/features/workout/workout.data');
    const before = await state();
    await expect(workout.updateExercise(exerciseId, input)).rejects.toThrow(/Progression/);
    expect(await state()).toEqual(before);
  });

  it('accepts an untyped progression mode and modality at the runtime boundary', async () => {
    const workout = await import('@/features/workout/workout.data');
    const before = await state();
    await expect(
      workout.addExercise({
        routineId,
        name: 'Row',
        progressionMode: 'bogus' as never,
      }),
    ).rejects.toThrow(/Progression/);
    await expect(
      workout.addExercise({ routineId, name: 'Row', modality: 'bogus' as never }),
    ).rejects.toThrow(/modality/);
    expect(await state()).toEqual(before);
  });

  it.each([-1, 1.5, Number.NaN])(
    'rejects invalid explicit sort order %s without writing a row',
    async (sortOrder) => {
      const workout = await import('@/features/workout/workout.data');
      const before = await state();
      await expect(workout.addExercise({ routineId, name: 'Row', sortOrder })).rejects.toThrow(
        /order/,
      );
      expect(await state()).toEqual(before);
      // The default (0 = first position) and a positive position stay writable.
      const zero = await workout.addExercise({ routineId, name: 'Row 0' });
      const positive = await workout.addExercise({ routineId, name: 'Row 2', sortOrder: 2 });
      for (const id of [zero, positive]) {
        const row = await db.getFirstAsync<Record<string, unknown>>(
          'SELECT * FROM routine_exercises WHERE id = ?',
          [id],
        );
        expect(await validate('routine_exercises', row)).toMatchObject({ ok: true });
      }
    },
  );

  it('never writes a row its own recovery validator rejects', async () => {
    const workout = await import('@/features/workout/workout.data');
    const accepted: [string, Progression][] = [
      ['manual mode', { progressionMode: 'none' }],
      ['linear mode with decimals', { progressionMode: 'linear', progressionIncrement: 1.25 }],
      ['zero increment', { progressionIncrement: 0 }],
      ['single lower bound', { progressionMinReps: 8 }],
      ['single upper bound', { progressionMaxReps: 20 }],
      ['equal bounds', { progressionMinReps: 10, progressionMaxReps: 10 }],
      [
        'cleared range',
        { progressionIncrement: null, progressionMinReps: null, progressionMaxReps: null },
      ],
    ];
    for (const [_name, input] of accepted) {
      const id = await workout.addExercise({
        routineId,
        name: `Accepted ${input.progressionMode}`,
        ...input,
      });
      const row = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM routine_exercises WHERE id = ?',
        [id],
      );
      expect(await validate('routine_exercises', row), `insert ${_name}`).toMatchObject({
        ok: true,
      });
    }
    for (const [_name, input] of accepted.slice(0, 4)) {
      await workout.updateExercise(exerciseId, input);
      const row = await db.getFirstAsync<Record<string, unknown>>(
        'SELECT * FROM routine_exercises WHERE id = ?',
        [exerciseId],
      );
      expect(await validate('routine_exercises', row), `update ${_name}`).toMatchObject({
        ok: true,
      });
    }
  });

  it('keeps import compatibility for progression rows written before the writer contract', async () => {
    // A dataset created by an earlier app version may hold a reversed
    // progression range (the editor committed min and max independently) or a
    // bare legacy row. Those rows must keep importing: the recovery validator
    // is intentionally NOT tightened to reject them.
    await db.runAsync(
      `INSERT INTO routine_exercises
         (id, routine_id, name, sort_order, catalog_exercise_id, modality, unilateral,
          supports_external_load, notes, superset_group, progression_mode,
          progression_increment, progression_min_reps, progression_max_reps,
          created_at, updated_at, deleted_at)
       VALUES ('ex_1750000000000_legacy1', ?, 'Legacy press', 1, NULL, 'timed', 0, 1, NULL, NULL,
               'double', 2.5, 12, 8, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
      [routineId],
    );
    const legacyRow = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercises WHERE id = 'ex_1750000000000_legacy1'",
    );
    expect(await validate('routine_exercises', legacyRow)).toMatchObject({ ok: true });

    // The writer refuses to create such a row anew, while the stored
    // (imported) legacy row stays editable for unrelated fields so a user is
    // never frozen out of their own restored routine. Editing an endpoint must
    // repair the range.
    await expect(
      workoutProgressionWrite(routineId, { progressionMinReps: 12, progressionMaxReps: 8 }),
    ).rejects.toThrow(/Progression/);
    const workout = await import('@/features/workout/workout.data');
    await workout.updateExercise('ex_1750000000000_legacy1', { name: 'Legacy press v2' });
    await workout.updateExercise('ex_1750000000000_legacy1', { progressionMode: 'linear' });
    const after = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercises WHERE id = 'ex_1750000000000_legacy1'",
    );
    expect(after).toMatchObject({
      name: 'Legacy press v2',
      progression_mode: 'linear',
      progression_min_reps: 12,
      progression_max_reps: 8,
    });
    expect(await validate('routine_exercises', after)).toMatchObject({ ok: true });

    // A rep-range edit that leaves the range reversed is still refused...
    await expect(
      workout.updateExercise('ex_1750000000000_legacy1', { progressionMinReps: 13 }),
    ).rejects.toThrow(/Progression/);
    // ...while repairing it (raising the maximum) succeeds.
    await workout.updateExercise('ex_1750000000000_legacy1', { progressionMaxReps: 20 });
    const repaired = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercises WHERE id = 'ex_1750000000000_legacy1'",
    );
    expect(repaired).toMatchObject({ progression_min_reps: 12, progression_max_reps: 20 });
    expect(await validate('routine_exercises', repaired)).toMatchObject({ ok: true });
  });

  it('keeps import compatibility for per-set prescriptions written before #225', async () => {
    // Model the pre-#225 writer exactly: `target_reps_min` and `target_reps_max`
    // were independent DraftNumberField commits, and `updateSet` only checked
    // timing, so a user raising the minimum before the maximum stored a
    // reversed range. The recovery validator accepts that row, so it must stay
    // importable, editable for unrelated fields and repairable.
    const workout = await import('@/features/workout/workout.data');
    const setsExercise = await workout.addExercise({ routineId, name: 'Legacy sets' });
    await workout.applyRemoteRoutineExerciseSets(db as never, [
      {
        id: 'eset_1750000000001_legacy1',
        exercise_id: setsExercise,
        set_number: 1,
        active_seconds: 40,
        rest_seconds: 20,
        target_reps_min: 15,
        target_reps_max: 10,
        target_load: null,
        target_duration_seconds: null,
        target_distance: null,
        target_pace: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    const legacySet = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercise_sets WHERE id = 'eset_1750000000001_legacy1'",
    );
    expect(await validate('routine_exercise_sets', legacySet)).toMatchObject({ ok: true });

    // Unrelated fields stay editable on the restored row (the pre-fix writer
    // threw "Target reps minimum cannot exceed maximum reps." for these, so a
    // restored legacy set could not even have its rest time changed).
    await workout.updateSet('eset_1750000000001_legacy1', { restSeconds: 45 });
    await workout.updateSet('eset_1750000000001_legacy1', { targetLoad: 60 });
    const edited = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercise_sets WHERE id = 'eset_1750000000001_legacy1'",
    );
    expect(edited).toMatchObject({
      rest_seconds: 45,
      target_load: 60,
      target_reps_min: 15,
      target_reps_max: 10,
    });
    expect(await validate('routine_exercise_sets', edited)).toMatchObject({ ok: true });

    // Any rep-range edit must repair the reversal, never preserve it.
    await expect(
      workout.updateSet('eset_1750000000001_legacy1', { targetRepsMin: 16 }),
    ).rejects.toThrow(/reps/);
    await workout.updateSet('eset_1750000000001_legacy1', { targetRepsMax: 15 });
    const repaired = await db.getFirstAsync<Record<string, unknown>>(
      "SELECT * FROM routine_exercise_sets WHERE id = 'eset_1750000000001_legacy1'",
    );
    expect(repaired).toMatchObject({ target_reps_min: 15, target_reps_max: 15 });
    expect(await validate('routine_exercise_sets', repaired)).toMatchObject({ ok: true });
  });

  it('keeps a writer-fresh set writable in every field', async () => {
    const workout = await import('@/features/workout/workout.data');
    const freshExercise = await workout.addExercise({ routineId, name: 'Fresh sets' });
    const setId = await workout.addSet({
      exerciseId: freshExercise,
      activeSeconds: 40,
      restSeconds: 20,
      targetRepsMin: 8,
      targetRepsMax: 12,
    });
    for (const update of [
      { restSeconds: 45 },
      { targetLoad: 60.5 },
      { targetRepsMin: 10 },
      { targetRepsMax: 10 },
    ]) {
      await workout.updateSet(setId, update);
    }
    const row = await db.getFirstAsync<Record<string, unknown>>(
      'SELECT * FROM routine_exercise_sets WHERE id = ?',
      [setId],
    );
    expect(row).toMatchObject({ target_reps_min: 10, target_reps_max: 10, target_load: 60.5 });
    expect(await validate('routine_exercise_sets', row)).toMatchObject({ ok: true });
  });
});

async function workoutProgressionWrite(routineId: string, input: Progression) {
  const workout = await import('@/features/workout/workout.data');
  return workout.addExercise({ routineId, name: 'Rejected legacy copy', ...input });
}
