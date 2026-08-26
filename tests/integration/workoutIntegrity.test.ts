import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

// addDefaultSet loads the rest preference, whose store touches AsyncStorage
// during its one-time legacy import; keep that hermetic in integration runs.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe('workout parent/child integrity', () => {
  it('rejects orphan configuration writes and preserves historical logs after parent deletion', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await expect(
      workout.addExercise({ routineId: 'routine_missing', name: 'Orphan' }),
    ).rejects.toThrow('Routine not found.');
    await expect(
      workout.addSet({
        exerciseId: 'exercise_missing',
        setNumber: 1,
        activeSeconds: 40,
        restSeconds: 20,
      }),
    ).rejects.toThrow('Exercise or routine not found.');
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM routine_exercises WHERE routine_id = ?',
        ['routine_missing'],
      ),
    ).toEqual({ count: 0 });

    await workout.addRoutine('Push', 'Strength');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({ routineId, name: 'Press' });
    const setId = await workout.addSet({
      exerciseId,
      setNumber: 1,
      activeSeconds: 40,
      restSeconds: 20,
    });
    await workout.completeRoutine(routineId, 'Historical session');

    await workout.deleteRoutine(routineId);

    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM workout_routines WHERE id = ?',
        [routineId],
      ),
    ).not.toEqual({ deleted_at: null });
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM routine_exercises WHERE id = ?',
        [exerciseId],
      ),
    ).not.toEqual({ deleted_at: null });
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM routine_exercise_sets WHERE id = ?',
        [setId],
      ),
    ).not.toEqual({ deleted_at: null });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_logs WHERE routine_id = ?',
        [routineId],
      ),
    ).toEqual({ count: 1 });

    // Remove the delete receipt so any stale child mutation would be visible
    // as an incorrect new parent update intent.
    await db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND id = ?', [
      'workout_routines',
      routineId,
    ]);
    await expect(workout.addExercise({ routineId, name: 'Stale UI exercise' })).rejects.toThrow(
      'Routine not found.',
    );
    await expect(
      workout.addSet({
        exerciseId,
        setNumber: 2,
        activeSeconds: 40,
        restSeconds: 20,
      }),
    ).rejects.toThrow('Exercise or routine not found.');
    await workout.updateSet(setId, { activeSeconds: 45 });
    await workout.deleteSet(setId);
    await workout.logWorkoutSession({
      routineId,
      exercises: [{ exerciseName: 'Stale', setsCompleted: 1 }],
    });

    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM sync_outbox
         WHERE entity = ? AND id = ?`,
        ['workout_routines', routineId],
      ),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_session_exercises WHERE exercise_name = ?',
        ['Stale'],
      ),
    ).toEqual({ count: 0 });
    await db.closeAsync();
  });
});

describe('timed-session provenance (workout_session_sets + wall-clock timing)', () => {
  it('persists per-set rows and timing, keeps legacy logs clean, and preserves history across routine deletion', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Push', 'Strength');
    const routineId = (await workout.listRoutines())[0].id;

    const startedAt = '2026-08-20T10:00:00.000Z';
    const endedAt = '2026-08-20T10:04:00.000Z';
    await workout.logWorkoutSession({
      routineId,
      notes: 'Timed',
      exercises: [
        {
          exerciseName: 'Bench Press',
          setsCompleted: 2,
          sets: [
            { setNumber: 1, weight: 80, reps: 8, completed: true },
            { setNumber: 2, weight: null, reps: null, completed: true },
          ],
        },
      ],
      startedAt,
      endedAt,
    });

    // Wall-clock timing persisted; duration derived from the delta (240s).
    const timedLog = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workout_logs WHERE notes = ?',
      ['Timed'],
    );
    expect(timedLog).not.toBeNull();
    expect(
      await db.getFirstAsync<{
        started_at: string;
        ended_at: string;
        duration_seconds: number;
      }>('SELECT started_at, ended_at, duration_seconds FROM workout_logs WHERE id = ?', [
        timedLog!.id,
      ]),
    ).toEqual({ started_at: startedAt, ended_at: endedAt, duration_seconds: 240 });

    // Parent-child linkage: two sset rows under one wsex row; unknown values
    // stay NULL (never zero).
    expect(
      await db.getAllAsync<{
        set_number: number;
        weight: number | null;
        reps: number | null;
        completed: number;
      }>(
        `SELECT s.set_number, s.weight, s.reps, s.completed
         FROM workout_session_sets s
         INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
         WHERE e.log_id = ?
         ORDER BY s.set_number ASC`,
        [timedLog!.id],
      ),
    ).toEqual([
      { set_number: 1, weight: 80, reps: 8, completed: 1 },
      { set_number: 2, weight: null, reps: null, completed: 1 },
    ]);

    // Every entity involved rode the same mutation into the outbox.
    for (const [entity, expected] of [
      ['workout_logs', 1],
      ['workout_session_exercises', 1],
      ['workout_session_sets', 2],
    ] as const) {
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = ?',
          [entity],
        ),
      ).toEqual({ count: expected });
    }

    // Detail read surfaces the real set rows.
    const detail = await workout.getWorkoutLogDetail(timedLog!.id);
    expect(detail?.sets).toHaveLength(2);

    // Quick-complete log: no timing, no children — reads cleanly as unknown.
    await workout.completeRoutine(routineId, 'Quick');
    const quickLog = await db.getFirstAsync<{
      id: string;
      started_at: string | null;
      ended_at: string | null;
      duration_seconds: number | null;
    }>('SELECT id, started_at, ended_at, duration_seconds FROM workout_logs WHERE notes = ?', [
      'Quick',
    ]);
    expect(quickLog?.started_at).toBeNull();
    expect(quickLog?.ended_at).toBeNull();
    expect(quickLog?.duration_seconds).toBeNull();
    const quickDetail = await workout.getWorkoutLogDetail(quickLog!.id);
    expect(quickDetail?.sets).toEqual([]);

    // Routine deletion never cascades to historical logs or their sets.
    await workout.deleteRoutine(routineId);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_logs WHERE routine_id = ?',
        [routineId],
      ),
    ).toEqual({ count: 2 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_session_sets',
      ),
    ).toEqual({ count: 2 });

    await db.closeAsync();
  });

  it('writes no log and no set rows when the target routine is missing', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.logWorkoutSession({
      routineId: 'routine_missing',
      exercises: [
        {
          exerciseName: 'Ghost',
          setsCompleted: 1,
          sets: [{ setNumber: 1, weight: 50, reps: 5, completed: true }],
        },
      ],
    });

    expect(
      await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workout_logs'),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_session_sets',
      ),
    ).toEqual({ count: 0 });
    await db.closeAsync();
  });

  it('seeds new default sets from the workout_rest_seconds preference instead of a hardcoded value', async () => {
    const db = await freshDatabase();
    await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
      'workout_rest_seconds',
      JSON.stringify(45),
    ]);
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Seed', '');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({ routineId, name: 'Press' });
    await workout.addDefaultSet(exerciseId);

    expect(
      await db.getFirstAsync<{ rest_seconds: number }>(
        'SELECT rest_seconds FROM routine_exercise_sets WHERE exercise_id = ?',
        [exerciseId],
      ),
    ).toEqual({ rest_seconds: 45 });
    await db.closeAsync();
  });
});

describe('Gym V2 durable model', () => {
  it('persists catalog identity, prescriptions, plans, modality sets, preferences, and body weight', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    const routineId = await (async () => {
      await workout.addRoutine('Upper body', 'Gym', 'strength');
      return (await workout.listRoutines())[0].id;
    })();
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Bench Press',
      catalogExerciseId: 'builtin_barbell_bench_press',
      modality: 'weighted_strength',
      notes: 'Pause briefly on the chest.',
      unilateral: true,
      supportsExternalLoad: true,
      supersetGroup: 'push-a',
      progressionMode: 'double',
      progressionIncrement: 2.5,
      progressionMinReps: 8,
      progressionMaxReps: 12,
    });
    const setId = await workout.addSet({
      exerciseId,
      setNumber: 1,
      activeSeconds: 30,
      restSeconds: 90,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetLoad: 80,
    });
    const customId = await workout.createCustomExercise({
      name: 'Cable Y Raise',
      primaryArea: 'shoulders',
      secondaryAreas: ['upper back'],
      equipment: 'cable',
      modality: 'weighted_strength',
      aliases: ['cable y'],
      instructions: 'Pull toward the shoulders.',
      supportsExternalLoad: true,
      unilateral: false,
    });
    await workout.upsertWeeklyPlanEntry({ weekday: 1, routineId, planKind: 'workout' });
    await workout.setWorkoutScheduleOverride({
      dateKey: '2026-08-24',
      overrideKind: 'rest',
      note: 'Travel day',
    });
    await workout.saveWorkoutPreferences({
      effortScale: 'rir',
      goalWeight: { value: 75, unit: 'kg' },
      workoutReminder: { enabled: false, time: { hour: 7, minute: 30 } },
    });
    await workout.addBodyWeightEntry({
      weight: 80,
      unit: 'kg',
      measuredAt: '2026-08-24T07:00:00.000Z',
      note: 'Morning',
    });
    await workout.logWorkoutSession({
      routineId,
      exercises: [
        {
          exerciseName: 'Plank',
          setsCompleted: 1,
          catalogExerciseId: 'builtin_plank',
          modality: 'timed',
          sets: [
            {
              setNumber: 1,
              weight: null,
              reps: null,
              completed: true,
              durationSeconds: 45,
              effortValue: 2,
              effortScale: 'rir',
            },
          ],
        },
      ],
    });

    expect(
      (
        await db.getFirstAsync<{ value: string }>(
          "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
        )
      )?.value,
    ).toBe('24');
    expect(
      await db.getFirstAsync<{
        catalog_exercise_id: string;
        modality: string;
        unilateral: number;
        supports_external_load: number;
        notes: string;
        superset_group: string;
        progression_mode: string;
      }>(
        'SELECT catalog_exercise_id, modality, unilateral, supports_external_load, notes, superset_group, progression_mode FROM routine_exercises WHERE id = ?',
        [exerciseId],
      ),
    ).toEqual({
      catalog_exercise_id: 'builtin_barbell_bench_press',
      modality: 'weighted_strength',
      unilateral: 1,
      supports_external_load: 1,
      notes: 'Pause briefly on the chest.',
      superset_group: 'push-a',
      progression_mode: 'double',
    });
    expect(
      await db.getFirstAsync<{
        target_reps_min: number;
        target_reps_max: number;
        target_load: number;
      }>(
        'SELECT target_reps_min, target_reps_max, target_load FROM routine_exercise_sets WHERE id = ?',
        [setId],
      ),
    ).toEqual({ target_reps_min: 8, target_reps_max: 12, target_load: 80 });
    expect((await workout.listCustomExercises())[0]).toMatchObject({
      id: customId,
      aliases: JSON.stringify(['cable y']),
      instructions: 'Pull toward the shoulders.',
      supports_external_load: 1,
    });
    expect((await workout.resolveWorkoutScheduleForDate('2026-08-24')).planKind).toBe('rest');
    expect((await workout.resolveWorkoutScheduleForDate('2026-08-17')).routineId).toBe(routineId);
    expect((await workout.getWorkoutPreferences()).goalWeight).toEqual({ value: 75, unit: 'kg' });
    expect((await workout.listBodyWeightEntries())[0]).toMatchObject({
      weight: 80,
      unit: 'kg',
      note: 'Morning',
    });
    expect(
      await db.getFirstAsync<{
        duration_seconds: number;
        effort_value: number;
        effort_scale: string;
      }>(
        'SELECT duration_seconds, effort_value, effort_scale FROM workout_session_sets WHERE duration_seconds IS NOT NULL',
      ),
    ).toEqual({ duration_seconds: 45, effort_value: 2, effort_scale: 'rir' });

    for (const entity of [
      'custom_exercises',
      'workout_weekly_plan',
      'workout_schedule_overrides',
      'body_weight_entries',
    ] as const) {
      expect(
        await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = ?',
          [entity],
        ),
      ).toEqual({ count: 1 });
    }
    await db.closeAsync();
  });

  it('does not let concurrent builder edits overwrite each other', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Concurrent edits', '');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Bench Press',
      catalogExerciseId: 'builtin_barbell_bench_press',
      modality: 'weighted_strength',
    });

    await Promise.all([
      workout.updateExercise(exerciseId, { progressionMode: 'linear' }),
      workout.updateExercise(exerciseId, { progressionIncrement: 2.5 }),
    ]);

    expect(
      await db.getFirstAsync<{
        progression_mode: string;
        progression_increment: number;
      }>('SELECT progression_mode, progression_increment FROM routine_exercises WHERE id = ?', [
        exerciseId,
      ]),
    ).toEqual({ progression_mode: 'linear', progression_increment: 2.5 });
    await db.closeAsync();
  });

  it('merges concurrent timing and prescription edits for one set', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Concurrent set edits', '');
    const routineId = (await workout.listRoutines())[0].id;
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Bench Press',
      catalogExerciseId: 'builtin_barbell_bench_press',
      modality: 'weighted_strength',
    });
    const setId = await workout.addSet({
      exerciseId,
      setNumber: 1,
      activeSeconds: 40,
      restSeconds: 20,
    });

    await Promise.all([
      workout.updateSet(setId, { activeSeconds: 5 }),
      workout.updateSetPrescription(setId, { targetRepsMin: 8 }),
    ]);

    expect(
      await db.getFirstAsync<{ active_seconds: number; target_reps_min: number }>(
        'SELECT active_seconds, target_reps_min FROM routine_exercise_sets WHERE id = ?',
        [setId],
      ),
    ).toEqual({ active_seconds: 5, target_reps_min: 8 });
    await db.closeAsync();
  });
});
