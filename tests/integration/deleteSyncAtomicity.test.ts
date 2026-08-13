import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

async function createOutboxInsertFailure(
  db: {
    execAsync(sql: string): Promise<void>;
  },
  entity: string,
) {
  await db.execAsync(`
    CREATE TRIGGER fail_${entity}_delete_outbox
    BEFORE INSERT ON sync_outbox
    WHEN NEW.entity = '${entity}'
    BEGIN
      SELECT RAISE(ABORT, 'simulated outbox failure');
    END;
  `);
}

describe('local tombstone and sync intent atomicity', () => {
  it('rolls a todo tombstone back when source linked-action cleanup fails', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const sourceId = await todos.addTodo({ title: 'source' });
    const targetId = await todos.addTodo({ title: 'target' });
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: sourceId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: targetId,
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    });
    await db.execAsync(`
      CREATE TRIGGER fail_source_cleanup
      BEFORE UPDATE OF deleted_at ON linked_action_rules
      WHEN OLD.source_entity_id = '${sourceId}'
      BEGIN
        SELECT RAISE(ABORT, 'simulated source cleanup failure');
      END;
    `);

    await expect(todos.removeTodo(sourceId)).rejects.toThrow('simulated source cleanup failure');
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM todos WHERE id = ?',
        [sourceId],
      ),
    ).toEqual({ deleted_at: null });
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM sync_outbox
         WHERE entity = ? AND id = ? AND operation = 'delete'`,
        ['todos', sourceId],
      ),
    ).toEqual({ count: 0 });
    await db.closeAsync();
  });

  it('rolls a todo tombstone back when target linked-action cleanup fails', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const sourceId = await todos.addTodo({ title: 'other source' });
    const targetId = await todos.addTodo({ title: 'target' });
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: sourceId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: targetId,
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    });
    await db.execAsync(`
      CREATE TRIGGER fail_target_cleanup
      BEFORE UPDATE OF deleted_at ON linked_action_rules
      WHEN OLD.target_entity_id = '${targetId}'
      BEGIN
        SELECT RAISE(ABORT, 'simulated target cleanup failure');
      END;
    `);

    await expect(todos.removeTodo(targetId)).rejects.toThrow('simulated target cleanup failure');
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM todos WHERE id = ?',
        [targetId],
      ),
    ).toEqual({ deleted_at: null });
    await db.closeAsync();
  });

  it('rolls back a todo tombstone when the durable delete intent cannot be written', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'outbox failure' });
    await db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND id = ?', ['todos', todoId]);
    await createOutboxInsertFailure(db, 'todos');

    await expect(todos.removeTodo(todoId)).rejects.toThrow('simulated outbox failure');
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM todos WHERE id = ?',
        [todoId],
      ),
    ).toEqual({ deleted_at: null });
    await db.closeAsync();
  });

  it('persists a committed todo tombstone and delete intent across restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-delete-restart-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      const db = await freshDatabase(file);
      const todos = await import('@/features/todos/todos.data');
      const todoId = await todos.addTodo({ title: 'restart delete' });
      await db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND id = ?', ['todos', todoId]);
      await todos.removeTodo(todoId);
      await db.closeAsync();

      const restarted = await freshDatabase(file);
      expect(
        await restarted.getFirstAsync<{ deleted_at: string | null }>(
          'SELECT deleted_at FROM todos WHERE id = ?',
          [todoId],
        ),
      ).not.toEqual({ deleted_at: null });
      expect(
        await restarted.getFirstAsync<{ operation: string }>(
          'SELECT operation FROM sync_outbox WHERE entity = ? AND id = ?',
          ['todos', todoId],
        ),
      ).toEqual({ operation: 'delete' });
      await restarted.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies the same atomic delete-intent boundary to habits and workout routines', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('delete habit', 1);
    await db.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND id = ?', ['habits', habitId]);
    await createOutboxInsertFailure(db, 'habits');
    await expect(habits.deleteHabit(habitId)).rejects.toThrow('simulated outbox failure');
    expect(
      await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM habits WHERE id = ?',
        [habitId],
      ),
    ).toEqual({ deleted_at: null });
    await db.closeAsync();

    const secondDb = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('delete routine', '');
    const routineId = (await workout.listRoutines())[0].id;
    await secondDb.runAsync('DELETE FROM sync_outbox WHERE entity = ? AND id = ?', [
      'workout_routines',
      routineId,
    ]);
    await createOutboxInsertFailure(secondDb, 'workout_routines');
    await expect(workout.deleteRoutine(routineId)).rejects.toThrow('simulated outbox failure');
    expect(
      await secondDb.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM workout_routines WHERE id = ?',
        [routineId],
      ),
    ).toEqual({ deleted_at: null });
    await secondDb.closeAsync();
  });
});
