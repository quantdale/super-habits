import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));

describe('simulation bridge production argument fidelity', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it('rejects supplied malformed macros before any real ledger write', async () => {
    const { invokeBridgeOperation } = await import('@/core/simulation/dataBridge');
    const { addCalorieEntry } = await import('@/features/calories/calories.data');
    const invalid = { foodName: 'Probe', calories: 100, protein: 'bad', mealType: 'snack' };
    await expect(addCalorieEntry(invalid as never)).rejects.toThrow('Protein');
    await expect(invokeBridgeOperation('logCalories', invalid)).rejects.toMatchObject({
      code: 'invalid_args',
    });
    for (const value of ['100', NaN, Infinity, null, false]) {
      await expect(
        invokeBridgeOperation('logCalories', { foodName: 'Probe', calories: value }),
      ).rejects.toMatchObject({ code: 'invalid_args' });
    }
    expect(await db.getAllAsync('SELECT * FROM calorie_entries')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
  });

  it('retains production defaults and rejects malformed strings and weekdays', async () => {
    const { invokeBridgeOperation } = await import('@/core/simulation/dataBridge');
    await invokeBridgeOperation('logCalories', { foodName: 'Probe', calories: 100 });
    expect(
      await db.getFirstAsync('SELECT food_name, calories, protein FROM calorie_entries'),
    ).toMatchObject({ food_name: 'Probe', calories: 100, protein: 0 });
    await expect(
      invokeBridgeOperation('createTodo', { title: 'Task', notes: 123 }),
    ).rejects.toMatchObject({ code: 'invalid_args' });
    await expect(
      invokeBridgeOperation('createHabit', { name: 'Habit', weekdays: 'Monday' }),
    ).rejects.toMatchObject({ code: 'invalid_args' });
    await expect(
      invokeBridgeOperation('createHabit', { name: 'Habit', weekdays: [0] }),
    ).rejects.toMatchObject({ code: 'invalid_args' });
    await invokeBridgeOperation('createHabit', { name: 'Habit', weekdays: [1, 7] });
    expect(await db.getAllAsync('SELECT * FROM habits')).toHaveLength(1);
  });

  it('requires exact completion state and rejects malformed optional booleans', async () => {
    const { invokeBridgeOperation } = await import('@/core/simulation/dataBridge');
    const created = await invokeBridgeOperation('createTodo', { title: 'Task' });
    const id = created.captures.id;
    for (const completed of [false, true, undefined, '0', 2]) {
      await expect(
        invokeBridgeOperation('setTodoCompletion', { id, completed }),
      ).rejects.toMatchObject({ code: 'invalid_args' });
    }
    expect(await db.getFirstAsync('SELECT completed FROM todos WHERE id = ?', [id])).toEqual({
      completed: 0,
    });
    await invokeBridgeOperation('setTodoCompletion', { id, completed: 1 });
    expect(await db.getFirstAsync('SELECT completed FROM todos WHERE id = ?', [id])).toEqual({
      completed: 1,
    });
    await expect(
      invokeBridgeOperation('createCatalogExercise', {
        name: 'Row',
        primaryArea: 'back',
        unilateral: 'false',
      }),
    ).rejects.toMatchObject({ code: 'invalid_args' });
  });
});
