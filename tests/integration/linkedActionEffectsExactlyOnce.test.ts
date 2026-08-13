import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

describe('linked-action deterministic effect replay', () => {
  it('keeps todo completion idempotent across a replay', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'replay todo' });
    const first = await todos.completeTodoFromLinkedAction(todoId);
    const second = await todos.completeTodoFromLinkedAction(todoId);

    expect(first.status).toBe('applied');
    expect(second).toMatchObject({ status: 'skipped', reason: 'already_completed' });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM todos WHERE id = ? AND completed = 1',
        [todoId],
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('uses deterministic calorie IDs to make replay a single ledger row', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const input = {
      id: 'cal_replay_1',
      foodName: 'Replay meal',
      calories: 400,
      protein: 20,
      carbs: 40,
      fats: 10,
      fiber: 5,
      mealType: 'lunch' as const,
      consumedOn: '2026-08-14',
    };
    await calories.addCalorieEntryFromLinkedAction(input);
    await calories.addCalorieEntryFromLinkedAction(input);

    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM calorie_entries WHERE id = ?',
        [input.id],
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('uses deterministic workout log IDs to make replay a single historical row', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Replay routine', '');
    const routineId = (await workout.listRoutines())[0].id;
    const input = { id: 'wrk_log_replay_1', routineId, notes: 'replay' };
    await workout.logWorkoutFromLinkedAction(input);
    await workout.logWorkoutFromLinkedAction(input);

    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_logs WHERE id = ?',
        [input.id],
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('uses deterministic pomodoro session IDs to make replay a single row', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const input = { id: 'pom_replay_1', durationSeconds: 1500, type: 'focus' as const };
    await pomodoro.logPomodoroSessionFromLinkedAction(input);
    await pomodoro.logPomodoroSessionFromLinkedAction(input);

    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM pomodoro_sessions WHERE id = ?',
        [input.id],
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });
});
