import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Task 2.9 — a full linked-action cycle against REAL rows: source trigger →
 * rule match → effect apply → execution record, plus re-fire suppression and
 * `target_missing` skips, all through the real engine + data layers.
 *
 * The engine guards are backed by the two UNIQUE indexes exercised at the raw
 * level in constraints.test.ts; here they are observed through the app's own
 * code paths (toggleTodo dispatching into the engine, the executor writing
 * into features/habits and features/todos).
 */

async function createTodoHabitIncrementCycle(db: TestDatabase) {
  const todos = await import('@/features/todos/todos.data');
  const habits = await import('@/features/habits/habits.data');
  const linked = await import('@/core/linked-actions/linkedActions.data');
  const engineModule = await import('@/core/linked-actions/linkedActions.engine');

  const sourceTodoId = await todos.addTodo({ title: 'Ship the report' });
  const targetHabitId = await habits.addHabit('Drink water', 3);

  await linked.createLinkedActionRule({
    source: {
      feature: 'todos',
      entityType: 'todo',
      entityId: sourceTodoId,
      triggerType: 'todo.completed',
    },
    target: {
      feature: 'habits',
      entityType: 'habit',
      entityId: targetHabitId,
      effect: {
        kind: 'progress',
        type: 'habit.increment',
        amount: 1,
        dateStrategy: 'source_date',
      },
    },
  });

  return { todos, habits, linked, engineModule, sourceTodoId, targetHabitId };
}

describe('full source → rule → effect → execution cycle', () => {
  it('completing a todo once increments the target habit exactly once and records the execution', async () => {
    const db = await freshDatabase();
    const { todos, targetHabitId, sourceTodoId } = await createTodoHabitIncrementCycle(db);

    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    const result = await todos.toggleTodo(source);

    // Source trigger dispatched the rule.
    expect(result.completed).toBe(1);
    expect(result.linkedActions.matchedRuleCount).toBe(1);
    expect(result.linkedActions.notices).toHaveLength(1);

    // Effect applied on the real target row.
    const completions = await db.getAllAsync<{ habit_id: string; count: number }>(
      'SELECT habit_id, count FROM habit_completions WHERE habit_id = ?',
      [targetHabitId],
    );
    expect(completions).toHaveLength(1);
    expect(completions[0].count).toBe(1);

    // The execution record exists and is applied.
    const executions = await db.getAllAsync<{
      rule_id: string;
      status: string;
      effect_type: string;
      target_entity_id: string;
      produced_entity_type: string | null;
    }>(
      'SELECT rule_id, status, effect_type, target_entity_id, produced_entity_type FROM linked_action_executions',
    );
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({
      status: 'applied',
      effect_type: 'habit.increment',
      target_entity_id: targetHabitId,
      produced_entity_type: null,
    });

    // The source event was recorded against the real todo.
    const events = await db.getAllAsync<{ source_entity_id: string; trigger_type: string }>(
      'SELECT source_entity_id, trigger_type FROM linked_action_events',
    );
    expect(events).toEqual([
      expect.objectContaining({ source_entity_id: sourceTodoId, trigger_type: 'todo.completed' }),
    ]);
    expect(events).toHaveLength(1);

    await db.closeAsync();
  });
});

describe('re-fire suppression', () => {
  it('reprocessing the same source event is a duplicate: no new execution, no second increment', async () => {
    const db = await freshDatabase();
    const { todos, targetHabitId, sourceTodoId, engineModule } =
      await createTodoHabitIncrementCycle(db);
    const engine = engineModule.linkedActionsEngine;

    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    await todos.toggleTodo(source);

    // Pull the event the real dispatch created, then reprocess THE SAME event
    // (what an idempotent retry / duplicate dispatch of one completion would do).
    const event = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM linked_action_events WHERE source_entity_id = ?',
      [sourceTodoId],
    );
    expect(event).not.toBeNull();

    const reprocessed = await engine.processSourceAction({
      eventId: event!.id,
      feature: 'todos',
      entityType: 'todo',
      entityId: sourceTodoId,
      triggerType: 'todo.completed',
      label: 'Ship the report',
      sourceDateKey: '2026-07-01',
    });

    expect(reprocessed.effects[0]).toMatchObject({
      status: 'duplicate',
      reason: 'source_event_already_executed',
    });
    expect(reprocessed.notices).toEqual([]);

    // Nothing changed on disk.
    const executions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM linked_action_executions',
    );
    expect(executions?.n).toBe(1);
    const completions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = ?',
      [targetHabitId],
    );
    expect(completions?.n).toBe(1);

    await db.closeAsync();
  });

  it('two rapid events sharing one chain only apply the first — the chain guard suppresses the second', async () => {
    const db = await freshDatabase();
    const { sourceTodoId, engineModule } = await createTodoHabitIncrementCycle(db);
    const engine = engineModule.linkedActionsEngine;

    const base = {
      feature: 'todos' as const,
      entityType: 'todo' as const,
      entityId: sourceTodoId,
      triggerType: 'todo.completed' as const,
      label: 'Ship the report',
      sourceDateKey: '2026-07-01',
    };

    const first = await engine.processSourceAction({
      ...base,
      eventId: 'levt_rapid_a',
      chain: { chainId: 'lchain_rapid' },
    });
    expect(first.effects[0].status).toBe('applied');

    // A rapid second fire of the same logical action: new event, same chain.
    const second = await engine.processSourceAction({
      ...base,
      eventId: 'levt_rapid_b',
      chain: { chainId: 'lchain_rapid' },
    });
    expect(second.effects[0]).toMatchObject({
      status: 'duplicate',
      reason: 'chain_guard_duplicate',
    });

    const executions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM linked_action_executions',
    );
    expect(executions?.n).toBe(1); // only the first event's run is recorded

    await db.closeAsync();
  });
});

describe('target_missing skips', () => {
  it('a rule whose target habit is soft-deleted skips with target_missing and records the skip', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');

    // Target is deleted BEFORE the rule is created (the rule editor would not
    // offer it, but `createLinkedActionRule` accepts any id — this is the
    // defensive `target_missing` path the engine exists for).
    const strayHabitId = await habits.addHabit('Stray habit', 3);
    await habits.deleteHabit(strayHabitId);

    const sourceTodoId = await todos.addTodo({ title: 'Trigger with missing target' });
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: sourceTodoId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'habits',
        entityType: 'habit',
        entityId: strayHabitId,
        effect: {
          kind: 'progress',
          type: 'habit.increment',
          amount: 1,
          dateStrategy: 'source_date',
        },
      },
    });

    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    const result = await todos.toggleTodo(source);

    // matcher still matched, the effect skipped, and no notice was produced.
    expect(result.linkedActions.matchedRuleCount).toBe(1);
    expect(result.linkedActions.notices).toEqual([]);

    const execution = await db.getFirstAsync<{ status: string; notice_payload: string | null }>(
      'SELECT status, notice_payload FROM linked_action_executions',
    );
    expect(execution).toMatchObject({ status: 'skipped', notice_payload: null });

    // No completion row was created for the missing target.
    const completions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = ?',
      [strayHabitId],
    );
    expect(completions?.n).toBe(0);

    await db.closeAsync();
  });

  it('skips a todo.complete whose target todo is soft-deleted, leaving it untouched', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const targetTodoId = await todos.addTodo({ title: 'already deleted target' });
    await todos.removeTodo(targetTodoId);
    const sourceTodoId = await todos.addTodo({ title: 'source' });
    await linked.createLinkedActionRule({
      source: {
        feature: 'todos',
        entityType: 'todo',
        entityId: sourceTodoId,
        triggerType: 'todo.completed',
      },
      target: {
        feature: 'todos',
        entityType: 'todo',
        entityId: targetTodoId,
        effect: { kind: 'binary', type: 'todo.complete' },
      },
    });

    const result = await engineModule.linkedActionsEngine.processSourceAction({
      eventId: 'levt_missing_target',
      feature: 'todos',
      entityType: 'todo',
      entityId: sourceTodoId,
      triggerType: 'todo.completed',
      label: 'source',
      sourceDateKey: '2026-07-01',
    });

    expect(result.effects[0]).toMatchObject({
      status: 'skipped',
      reason: 'target_missing',
      effectType: 'todo.complete',
    });
    expect(result.notices).toEqual([]);

    // The deleted target stays deleted and non-completed.
    const target = await db.getFirstAsync<{ completed: number; deleted_at: string | null }>(
      'SELECT completed, deleted_at FROM todos WHERE id = ?',
      [targetTodoId],
    );
    expect(target?.completed).toBe(0);
    expect(target?.deleted_at).not.toBeNull();

    await db.closeAsync();
  });
});
