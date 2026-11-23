import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

let db: TestDatabase;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15, 0, 10));
  db = await freshDatabase();
});

afterEach(async () => {
  await db.closeAsync();
  vi.useRealTimers();
});

describe('gamification award attribution', () => {
  it('credits a focus session across midnight to its local start day', async () => {
    const { recordCompletedPomodoroSession } = await import('@/features/pomodoro/pomodoro.data');
    const { awardGamificationAction, runGamificationHousekeeping } =
      await import('@/features/gamification/gamification.data');

    const session = await recordCompletedPomodoroSession({
      type: 'focus',
      startedAtIso: new Date(2026, 9, 14, 23, 45).toISOString(),
      endedAtIso: new Date().toISOString(),
      durationSeconds: 25 * 60,
    });
    expect(session.inserted).toBe(true);

    const award = await awardGamificationAction({ kind: 'focus', entityId: session.id });
    expect(award?.result.events[0]).toMatchObject({
      kind: 'focus',
      sourceKey: session.id,
      dateKey: '2026-10-14',
    });
    expect(award?.snapshot.streak.activeToday).toBe(false);

    await runGamificationHousekeeping();
    expect(
      await db.getAllAsync('SELECT date_key FROM gamification_events WHERE event_kind = ?', [
        'focus',
      ]),
    ).toEqual([{ date_key: '2026-10-14' }]);
  });

  it('does not pay stale first reports after a todo is reopened, a check-in undone or a workout deleted', async () => {
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const workouts = await import('@/features/workout/workout.data');
    const { awardGamificationAction } = await import('@/features/gamification/gamification.data');

    const todoId = await todos.addTodo({ title: 'Draft notes' });
    expect((await todos.completeTodo(todoId)).completed).toBe(1);
    expect((await todos.setTodoCompletionState(todoId, 0)).completed).toBe(0);
    const habitId = await habits.addHabit('Read', 1);
    await habits.incrementHabit(habitId);
    await habits.decrementHabit(habitId);
    await workouts.addRoutine('Stretch', '');
    const [routine] = await workouts.listRoutines();
    const { logId } = await workouts.completeRoutine(routine.id);
    expect(logId).not.toBeNull();
    expect(await workouts.deleteWorkoutLog(logId!)).toBe(true);

    const results = await Promise.all([
      awardGamificationAction({ kind: 'todo', entityId: todoId }),
      awardGamificationAction({ kind: 'habit', entityId: habitId }),
      awardGamificationAction({ kind: 'workout', entityId: logId! }),
    ]);

    expect(results).toEqual([null, null, null]);
    expect(await db.getAllAsync('SELECT id FROM gamification_events')).toEqual([]);
  });

  it('credits the saved nutrition day even if today also has an unrewarded meal', async () => {
    const { addCalorieEntry } = await import('@/features/calories/calories.data');
    const { awardGamificationAction } = await import('@/features/gamification/gamification.data');
    const yesterday = '2026-10-14';
    for (const consumedOn of [yesterday, '2026-10-15']) {
      await addCalorieEntry(
        {
          foodName: 'Apple',
          calories: 96,
          protein: 0,
          carbs: 24,
          fats: 0,
          fiber: 0,
          consumedOn,
          mealType: 'snack',
        },
        { maintainSavedMeal: false },
      );
    }

    const award = await awardGamificationAction({ kind: 'nutrition', entityId: yesterday });

    expect(award?.result.events[0]).toMatchObject({
      kind: 'nutrition',
      sourceKey: yesterday,
      dateKey: yesterday,
    });
    expect(award?.snapshot.todayFacts.xpEarned).toBe(0);
  });
});
