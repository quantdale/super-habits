import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import { saveHabitRules } from './helpers/linkedActionRules';
import { toDateKey } from '@/lib/time';

async function seedThresholdCase(targetPerDay: number) {
  const db = await freshDatabase();
  const habits = await import('@/features/habits/habits.data');
  const todos = await import('@/features/todos/todos.data');
  const habitId = await habits.addHabit(`Concurrent ${targetPerDay}`, targetPerDay);
  const todoId = await todos.addTodo({ title: `threshold ${targetPerDay}` });

  await saveHabitRules(habitId, [
    {
      triggerType: 'habit.completed_for_day',
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    },
  ]);

  return { db, habits, habitId };
}

describe('habit threshold concurrency', () => {
  it('fires a target=1 threshold action once for two genuinely concurrent increments', async () => {
    const { db, habits, habitId } = await seedThresholdCase(1);
    const dateKey = toDateKey();

    const results = await Promise.all([
      habits.incrementHabit(habitId, dateKey),
      habits.incrementHabit(habitId, dateKey),
    ]);

    expect(results.map((result) => result.count).sort()).toEqual([1, 2]);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
        [habitId, dateKey],
      ),
    ).toEqual({ count: 2 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM linked_action_executions
         WHERE effect_type = 'todo.complete'`,
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('fires a target=2 threshold action once when two concurrent increments reach it', async () => {
    const { db, habits, habitId } = await seedThresholdCase(2);
    const dateKey = toDateKey();

    const results = await Promise.all([
      habits.incrementHabit(habitId, dateKey),
      habits.incrementHabit(habitId, dateKey),
    ]);

    expect(results.map((result) => result.count).sort()).toEqual([1, 2]);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
        [habitId, dateKey],
      ),
    ).toEqual({ count: 2 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM linked_action_executions
         WHERE effect_type = 'todo.complete'`,
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('keeps three concurrent increments lossless and crosses the threshold once', async () => {
    const { db, habits, habitId } = await seedThresholdCase(2);
    const dateKey = toDateKey();

    await Promise.all(Array.from({ length: 3 }, () => habits.incrementHabit(habitId, dateKey)));

    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
        [habitId, dateKey],
      ),
    ).toEqual({ count: 3 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM linked_action_executions
         WHERE effect_type = 'todo.complete'`,
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('does not record a check-in that loses the writer race to archiving', async () => {
    const { db, habits, habitId } = await seedThresholdCase(1);
    const day = toDateKey();
    try {
      const [archived, incremented] = await Promise.all([
        habits.archiveHabit(habitId, day),
        habits.incrementHabit(habitId, day),
      ]);

      expect(archived).toBe(true);
      expect(incremented.count).toBe(0);
      expect(await habits.getCompletionHistory(habitId)).toEqual([]);
    } finally {
      await db.closeAsync();
    }
  });

  it('checks the target within the same write as a racing schedule edit', async () => {
    const { db, habits, habitId } = await seedThresholdCase(1);
    const day = toDateKey();
    try {
      const [, incremented] = await Promise.all([
        habits.updateHabit(habitId, { name: 'Read', targetPerDay: 2, category: 'anytime' }),
        habits.incrementHabit(habitId, day),
      ]);

      expect(incremented.count).toBe(1);
      expect(incremented.linkedActions.matchedRuleCount).toBe(0);
      expect(
        await db.getFirstAsync('SELECT COUNT(*) AS count FROM linked_action_executions'),
      ).toEqual({ count: 0 });
    } finally {
      await db.closeAsync();
    }
  });
});
