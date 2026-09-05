import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Wave 6 (design D6, option A): the newly exposed calorie.log and
 * pomodoro.log targets are authored through the real rule contract, fired by
 * a real todo completion, and proven exactly-once across a source-event
 * replay — production write paths only, real SQLite.
 */
describe('log-target linked actions (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function authorLogRules(todoId: string) {
    const linked = await import('@/core/linked-actions/linkedActions.data');
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'calories',
        entityType: 'calorie_log',
        entityId: null,
        effect: {
          kind: 'log',
          type: 'calorie.log',
          dateStrategy: 'today',
          templateSource: 'inline',
          savedMealId: null,
          foodName: 'Post-run smoothie',
          calories: 250,
          protein: 0,
          carbs: 0,
          fats: 0,
          fiber: 0,
          mealType: 'snack',
        },
      },
    });
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: todoId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'pomodoro',
        entityType: 'pomodoro_session',
        entityId: null,
        effect: {
          kind: 'log',
          type: 'pomodoro.log',
          sessionType: 'focus',
          durationSeconds: 1500,
        },
      },
    });
  }

  it('a completed authored task logs the calorie entry and focus session once', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Evening run' });
    await authorLogRules(todoId);

    await todos.completeTodo(todoId);

    const calorie = await db.getFirstAsync<{
      food_name: string;
      calories: number;
      meal_type: string;
      consumed_on: string;
    }>(
      'SELECT food_name, calories, meal_type, consumed_on FROM calorie_entries WHERE deleted_at IS NULL',
    );
    expect(calorie).toMatchObject({
      food_name: 'Post-run smoothie',
      calories: 250,
      meal_type: 'snack',
    });
    expect(calorie?.consumed_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const session = await db.getFirstAsync<{ duration_seconds: number; session_type: string }>(
      'SELECT duration_seconds, session_type FROM pomodoro_sessions',
    );
    expect(session).toEqual({ duration_seconds: 1500, session_type: 'focus' });

    const applied = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM linked_action_executions WHERE status = 'applied'`,
    );
    expect(applied).toEqual({ n: 2 });
  });

  it('replaying the same source event duplicates nothing', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const engine = await import('@/core/linked-actions/linkedActions.engine');
    const todoId = await todos.addTodo({ title: 'Replayed run' });
    await authorLogRules(todoId);

    const source = {
      eventId: 'levt_log_targets_1',
      feature: 'todos' as const,
      entityType: 'todo' as const,
      entityId: todoId,
      triggerType: 'todo.completed' as const,
      label: 'Replayed run',
      chain: { chainId: 'lchain_log_targets_1' },
    };
    const first = await engine.linkedActionsEngine.processSourceAction(source);
    const second = await engine.linkedActionsEngine.processSourceAction(source);

    expect(first.effects.map((effect) => effect.status)).toEqual(['applied', 'applied']);
    expect(second.effects.map((effect) => effect.status)).toEqual(['duplicate', 'duplicate']);

    for (const [sql] of [
      ['SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'],
      ['SELECT COUNT(*) AS n FROM pomodoro_sessions'],
    ] as const) {
      const row = await db.getFirstAsync<{ n: number }>(sql);
      expect(row).toEqual({ n: 1 });
    }
  });

  it('logs ride the durable outbox like every other recoverable write', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const { toDateKey } = await import('@/lib/time');
    const todoId = await todos.addTodo({ title: 'Backed-up run' });
    await authorLogRules(todoId);

    await todos.completeTodo(todoId);

    const calorie = await db.getFirstAsync<{ consumed_on: string }>(
      'SELECT consumed_on FROM calorie_entries WHERE deleted_at IS NULL',
    );
    // dateStrategy 'today' lands the entry on the local calendar day.
    expect(calorie?.consumed_on).toBe(toDateKey());

    const intents = await db.getAllAsync<{ entity: string; operation: string }>(
      `SELECT entity, operation FROM sync_outbox
       WHERE entity IN ('calorie_entries', 'pomodoro_sessions')`,
    );
    expect(intents.map((intent) => `${intent.entity}:${intent.operation}`).sort()).toEqual([
      'calorie_entries:create',
      'pomodoro_sessions:create',
    ]);
  });
});
