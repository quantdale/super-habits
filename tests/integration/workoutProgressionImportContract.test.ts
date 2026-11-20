import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Portable export → import contract for workout prescription rows.
 *
 * `tests/integration/workoutProgressionValidation.test.ts` pins the writer
 * side. This file proves the CONSEQUENCE the writer contract exists to
 * prevent: a prescription row the app could store (here crafted with raw SQL,
 * exactly the shape the pre-fix `addExercise`/`updateExercise` accepted)
 * survives export but makes the whole portable file un-importable, so the user
 * silently loses the ability to recover that dataset.
 *
 * The positive control proves the contract is not over-tight: a dataset built
 * entirely through the real data layer exports and imports cleanly and keeps
 * its prescription values.
 */

const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.impl.getItem,
    setItem: asyncStorageMock.impl.setItem,
    removeItem: asyncStorageMock.impl.removeItem,
  },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

async function exportSource() {
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}

async function importOnEmptyDevice(json: string) {
  const { preparePortableImport, confirmPortableImport } =
    await import('@/core/portable/portableImport');
  const outcome = await preparePortableImport({ fileName: 'backup.json', text: json });
  if (outcome.status !== 'ready') return outcome;
  return confirmPortableImport({ file: outcome.file });
}

describe('portable prescription contract', () => {
  beforeEach(() => {
    asyncStorageMock.state.clear();
  });

  it('round-trips every writer-accepted prescription value', async () => {
    const sourceDb = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Push day', '');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Bench press',
      modality: 'weighted_strength',
      progressionMode: 'double',
      progressionIncrement: 1.25,
      progressionMinReps: 8,
      progressionMaxReps: 12,
      sortOrder: 1,
    });
    await workout.addSet({
      exerciseId,
      activeSeconds: 40,
      restSeconds: 20,
      targetRepsMin: 8,
      targetRepsMax: 8,
      targetLoad: 0,
      targetDurationSeconds: 0,
      targetDistance: 1.5,
      targetPace: 0.5,
    });
    const exported = await exportSource();
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    const imported = await importOnEmptyDevice(exported.json);
    expect(imported.status).toBe('restored');
    const rows = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM routine_exercises ORDER BY id',
    );
    expect(rows[0]).toMatchObject({
      progression_mode: 'double',
      progression_increment: 1.25,
      progression_min_reps: 8,
      progression_max_reps: 12,
      sort_order: 1,
    });
    await targetDb.closeAsync();
  }, 60000);

  it('refuses a file whose prescription row the app can no longer write', async () => {
    // The pre-fix writer stored this row (negative increment) because
    // `addExercise`/`updateExercise` never validated the progression triple.
    // Recovery validators have always rejected it, so exporting that dataset
    // produced a file nobody could import back.
    const sourceDb = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Push day', '');
    const routineId = (await workout.listRoutines())[0].id;
    await sourceDb.runAsync(
      `INSERT INTO routine_exercises
         (id, routine_id, name, sort_order, catalog_exercise_id, modality, unilateral,
          supports_external_load, notes, superset_group, progression_mode,
          progression_increment, progression_min_reps, progression_max_reps,
          created_at, updated_at, deleted_at)
       VALUES ('ex_1750000000002_baddata', ?, 'Bench press', 1, NULL, 'timed', 0, 1, NULL, NULL,
               'none', -2.5, NULL, NULL,
               '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
      [routineId],
    );
    const exported = await exportSource();
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    const outcome = await importOnEmptyDevice(exported.json);
    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.diagnostics.join('\n')).toContain('progression_increment is invalid');
    // Nothing was written: the destination is still empty.
    const rows = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM routine_exercises',
    );
    expect(rows?.count).toBe(0);
    await targetDb.closeAsync();
  }, 60000);

  it('imports a legacy reversed rep range (the validator is not tightened)', async () => {
    // Compatibility guard: backups written before #225 legitimately contain
    // reversed ranges. Tightening the recovery validators to mirror the writer
    // would reject those files outright, so the writer — not the validator —
    // carries the range rule.
    const sourceDb = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Push day', '');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({ routineId, name: 'Bench press' });
    await sourceDb.runAsync(
      `INSERT INTO routine_exercise_sets
         (id, exercise_id, set_number, active_seconds, rest_seconds, target_reps_min,
          target_reps_max, target_load, target_duration_seconds, target_distance,
          target_pace, created_at, updated_at, deleted_at)
       VALUES ('eset_1750000000003_legacy', ?, 1, 40, 20, 15, 10, NULL, NULL, NULL, NULL,
               '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
      [exerciseId],
    );
    const exported = await exportSource();
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    expect((await importOnEmptyDevice(exported.json)).status).toBe('restored');
    const sets = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM routine_exercise_sets ORDER BY id',
    );
    expect(sets[0]).toMatchObject({ target_reps_min: 15, target_reps_max: 10 });
    await targetDb.closeAsync();
  }, 60000);
});
