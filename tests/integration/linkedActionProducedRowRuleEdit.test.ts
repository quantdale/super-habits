import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { saveTodoRules } from './helpers/linkedActionRules';

/**
 * A source rule can be re-authored in place: the editor resubmits the SAME
 * `existingRuleId` with a different target/effect, so the rule's durable
 * identity survives an effect-type change. The produced-row re-entry guard
 * (cfdc446f) keys on (rule, source entity, trigger, local day) and used to look
 * up ANY prior execution of that rule for the produced-row effect types
 * without checking which effect type was actually executed.
 *
 * That made a rule edit poison the guard: after `todo.completed → pomodoro.log`
 * fires once, editing the rule to `todo.completed → todo.complete` left the
 * pomodoro receipt on disk, and the next untick → retick of the source resolved
 * to that receipt as a "duplicate", so the binary effect never ran and the
 * target task stayed incomplete. The symmetric case (calorie.log edited to
 * pomodoro.log) reported a duplicate for a focus session that was never
 * produced — zero sessions instead of one.
 *
 * The guard must only consider prior executions OF THE CURRENT effect type, and
 * only when the current plan is itself a produced-row effect.
 */
describe('a produced-row receipt does not leak across an edited rule effect type', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function countOnce(sql: string, params: (string | number)[] = []): Promise<number> {
    const row = await db.getFirstAsync<{ n: number }>(sql, params);
    return row?.n ?? 0;
  }

  async function executionTypes(): Promise<string[]> {
    const rows = await db.getAllAsync<{ effect_type: string; status: string }>(
      'SELECT effect_type, status FROM linked_action_executions ORDER BY created_at ASC, id ASC',
    );
    return rows.map((row) => `${row.effect_type}:${row.status}`);
  }

  it('pomodoro.log edited to todo.complete still completes the target on untick → retick', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Deep work block' });
    const targetId = await todos.addTodo({ title: 'Write the summary' });

    const [ruleId] = await saveTodoRules(sourceId, [
      {
        triggerType: 'todo.completed',
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
      },
    ]);

    // First source day: the pomodoro receipt is applied.
    await todos.completeTodo(sourceId);
    expect(await countOnce('SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBe(1);
    expect(await executionTypes()).toEqual(['pomodoro.log:applied']);

    // The user edits that SAME rule to a binary effect (editor resubmits the
    // existing id, so the rule identity and its history survive).
    await todos.saveTodoLinkedActionRules(sourceId, [
      {
        existingRuleId: ruleId,
        triggerType: 'todo.completed',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);
    const edited = await todos.listTodoLinkedActionRules(sourceId);
    expect(edited.map((rule) => [rule.id, rule.rawEffectType])).toEqual([
      [ruleId, 'todo.complete'],
    ]);

    // Same local day: untick → retick re-fires the (now edited) source rule.
    await todos.setTodoCompletionState(sourceId, 0);
    await todos.completeTodo(sourceId);

    // The binary effect must run: the stale pomodoro receipt is not a duplicate
    // of `todo.complete`, and the guard is not even consulted for a binary
    // effect.
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        targetId,
      ]),
    ).toEqual({ completed: 1 });
    expect(await countOnce('SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBe(1);
    expect(await executionTypes()).toEqual(['pomodoro.log:applied', 'todo.complete:applied']);
  });

  it('calorie.log edited to pomodoro.log still produces exactly one focus session', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Morning routine' });

    const [ruleId] = await saveTodoRules(sourceId, [
      {
        triggerType: 'todo.completed',
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
      },
    ]);

    await todos.completeTodo(sourceId);
    expect(
      await countOnce('SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBe(1);
    expect(await executionTypes()).toEqual(['calorie.log:applied']);

    // Edit the same rule to a DIFFERENT produced-row effect type.
    await todos.saveTodoLinkedActionRules(sourceId, [
      {
        existingRuleId: ruleId,
        triggerType: 'todo.completed',
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
      },
    ]);

    await todos.setTodoCompletionState(sourceId, 0);
    await todos.completeTodo(sourceId);

    // One focus session: the calorie receipt belongs to a different effect type
    // and is not a duplicate of `pomodoro.log`. The earlier calorie row is not
    // reversed either.
    expect(await countOnce('SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBe(1);
    expect(
      await countOnce('SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
    ).toBe(1);
    expect(await executionTypes()).toEqual(['calorie.log:applied', 'pomodoro.log:applied']);
  });
});
