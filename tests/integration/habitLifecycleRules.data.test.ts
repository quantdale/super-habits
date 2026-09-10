import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Habit lifecycle and linked-rule persistence against real SQLite. Archive and
 * unarchive were previously exercised only through mocked DBs, and the habit
 * linked-action rule save/list path had no real-SQL proof.
 */
describe('habit lifecycle and linked rules (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('archives and restores a habit through exclusive lifecycle states', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');

    const habitId = await habits.addHabit('Read 20 pages', 1);

    expect(await habits.archiveHabit(habitId)).toBe(true);
    let habit = (await habits.listHabits()).find((row) => row.id === habitId);
    expect(habit?.status).toBe('archived');

    expect(await habits.unarchiveHabit(habitId)).toBe(true);
    habit = (await habits.listHabits()).find((row) => row.id === habitId);
    expect(habit?.status).toBe('active');

    // The status column is the lifecycle truth, and restoring must not
    // destroy the persisted scheduling rule.
    expect(habit?.rule_history).toContain('"target_per_day":1');
    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'habits' AND id = ?`,
      [habitId],
    );
    expect(intents.map((row) => row.operation)).toEqual(['update']);

    // Unarchiving an already-active habit is a no-op.
    expect(await habits.unarchiveHabit(habitId)).toBe(false);
  });

  it('saves, lists, and clears habit linked-action rules durably', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');

    const habitId = await habits.addHabit('Meditate', 1);
    const todoId = await todos.addTodo({ title: 'Log the session' });

    expect(await habits.listHabitLinkedActionRules(habitId)).toEqual([]);

    await habits.saveHabitLinkedActionRules(habitId, [
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

    const rules = await habits.listHabitLinkedActionRules(habitId);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.isUnsupported).toBe(false);
    expect(rules[0]?.source).toMatchObject({
      feature: 'habits',
      entityType: 'habit',
      entityId: habitId,
      triggerType: 'habit.completed_for_day',
    });
    expect(rules[0]?.target).toMatchObject({
      feature: 'todos',
      entityType: 'todo',
      entityId: todoId,
    });

    const savedRuleId = rules[0]?.id;
    await habits.saveHabitLinkedActionRules(habitId, []);
    expect(await habits.listHabitLinkedActionRules(habitId)).toEqual([]);
    const deleted = await db.getFirstAsync<{ deleted_at: string | null }>(
      `SELECT deleted_at FROM linked_action_rules WHERE id = ?`,
      [savedRuleId],
    );
    expect(deleted?.deleted_at).not.toBeNull();
  });
});
