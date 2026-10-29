import { describe, expect, it, vi, afterEach } from 'vitest';
import { toDateKey } from '@/lib/time';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';
import { saveHabitRules, saveTodoRules } from './helpers/linkedActionRules';

/**
 * Fault-injection proof for the durable linked-action dispatch handoff
 * (campaign A1). Every dispatch path persists its source event row inside the
 * SAME SQLite transaction as the authoritative source write, then dispatches
 * after commit; `recoverPendingLinkedActions()` replays events that never
 * reached a terminal execution, exactly once, through the real engine.
 *
 * Phrase note: the thrown "crash" replaces the post-commit dispatch call, the
 * exact boundary a process death severs. Pre-fix, that boundary left no
 * durable residue at all for in-app paths (the event row was minted inside the
 * dispatch itself); the handoff makes the event row the crash anchor.
 */

async function createTodoHabitIncrementCycle(db: TestDatabase, targetPerDay = 1) {
  const todos = await import('@/features/todos/todos.data');
  const habits = await import('@/features/habits/habits.data');
  const engineModule = await import('@/core/linked-actions/linkedActions.engine');

  const sourceTodoId = await todos.addTodo({ title: 'Ship the report' });
  const targetHabitId = await habits.addHabit('Drink water', targetPerDay);

  await saveTodoRules(sourceTodoId, [
    {
      triggerType: 'todo.completed',
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
    },
  ]);

  return { todos, habits, engineModule, sourceTodoId, targetHabitId };
}

async function crashPostCommitDispatch(
  engineModule: typeof import('@/core/linked-actions/linkedActions.engine'),
) {
  const spy = vi.spyOn(engineModule.linkedActionsEngine, 'processSourceAction');
  spy.mockImplementation(async () => {
    throw new Error('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('crash between source commit and dispatch (in-app todo path)', () => {
  it('leaves the durable event row on disk with the source write, and no effect', async () => {
    const db = await freshDatabase();
    const { todos, engineModule, sourceTodoId } = await createTodoHabitIncrementCycle(db);
    const crash = await crashPostCommitDispatch(engineModule);
    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;

    await expect(todos.toggleTodo(source)).rejects.toThrow('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');

    // The authoritative source write committed.
    const todoRow = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM todos WHERE id = ?',
      [sourceTodoId],
    );
    expect(todoRow?.completed).toBe(1);

    // The durable dispatch handoff persisted the source event atomically.
    const events = await db.getAllAsync<{ source_entity_id: string; trigger_type: string }>(
      'SELECT source_entity_id, trigger_type FROM linked_action_events',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source_entity_id: sourceTodoId,
      trigger_type: 'todo.completed',
    });

    // No effect ever ran: no execution, no produced completion.
    const executions = await db.getAllAsync('SELECT * FROM linked_action_executions');
    expect(executions).toHaveLength(0);

    crash.mockRestore();
    await db.closeAsync();
  });

  it('startup recovery applies the missed effect exactly once, and repeats are no-ops', async () => {
    const db = await freshDatabase();
    const { todos, engineModule, sourceTodoId, targetHabitId } =
      await createTodoHabitIncrementCycle(db);
    const crash = await crashPostCommitDispatch(engineModule);
    const source = (await todos.listTodos()).find((t) => t.id === sourceTodoId)!;
    await expect(todos.toggleTodo(source)).rejects.toThrow('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
    crash.mockRestore();

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1, skippedEvents: 0, failedEvents: 0 });

    const completions = await db.getAllAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ?',
      [targetHabitId],
    );
    expect(completions).toHaveLength(1);
    expect(completions[0].count).toBe(1);

    const executions = await db.getAllAsync<{ status: string; source_event_id: string }>(
      'SELECT status, source_event_id FROM linked_action_executions',
    );
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({ status: 'applied' });

    // Terminal execution now marks the event consumed.
    const events = await db.getAllAsync<{ source_entity_id: string }>(
      'SELECT source_entity_id FROM linked_action_events',
    );
    expect(events).toHaveLength(1);

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });

    const completionsAfterRepeat = await db.getAllAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ?',
      [targetHabitId],
    );
    expect(completionsAfterRepeat).toHaveLength(1);

    await db.closeAsync();
  });
});

describe('crash between habit threshold crossing and dispatch (in-app habit path)', () => {
  it('persists the event atomically with the crossing completion and recovery applies the chained effect once', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const targetTodoId = await todos.addTodo({ title: 'Stretch after workout' });
    const sourceHabitId = await habits.addHabit('Morning run', 1);

    await saveHabitRules(sourceHabitId, [
      {
        triggerType: 'habit.completed_for_day',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetTodoId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);

    const crash = await crashPostCommitDispatch(engineModule);
    await expect(habits.incrementHabit(sourceHabitId)).rejects.toThrow(
      'SIMULATED_CRASH_AFTER_SOURCE_COMMIT',
    );
    crash.mockRestore();

    // The crossing increment committed; only its dispatch crashed after commit.
    const completion = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ?',
      [sourceHabitId],
    );
    expect(completion?.count).toBe(1);

    // Durable handoff: the source event row exists with no execution.
    const events = await db.getAllAsync<{ source_entity_id: string; trigger_type: string }>(
      'SELECT source_entity_id, trigger_type FROM linked_action_events',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      source_entity_id: sourceHabitId,
      trigger_type: 'habit.completed_for_day',
    });
    expect(await db.getAllAsync('SELECT * FROM linked_action_executions')).toHaveLength(0);

    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    const first = await recovery.recoverPendingLinkedActions();
    expect(first).toMatchObject({ replayedEvents: 1 });

    const targetTodo = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM todos WHERE id = ?',
      [targetTodoId],
    );
    expect(targetTodo?.completed).toBe(1);

    const executions = await db.getAllAsync<{ status: string }>(
      'SELECT status FROM linked_action_executions',
    );
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({ status: 'applied' });

    const second = await recovery.recoverPendingLinkedActions();
    expect(second).toMatchObject({ replayedEvents: 0, skippedEvents: 0, failedEvents: 0 });

    await db.closeAsync();
  });
});

describe('crash between notification marker commit and dispatch', () => {
  it('persists the event with the marker transaction and recovery dispatches exactly once', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');
    const engineModule = await import('@/core/linked-actions/linkedActions.engine');

    const targetTodoId = await todos.addTodo({ title: 'Log the session' });
    const sourceHabitId = await habits.addHabit('Evening wind-down', 1);

    await saveHabitRules(sourceHabitId, [
      {
        triggerType: 'habit.completed_for_day',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetTodoId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);

    const crash = await crashPostCommitDispatch(engineModule);
    await expect(
      habits.completeHabitFromNotification({
        habitId: sourceHabitId,
        dateKey: toDateKey(),
        actionKey: 'habit-reminder:mark_complete:test-occurrence',
        occurrenceId: 'test-occurrence',
      }),
    ).rejects.toThrow('SIMULATED_CRASH_AFTER_SOURCE_COMMIT');
    crash.mockRestore();

    // Marker + completion + durable event all committed in one transaction.
    const marker = await db.getFirstAsync<{
      linked_action_required: number;
      linked_event_id: string;
    }>('SELECT linked_action_required, linked_event_id FROM processed_notification_actions');
    expect(marker?.linked_action_required).toBe(1);
    const completion = await db.getFirstAsync<{ count: number }>(
      'SELECT count FROM habit_completions WHERE habit_id = ?',
      [sourceHabitId],
    );
    expect(completion?.count).toBe(1);
    const events = await db.getAllAsync<{ id: string; source_entity_id: string }>(
      'SELECT id, source_entity_id FROM linked_action_events',
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: marker?.linked_event_id,
      source_entity_id: sourceHabitId,
    });
    expect(await db.getAllAsync('SELECT * FROM linked_action_executions')).toHaveLength(0);

    // Startup recovery (no notification re-tap) dispatches the effect once.
    const recovery = await import('@/core/linked-actions/linkedActions.recovery');
    await recovery.recoverPendingLinkedActions();
    const targetTodo = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM todos WHERE id = ?',
      [targetTodoId],
    );
    expect(targetTodo?.completed).toBe(1);
    expect(await db.getAllAsync('SELECT * FROM linked_action_executions')).toHaveLength(1);

    await db.closeAsync();
  });
});
