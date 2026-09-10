import { afterEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Todo bulk operations against real SQLite. The unit suite exercises these via
 * a mocked DB; this suite proves the per-item invariants on the real schema:
 * one transactional write, idempotent per-item semantics, coalesced durable
 * intents, and the F11 daily-plan prune on removal.
 */
describe('todo bulk operations (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('bulk completion changes only rows that need it and coalesces one intent per row', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');

    const a = await todos.addTodo({ title: 'Alpha' });
    const b = await todos.addTodo({ title: 'Beta' });
    const c = await todos.addTodo({ title: 'Gamma' });
    await todos.completeTodo(c);
    const cBefore = await db.getFirstAsync<{ completed_at: string | null; updated_at: string }>(
      `SELECT completed_at, updated_at FROM todos WHERE id = ?`,
      [c],
    );

    const outcome = await todos.bulkSetTodoCompletion([a, b, c, 'todo_missing'], 1);
    expect(outcome).toEqual({ changed: 2, skipped: 2 });

    const rows = await db.getAllAsync<{
      id: string;
      completed: number;
      completed_at: string | null;
    }>(`SELECT id, completed, completed_at FROM todos ORDER BY created_at ASC`);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(a)?.completed).toBe(1);
    expect(byId.get(a)?.completed_at).not.toBeNull();
    expect(byId.get(b)?.completed).toBe(1);
    // Gamma was already complete; the bulk call did not rewrite it.
    const cAfter = await db.getFirstAsync<{ completed_at: string | null; updated_at: string }>(
      `SELECT completed_at, updated_at FROM todos WHERE id = ?`,
      [c],
    );
    expect(cAfter).toEqual(cBefore);

    const aIntents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'todos' AND id = ?`,
      [a],
    );
    expect(aIntents.map((row) => row.operation)).toEqual(['update']);

    // Reopening is the inverse and idempotent on a second run.
    expect(await todos.bulkSetTodoCompletion([a], 0)).toEqual({ changed: 1, skipped: 0 });
    expect(await todos.bulkSetTodoCompletion([a], 0)).toEqual({ changed: 0, skipped: 1 });
    const reopened = await db.getFirstAsync<{ completed: number; completed_at: string | null }>(
      `SELECT completed, completed_at FROM todos WHERE id = ?`,
      [a],
    );
    expect(reopened).toEqual({ completed: 0, completed_at: null });
  });

  it('bulk priority and project assignment apply once, skip repetitions, and clear cleanly', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const projects = await import('@/features/projects/projects.data');

    const a = await todos.addTodo({ title: 'Alpha' });
    const b = await todos.addTodo({ title: 'Beta' });

    expect(await todos.bulkUpdateTodoPriority([a, b], 'urgent')).toEqual({
      changed: 2,
      skipped: 0,
    });
    expect(await todos.bulkUpdateTodoPriority([a, b], 'urgent')).toEqual({
      changed: 0,
      skipped: 2,
    });
    const priorities = await db.getAllAsync<{ priority: string }>(
      `SELECT priority FROM todos ORDER BY created_at ASC`,
    );
    expect(priorities.map((row) => row.priority)).toEqual(['urgent', 'urgent']);

    const projectId = await projects.addProject({ name: 'Home renovation' });
    expect(await todos.bulkAssignTodosProject([a], projectId)).toEqual({ changed: 1, skipped: 0 });
    expect(await todos.bulkAssignTodosProject([a], projectId)).toEqual({ changed: 0, skipped: 1 });
    expect(
      await db.getFirstAsync<{ project_id: string | null }>(
        `SELECT project_id FROM todos WHERE id = ?`,
        [a],
      ),
    ).toEqual({ project_id: projectId });

    // "No project" clears the association.
    expect(await todos.bulkAssignTodosProject([a], null)).toEqual({ changed: 1, skipped: 0 });
    expect(
      await db.getFirstAsync<{ project_id: string | null }>(
        `SELECT project_id FROM todos WHERE id = ?`,
        [a],
      ),
    ).toEqual({ project_id: null });
  });

  it('bulk removal tombstones once, prunes daily-plan references, and enqueues delete intents', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    const a = await todos.addTodo({ title: 'Alpha' });
    const b = await todos.addTodo({ title: 'Beta' });
    await plans.upsertDailyPlan(toDateKey(), { topTodoIds: [a, b] });

    const outcome = await todos.bulkRemoveTodos([a, 'todo_missing']);
    expect(outcome).toEqual({ changed: 1, skipped: 1 });

    const rows = await db.getAllAsync<{ id: string; deleted_at: string | null }>(
      `SELECT id, deleted_at FROM todos ORDER BY created_at ASC`,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(a)?.deleted_at).not.toBeNull();
    expect(byId.get(b)?.deleted_at).toBeNull();

    const deleteIntents = await db.getAllAsync<{ id: string; operation: string }>(
      `SELECT id, operation FROM sync_outbox WHERE entity = 'todos' AND id = ?`,
      [a],
    );
    expect(deleteIntents).toEqual([{ id: a, operation: 'delete' }]);

    // F11: the plan reference is pruned in the same transaction and the plan
    // carries its own update intent.
    const planRow = await db.getFirstAsync<{ top_todo_ids: string }>(
      `SELECT top_todo_ids FROM daily_plans WHERE deleted_at IS NULL`,
    );
    expect(JSON.parse(planRow!.top_todo_ids)).toEqual([b]);
    const planIntents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans'`,
    );
    expect(planIntents.map((row) => row.operation)).toEqual(['update']);
  });
});
