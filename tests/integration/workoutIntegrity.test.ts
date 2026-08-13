import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

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
