import { describe, expect, it, beforeEach } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Workout name data-layer write contract against a REAL database: invalid
 * names throw with the exact UI validator messages and persist NO rows (or
 * leave the existing row untouched for updates), while valid writes still
 * succeed. This pins the defense-in-depth backstop for the unvalidated
 * rename path (`RoutineDetailScreen.handleRenameRoutine` previously skipped
 * `validateRoutineName` entirely), the direct-SQL `duplicateRoutine` bypass,
 * and any non-UI writer that calls the data layer directly.
 */

beforeEach(async () => {
  await freshDatabase();
});

async function workoutLayers() {
  return import('@/features/workout/workout.data');
}

describe('addRoutine data-layer rejects', () => {
  it('rejects an empty name and writes no row', async () => {
    const { addRoutine, listRoutines } = await workoutLayers();
    await expect(addRoutine('   ', 'desc')).rejects.toThrow('Routine name is required.');
    expect(await listRoutines()).toHaveLength(0);
  });

  it('rejects an over-long name and writes no row', async () => {
    const { addRoutine, listRoutines } = await workoutLayers();
    await expect(addRoutine('R'.repeat(101), 'desc')).rejects.toThrow(
      'Routine name must be 100 characters or less.',
    );
    expect(await listRoutines()).toHaveLength(0);
  });

  it('still accepts a valid write', async () => {
    const { addRoutine, listRoutines } = await workoutLayers();
    await addRoutine('Push Day', 'chest');
    expect(await listRoutines()).toHaveLength(1);
  });
});

describe('updateRoutine data-layer rejects', () => {
  it('rejects an over-long rename and leaves the row untouched', async () => {
    const { addRoutine, updateRoutine, listRoutines } = await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    await expect(updateRoutine(routine.id, { name: 'R'.repeat(101) })).rejects.toThrow(
      'Routine name must be 100 characters or less.',
    );
    const [after] = await listRoutines();
    expect(after.name).toBe('Push Day');
  });

  it('rejects an empty rename instead of silently keeping the old name', async () => {
    const { addRoutine, updateRoutine, listRoutines } = await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    await expect(updateRoutine(routine.id, { name: '  ' })).rejects.toThrow(
      'Routine name is required.',
    );
    const [after] = await listRoutines();
    expect(after.name).toBe('Push Day');
  });
});

describe('duplicateRoutine truncates long names', () => {
  it('keeps the (copy) marker within the 100-char contract', async () => {
    const { addRoutine, duplicateRoutine, listRoutines } = await workoutLayers();
    await addRoutine('R'.repeat(100), 'long');
    const [source] = await listRoutines();
    const newId = await duplicateRoutine(source.id);
    expect(newId).not.toBeNull();
    const rows = await listRoutines();
    expect(rows).toHaveLength(2);
    const copy = rows.find((row) => row.id === newId);
    expect(copy).toBeDefined();
    expect(copy!.name.length).toBeLessThanOrEqual(100);
    expect(copy!.name.endsWith('(copy)')).toBe(true);
  });
});

describe('addExercise / updateExercise data-layer rejects', () => {
  it('rejects an empty exercise name and writes no row', async () => {
    const { addRoutine, addExercise, listRoutines } = await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    const { getRoutineWithExercises } = await workoutLayers();
    await expect(addExercise({ routineId: routine.id, name: '  ' })).rejects.toThrow(
      'Exercise name is required.',
    );
    expect((await getRoutineWithExercises(routine.id))?.exercises).toHaveLength(0);
  });

  it('rejects an over-long exercise name and writes no row', async () => {
    const { addRoutine, addExercise, listRoutines, getRoutineWithExercises } =
      await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    await expect(addExercise({ routineId: routine.id, name: 'E'.repeat(101) })).rejects.toThrow(
      'Exercise name must be 100 characters or less.',
    );
    expect((await getRoutineWithExercises(routine.id))?.exercises).toHaveLength(0);
  });

  it('rejects an over-long exercise rename and leaves the row untouched', async () => {
    const { addRoutine, addExercise, updateExercise, getRoutineWithExercises, listRoutines } =
      await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    const exerciseId = await addExercise({ routineId: routine.id, name: 'Bench Press' });
    await expect(updateExercise(exerciseId, { name: 'E'.repeat(101) })).rejects.toThrow(
      'Exercise name must be 100 characters or less.',
    );
    const detail = await getRoutineWithExercises(routine.id);
    expect(detail?.exercises[0]?.name).toBe('Bench Press');
  });

  it('still accepts a valid exercise write', async () => {
    const { addRoutine, addExercise, getRoutineWithExercises, listRoutines } =
      await workoutLayers();
    await addRoutine('Push Day', 'chest');
    const [routine] = await listRoutines();
    await addExercise({ routineId: routine.id, name: 'Bench Press' });
    expect((await getRoutineWithExercises(routine.id))?.exercises).toHaveLength(1);
  });
});

describe('createCustomExercise / updateCustomExercise data-layer rejects', () => {
  it('rejects an over-long custom name and writes no row', async () => {
    const { createCustomExercise, listCustomExercises } = await workoutLayers();
    await expect(
      createCustomExercise({
        name: 'E'.repeat(101),
        primaryArea: 'chest',
        modality: 'weighted_strength',
      }),
    ).rejects.toThrow('Exercise name must be 100 characters or less.');
    expect(await listCustomExercises()).toHaveLength(0);
  });

  it('rejects an over-long custom rename and leaves the row untouched', async () => {
    const { createCustomExercise, updateCustomExercise, listCustomExercises } =
      await workoutLayers();
    await createCustomExercise({
      name: 'Cable Fly',
      primaryArea: 'chest',
      modality: 'weighted_strength',
    });
    const [exercise] = await listCustomExercises();
    await expect(updateCustomExercise(exercise.id, { name: 'E'.repeat(101) })).rejects.toThrow(
      'Exercise name must be 100 characters or less.',
    );
    const [after] = await listCustomExercises();
    expect(after.name).toBe('Cable Fly');
  });
});
