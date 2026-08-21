import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { toDateKey } from '@/lib/time';
import {
  getTodoReminderActionKey,
  todoReminderIdentifier,
} from '@/core/notifications/reminderPlanning';
import { TODO_REMINDER_MARK_DONE_ACTION } from '@/lib/notificationConstants';

const NOW = new Date(2026, 7, 12, 12, 0, 0, 0);

function actionInput(todoId: string, occurrenceSuffix = '1755000000000') {
  const occurrenceId = `${todoReminderIdentifier(todoId)}:${occurrenceSuffix}`;
  return {
    todoId,
    actionKey: getTodoReminderActionKey(occurrenceId, TODO_REMINDER_MARK_DONE_ACTION),
    occurrenceId,
  };
}

async function createTodo(
  todos: typeof import('@/features/todos/todos.data'),
  title = 'Laundry',
  overrides: Omit<Parameters<typeof todos.addTodo>[0], 'title'> = {},
) {
  return todos.addTodo({ ...overrides, title });
}

describe('todo reminder Mark done against real SQLite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes once and survives a concurrent duplicate response', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const todoId = await createTodo(todos);
    const input = actionInput(todoId);

    const results = await Promise.all([
      actions.completeTodoFromNotification({ ...input, now: NOW }),
      actions.completeTodoFromNotification({ ...input, now: NOW }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['applied', 'duplicate']);
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        todoId,
      ]),
    ).toMatchObject({ completed: 1 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM processed_notification_actions WHERE action_key = ?',
        [input.actionKey],
      ),
    ).toMatchObject({ n: 1 });
    await db.closeAsync();
  });

  type NoopPrepare = (
    todos: typeof import('@/features/todos/todos.data'),
    id: string,
  ) => Promise<void>;
  const missingPrepare: NoopPrepare = async () => undefined;
  const deletedPrepare: NoopPrepare = async (todos, id) => {
    await todos.removeTodo(id);
  };
  const completedPrepare: NoopPrepare = async (todos, id) => {
    await todos.completeTodo(id);
  };

  it.each([
    ['missing', missingPrepare, 'todo_missing', null],
    ['soft-deleted', deletedPrepare, null, 0],
    ['already-completed', completedPrepare, null, 1],
  ])('%s todo is a safe no-op', async (_label, prepare, fixedId, expectedCompleted) => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const todoId = fixedId ?? (await createTodo(todos));
    await prepare(todos, todoId);

    const result = await actions.completeTodoFromNotification({
      ...actionInput(todoId),
      now: NOW,
    });

    expect(result.status).toBe('noop');
    const row = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM todos WHERE id = ?',
      [todoId],
    );
    // Missing rows stay missing; present rows keep their pre-tap state —
    // the notification tap never mutates them.
    expect(row?.completed ?? null).toBe(expectedCompleted);
    await db.closeAsync();
  });

  it('replays safely after reopening the same database file', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-todo-reminder-'));
    const filename = path.join(dir, 'superhabits.db');
    try {
      const firstDb = await freshDatabase(filename);
      const firstTodos = await import('@/features/todos/todos.data');
      const actionsModule = await import('@/features/todos/todoNotificationActions.data');
      const todoId = await createTodo(firstTodos);
      const input = actionInput(todoId);
      const first = await actionsModule.completeTodoFromNotification({ ...input, now: NOW });
      expect(first.status).toBe('applied');
      await firstDb.closeAsync();

      const secondDb = await freshDatabase(filename);
      const secondActions = await import('@/features/todos/todoNotificationActions.data');
      const replay = await secondActions.completeTodoFromNotification({ ...input, now: NOW });

      expect(replay.status).toBe('duplicate');
      expect(
        await secondDb.getFirstAsync<{ completed: number }>(
          'SELECT completed FROM todos WHERE id = ?',
          [todoId],
        ),
      ).toMatchObject({ completed: 1 });
      await secondDb.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('runs a todo.completed Linked Action exactly once across response replay', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const sourceId = await createTodo(todos, 'Pack bags');
    const targetId = await createTodo(todos, 'Review packing list');
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

    const input = actionInput(sourceId);
    const first = await actions.completeTodoFromNotification({ ...input, now: NOW });
    const replay = await actions.completeTodoFromNotification({ ...input, now: NOW });

    expect(first.status).toBe('applied');
    expect(first.linkedActions.matchedRuleCount).toBe(1);
    expect(replay.status).toBe('duplicate');
    expect(replay.linkedActions.notices).toEqual([]);
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        targetId,
      ]),
    ).toMatchObject({ completed: 1 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM linked_action_executions WHERE source_event_id IN (SELECT id FROM linked_action_events WHERE source_entity_id = ?)',
        [sourceId],
      ),
    ).toMatchObject({ n: 1 });
    await db.closeAsync();
  });

  it('spawns tomorrow instance for a daily recurring todo instead of dispatching linked actions', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const todoId = await createTodo(todos, 'Water plants', { recurrence: 'daily' });
    const source = await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [todoId],
    );
    expect(source?.recurrence_id).toBeTruthy();

    const result = await actions.completeTodoFromNotification({
      ...actionInput(todoId),
      now: NOW,
    });

    expect(result.status).toBe('applied');
    expect(result.linkedActions.matchedRuleCount).toBe(0);
    const tomorrow = toDateKey(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    expect(
      await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM todos WHERE recurrence_id = ? AND due_date = ? AND deleted_at IS NULL',
        [source!.recurrence_id, tomorrow],
      ),
    ).not.toBeNull();
    await db.closeAsync();
  });

  it('keeps two todos isolated by ID', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const firstId = await createTodo(todos, 'First');
    const secondId = await createTodo(todos, 'Second');

    await actions.completeTodoFromNotification({
      ...actionInput(firstId),
      now: NOW,
    });

    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        firstId,
      ]),
    ).toMatchObject({ completed: 1 });
    expect(
      await db.getFirstAsync<{ completed: number }>('SELECT completed FROM todos WHERE id = ?', [
        secondId,
      ]),
    ).toMatchObject({ completed: 0 });
    await db.closeAsync();
  });
});

describe('todo reminder marker retention', () => {
  it('prunes old todo-reminder markers while retaining recent ones', async () => {
    const db = await freshDatabase();
    const { claimNotificationAction } = await import('@/features/habits/notificationActions.data');
    await db.runAsync(
      `INSERT INTO processed_notification_actions
       (action_key, kind, action_name, occurrence_id, linked_event_id, processed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'old-todo-key',
        'todo-reminder',
        'mark_done',
        'old-occurrence',
        'old-event',
        '2026-01-01T00:00:00.000Z',
      ],
    );
    await claimNotificationAction({
      actionKey: 'new-todo-key',
      kind: 'todo-reminder',
      actionName: 'mark_done',
      occurrenceId: 'new-occurrence',
      processedAt: new Date(2026, 7, 12, 12).toISOString(),
    });

    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM processed_notification_actions WHERE action_key = ?',
        ['old-todo-key'],
      ),
    ).toMatchObject({ n: 0 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM processed_notification_actions WHERE kind = ?',
        ['todo-reminder'],
      ),
    ).toMatchObject({ n: 1 });
    await db.closeAsync();
  });
});
