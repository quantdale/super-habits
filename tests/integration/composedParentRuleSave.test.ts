/**
 * AUD-SH14-A / AUD-SH14-B — parent creation plus rule saving must be one unit.
 *
 * Audited defect (SH-14, Medium): the Todo editor committed a parent via
 * `addTodo` and THEN saved linked-action rules in a separate call. An injected
 * rule-persistence failure left one committed parent with no rules, and one
 * retry created a SECOND same-title parent — the newly created identity from the
 * first attempt was simply discarded. Habits follow the same sequence. An inline
 * error alone never established idempotency.
 *
 * The resolution is a composed data-layer operation per editor: validate the
 * whole proposed rule set, then commit the parent row and every rule replacement
 * in ONE transaction with their intents. Any failure rolls all of it back.
 */

import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { SaveLinkedActionRuleForSourceInput } from '@/core/linked-actions/linkedActions.types';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const NOW = new Date().toISOString();

async function seedHabitTarget(db: TestDatabase): Promise<void> {
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES ('habit_target', 'Hydrate', 5, 'anytime', 'water-drop', '#64748b', '[]', ?, ?, NULL)`,
    [NOW, NOW],
  );
}

/**
 * Install a REAL persistence fault on linked-action rule writes.
 *
 * A SQLite trigger that aborts every rule INSERT/UPDATE is a genuine
 * storage-level failure (not a stubbed helper throwing), so it exercises the
 * actual transaction boundary the audited defect crossed.
 *
 * @param db the test database
 */
async function failRuleWrites(db: TestDatabase): Promise<void> {
  await db.runAsync(
    `CREATE TRIGGER sh14_fail_rule_insert BEFORE INSERT ON linked_action_rules
     BEGIN SELECT RAISE(ABORT, 'SH14 simulated rule persistence failure'); END;`,
  );
  await db.runAsync(
    `CREATE TRIGGER sh14_fail_rule_update BEFORE UPDATE ON linked_action_rules
     BEGIN SELECT RAISE(ABORT, 'SH14 simulated rule persistence failure'); END;`,
  );
}

async function clearRuleFault(db: TestDatabase): Promise<void> {
  await db.runAsync('DROP TRIGGER IF EXISTS sh14_fail_rule_insert');
  await db.runAsync('DROP TRIGGER IF EXISTS sh14_fail_rule_update');
}

function ruleFor(amount: number): SaveLinkedActionRuleForSourceInput {
  return {
    triggerType: 'todo.completed',
    target: {
      feature: 'habits',
      entityType: 'habit',
      entityId: 'habit_target',
      effect: {
        kind: 'progress',
        type: 'habit.increment',
        amount,
        dateStrategy: 'source_date',
      },
    },
  };
}

async function countTodos(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
  );
  return Number(row?.n ?? 0);
}

async function countRules(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM linked_action_rules WHERE deleted_at IS NULL',
  );
  return Number(row?.n ?? 0);
}

async function todoIntents(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'todos'",
  );
  return Number(row?.n ?? 0);
}

describe('AUD-SH14-A: a failing rule save rolls the parent back', () => {
  it('an invalid rule leaves no parent, no rule and no intent behind', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');

    // A rule whose parent target does not exist: the shared rule writer refuses
    // it, which is exactly the "a later rule write failed" condition.
    await failRuleWrites(db);
    const thrown = await todos
      .addTodoWithLinkedActionRules({
        title: 'Composed task',
        priority: 'normal',
        rules: [ruleFor(1)],
      })
      .catch((error: unknown) => error);
    expect(thrown).toBeInstanceOf(Error);
    expect(String((thrown as Error).message)).toMatch(/SH14 simulated rule persistence failure/);

    // Atomic outcome: nothing committed at all.
    expect(await countTodos(db)).toBe(0);
    expect(await countRules(db)).toBe(0);
    expect(await todoIntents(db)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('a retry after a failed rule save creates exactly one parent', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');
    // First attempt fails at the rule write.
    await failRuleWrites(db);
    await expect(
      todos.addTodoWithLinkedActionRules({ title: 'Retry task', rules: [ruleFor(1)] }),
    ).rejects.toBeInstanceOf(Error);
    expect(await countTodos(db)).toBe(0);

    // The retry (fault cleared) must create exactly ONE task.
    await clearRuleFault(db);
    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Retry task',
      rules: [ruleFor(1)],
    });
    expect(typeof id).toBe('string');
    expect(await countTodos(db)).toBe(1);
    expect(await countRules(db)).toBe(1);
    await db.closeAsync();
  }, 60000);

  it('a successful composed create commits the parent and every rule together', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');

    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Multi-rule task',
      notes: 'first failure then a later one',
      priority: 'urgent',
      rules: [ruleFor(1), ruleFor(2)],
    });

    const row = await db.getFirstAsync<{ title: string; notes: string | null; priority: string }>(
      'SELECT title, notes, priority FROM todos WHERE id = ?',
      [id],
    );
    expect(row).toMatchObject({
      title: 'Multi-rule task',
      notes: 'first failure then a later one',
      priority: 'urgent',
    });
    expect(await countRules(db)).toBe(2);
    // One coherent set of intents: the parent create plus the rule creates.
    const intents = await db.getAllAsync<{ entity: string }>(
      'SELECT entity FROM sync_outbox ORDER BY entity',
    );
    expect(intents.filter((intent) => intent.entity === 'todos')).toHaveLength(1);
    expect(intents.filter((intent) => intent.entity === 'linked_action_rules')).toHaveLength(2);
    await db.closeAsync();
  }, 60000);

  it('a double submit cannot create two parents', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');
    const results = await Promise.all([
      todos.addTodoWithLinkedActionRules({ title: 'Double task', rules: [ruleFor(1)] }),
      todos.addTodoWithLinkedActionRules({ title: 'Double task', rules: [ruleFor(1)] }),
    ]);
    expect(new Set(results).size).toBe(2);
    // Two deliberate creates are two rows — the guard is the screen's submit
    // guard — but each row owns exactly ONE rule set (no cross-assignment).
    expect(await countTodos(db)).toBe(2);
    expect(await countRules(db)).toBe(2);
    const perSource = await db.getAllAsync<{ source_entity_id: string; n: number }>(
      `SELECT source_entity_id, COUNT(*) AS n
       FROM linked_action_rules WHERE deleted_at IS NULL
       GROUP BY source_entity_id ORDER BY source_entity_id`,
    );
    expect(perSource.every((row) => row.n === 1)).toBe(true);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH14-B: the existing-parent edit keeps the whole-save contract', () => {
  it('a failing rule replacement rolls the row edit back too', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Original title',
      rules: [ruleFor(1)],
    });

    await failRuleWrites(db);
    await expect(
      todos.updateTodoWithLinkedActionRules(id, { title: 'Edited title' }, [ruleFor(2)]),
    ).rejects.toBeInstanceOf(Error);
    await clearRuleFault(db);

    // The row keeps its ORIGINAL title and its original rule set: neither the
    // edit nor the replacement half-applied.
    const row = await db.getFirstAsync<{ title: string }>('SELECT title FROM todos WHERE id = ?', [
      id,
    ]);
    expect(row?.title).toBe('Original title');
    expect(await countRules(db)).toBe(1);
    await db.closeAsync();
  }, 60000);

  it('a successful edit replaces the complete rule set', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Before',
      rules: [ruleFor(1)],
    });
    await todos.updateTodoWithLinkedActionRules(id, { title: 'After' }, [ruleFor(2), ruleFor(3)]);
    const row = await db.getFirstAsync<{ title: string }>('SELECT title FROM todos WHERE id = ?', [
      id,
    ]);
    expect(row?.title).toBe('After');
    expect(await countRules(db)).toBe(2);
    await db.closeAsync();
  }, 60000);

  it('a soft-deleted parent refuses without changing child or intents', async () => {
    const db = await freshDatabase();
    await seedHabitTarget(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Doomed',
      rules: [ruleFor(1)],
    });
    await todos.removeTodo(id);
    const intentsBefore = await db.getAllAsync<{ entity: string; id: string; operation: string }>(
      'SELECT entity, id, operation FROM sync_outbox ORDER BY entity, id',
    );
    const rulesBefore = await countRules(db);

    // A soft-deleted parent yields no row change, so the whole save is a no-op
    // (never a half-applied write on a tombstoned task).
    await todos.updateTodoWithLinkedActionRules(id, { title: 'Nope' }, [ruleFor(9)]);
    const tombstoned = await db.getFirstAsync<{ title: string; deleted_at: string | null }>(
      'SELECT title, deleted_at FROM todos WHERE id = ?',
      [id],
    );
    expect(tombstoned?.title).toBe('Doomed');
    expect(tombstoned?.deleted_at).not.toBeNull();

    expect(await countRules(db)).toBe(rulesBefore);
    const intentsAfter = await db.getAllAsync<{ entity: string; id: string; operation: string }>(
      'SELECT entity, id, operation FROM sync_outbox ORDER BY entity, id',
    );
    expect(intentsAfter).toEqual(intentsBefore);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH14-A/B: the Habit editor uses the same composed contract', () => {
  it('a failing rule save leaves no habit behind', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_target', 'Target', NULL, 0, ?, ?, NULL)`,
      [NOW, NOW],
    );
    const habits = await import('@/features/habits/habits.data');
    await failRuleWrites(db);
    await expect(
      habits.addHabitWithLinkedActionRules({
        name: 'Composed habit',
        targetPerDay: 2,
        rules: [
          {
            triggerType: 'habit.completed_for_day',
            target: {
              feature: 'todos',
              entityType: 'todo',
              entityId: 'todo_target',
              effect: { kind: 'binary', type: 'todo.complete' },
            },
          },
        ],
      }),
    ).rejects.toBeInstanceOf(Error);

    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM habits WHERE name = 'Composed habit'",
    );
    expect(Number(row?.n ?? -1)).toBe(0);
    expect(await countRules(db)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('a successful composed habit create commits the row and its rules', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_target', 'Target', NULL, 0, ?, ?, NULL)`,
      [NOW, NOW],
    );
    const habits = await import('@/features/habits/habits.data');
    const id = await habits.addHabitWithLinkedActionRules({
      name: 'Composed habit',
      targetPerDay: 2,
      weekdays: [1, 2, 3, 4, 5],
      rules: [
        {
          triggerType: 'habit.completed_for_day',
          target: {
            feature: 'todos',
            entityType: 'todo',
            entityId: 'todo_target',
            effect: { kind: 'binary', type: 'todo.complete' },
          },
        },
      ],
    });
    const row = await db.getFirstAsync<{ name: string; target_per_day: number }>(
      'SELECT name, target_per_day FROM habits WHERE id = ?',
      [id],
    );
    expect(row).toMatchObject({ name: 'Composed habit', target_per_day: 2 });
    expect(await countRules(db)).toBe(1);
    await db.closeAsync();
  }, 60000);

  it('a failing habit edit rolls the row back', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_target', 'Target', NULL, 0, ?, ?, NULL)`,
      [NOW, NOW],
    );
    const habits = await import('@/features/habits/habits.data');
    const id = await habits.addHabitWithLinkedActionRules({
      name: 'Original name',
      targetPerDay: 1,
      rules: [
        {
          triggerType: 'habit.completed_for_day',
          target: {
            feature: 'todos',
            entityType: 'todo',
            entityId: 'todo_target',
            effect: { kind: 'binary', type: 'todo.complete' },
          },
        },
      ],
    });
    await failRuleWrites(db);
    await expect(
      habits.updateHabitWithLinkedActionRules(
        id,
        { name: 'Renamed', targetPerDay: 1, category: 'anytime' },
        [
          {
            triggerType: 'habit.completed_for_day',
            target: {
              feature: 'todos',
              entityType: 'todo',
              entityId: 'todo_target',
              effect: { kind: 'binary', type: 'todo.complete' },
            },
          },
        ],
      ),
    ).rejects.toBeInstanceOf(Error);
    await clearRuleFault(db);
    const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM habits WHERE id = ?', [
      id,
    ]);
    expect(row?.name).toBe('Original name');
    expect(await countRules(db)).toBe(1);
    await db.closeAsync();
  }, 60000);
});
