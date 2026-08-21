import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import {
  getTodoReminderActionKey,
  getTodoReminderSnoozeIdentifier,
  todoReminderIdentifier,
} from '@/core/notifications/reminderPlanning';
import { TODO_REMINDER_SNOOZE_ACTION } from '@/lib/notificationConstants';
import { snoozeTodoReminderAction } from '@/core/notifications/todoReminderActions';

const NOW = new Date(2026, 7, 12, 12, 0, 0, 0);
const DUE_ISO = '2026-08-12T18:00:00.000Z';
const DUE_MS = new Date(DUE_ISO).getTime();

type SnoozeAdapter = Parameters<typeof snoozeTodoReminderAction>[1];

async function createDueTodo(todos: typeof import('@/features/todos/todos.data')) {
  return todos.addTodo({ title: 'Laundry', dueDate: DUE_ISO });
}

function actionInput(todoId: string) {
  const occurrenceId = `${todoReminderIdentifier(todoId)}:${DUE_MS}`;
  return {
    todoId,
    occurrenceId,
    actionKey: getTodoReminderActionKey(occurrenceId, TODO_REMINDER_SNOOZE_ACTION),
  };
}

function adapter(
  db: TestDatabase,
  overrides: Partial<SnoozeAdapter> = {},
): SnoozeAdapter & {
  scheduled: { identifier: string; fireAt: Date; data: Record<string, unknown> }[];
  cancelled: string[];
} {
  const scheduled: { identifier: string; fireAt: Date; data: Record<string, unknown> }[] = [];
  const cancelled: string[] = [];
  const base: SnoozeAdapter = {
    getPermissionState: vi.fn(async () => 'granted' as const),
    ensureChannel: vi.fn(async () => undefined),
    listScheduled: vi.fn(async () =>
      scheduled.map(
        (item) =>
          ({
            identifier: item.identifier,
            content: { data: item.data },
            trigger: { type: 'date', date: item.fireAt.getTime() },
          }) as never,
      ),
    ),
    schedule: vi.fn(
      async (item: { identifier: string; fireAt: Date; data: Record<string, unknown> }) => {
        scheduled.push(item);
        return item.identifier;
      },
    ),
    cancel: vi.fn(async (identifier: string) => {
      cancelled.push(identifier);
      const index = scheduled.findIndex((item) => item.identifier === identifier);
      if (index >= 0) scheduled.splice(index, 1);
    }),
    loadTodo: vi.fn(async (todoId: string) =>
      db.getFirstAsync<{
        id: string;
        title: string;
        due_date: string | null;
        completed: 0 | 1;
        deleted_at: string | null;
      }>(
        `SELECT id, title, due_date, completed, deleted_at
         FROM todos
         WHERE id = ?
           AND deleted_at IS NULL`,
        [todoId],
      ),
    ),
    getRemindersEnabled: vi.fn(async () => true),
  };
  return { ...base, ...overrides, scheduled, cancelled };
}

describe('todo reminder Snooze against real SQLite', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = await freshDatabase();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.closeAsync();
  });

  it('schedules one fixed fifteen-minute replacement preserving the base occurrence', async () => {
    const todos = await import('@/features/todos/todos.data');
    const todoId = await createDueTodo(todos);
    const native = adapter(db);

    const result = await snoozeTodoReminderAction({ ...actionInput(todoId), now: NOW }, native);

    expect(result.status).toBe('scheduled');
    expect(native.scheduled).toHaveLength(1);
    expect(native.scheduled[0].identifier).toBe(getTodoReminderSnoozeIdentifier(todoId));
    expect(native.scheduled[0].fireAt.getTime() - NOW.getTime()).toBe(15 * 60 * 1000);
    expect(native.scheduled[0].data).toMatchObject({
      kind: 'todo-reminder',
      version: 1,
      todoId,
      occurrenceId: `${todoReminderIdentifier(todoId)}:${DUE_MS}`,
      snoozed: true,
    });
    // The base reminder is replaced by the snooze request.
    expect(native.cancelled).toContain(todoReminderIdentifier(todoId));
  });

  it('deduplicates a repeated tap into a single native request', async () => {
    const todos = await import('@/features/todos/todos.data');
    const todoId = await createDueTodo(todos);
    const native = adapter(db);
    const input = { ...actionInput(todoId), now: NOW };

    await snoozeTodoReminderAction(input, native);
    const replay = await snoozeTodoReminderAction(input, native);

    expect(replay.status).toBe('duplicate');
    expect(native.scheduled).toHaveLength(1);
  });

  it.each(['completed', 'deleted', 'disabled-preference'] as const)(
    '%s todo cannot snooze',
    async (state) => {
      const todos = await import('@/features/todos/todos.data');
      let todoId = await createDueTodo(todos);
      if (state === 'completed') await todos.completeTodo(todoId);
      if (state === 'deleted') await todos.removeTodo(todoId);
      const native = adapter(db);
      if (state === 'disabled-preference') {
        native.getRemindersEnabled = vi.fn(async () => false);
      }

      const result = await snoozeTodoReminderAction({ ...actionInput(todoId), now: NOW }, native);

      expect(result.status).toBe('noop');
      expect(native.scheduled).toHaveLength(0);
      expect(native.cancelled).toContain(todoReminderIdentifier(todoId));
      expect(native.cancelled).toContain(getTodoReminderSnoozeIdentifier(todoId));
    },
  );

  it('returns unsupported without throwing when permission is denied', async () => {
    const todos = await import('@/features/todos/todos.data');
    const todoId = await createDueTodo(todos);
    const native = adapter(db, {
      getPermissionState: vi.fn(async () => 'denied' as const),
    });

    const result = await snoozeTodoReminderAction({ ...actionInput(todoId), now: NOW }, native);

    expect(result.status).toBe('unsupported');
    expect(native.scheduled).toHaveLength(0);
  });

  it('allows a snooze that crosses local midnight (documented divergence from habits)', async () => {
    const todos = await import('@/features/todos/todos.data');
    const lateDue = '2026-08-12T23:50:00.000Z';
    const todoId = await todos.addTodo({ title: 'Late chore', dueDate: lateDue });
    const lateMs = new Date(lateDue).getTime();
    const native = adapter(db);
    const occurrenceId = `${todoReminderIdentifier(todoId)}:${lateMs}`;

    const result = await snoozeTodoReminderAction(
      {
        todoId,
        occurrenceId,
        actionKey: getTodoReminderActionKey(occurrenceId, TODO_REMINDER_SNOOZE_ACTION),
        now: new Date(2026, 7, 12, 23, 55, 0),
      },
      native,
    );

    expect(result.status).toBe('scheduled');
    expect(native.scheduled[0].fireAt).toEqual(new Date(2026, 7, 13, 0, 10, 0));
  });

  it('refuses a stale payload whose occurrence no longer matches the current due moment', async () => {
    const todos = await import('@/features/todos/todos.data');
    const todoId = await createDueTodo(todos);
    // The todo was edited to a new due moment after the notification shipped.
    await todos.updateTodo(todoId, { dueDate: '2026-08-14T10:00:00.000Z' });
    const native = adapter(db);

    const result = await snoozeTodoReminderAction({ ...actionInput(todoId), now: NOW }, native);

    expect(result.status).toBe('noop');
    expect(native.scheduled).toHaveLength(0);
  });
});

describe('snooze lifecycle cancellation (audit F4 regression guard)', () => {
  it('completing a todo cancels BOTH its base and snooze identifiers', async () => {
    const db = await freshDatabase();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const Notifications = await import('expo-notifications');
      const todos = await import('@/features/todos/todos.data');
      const todoId = await createDueTodo(todos);
      vi.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();

      await todos.completeTodo(todoId);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        todoReminderIdentifier(todoId),
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        getTodoReminderSnoozeIdentifier(todoId),
      );
    } finally {
      vi.useRealTimers();
      await db.closeAsync();
    }
  });

  it('deleting a todo cancels BOTH its base and snooze identifiers', async () => {
    const db = await freshDatabase();
    try {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const Notifications = await import('expo-notifications');
      const todos = await import('@/features/todos/todos.data');
      const todoId = await createDueTodo(todos);
      vi.mocked(Notifications.cancelScheduledNotificationAsync).mockClear();

      await todos.removeTodo(todoId);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        todoReminderIdentifier(todoId),
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
        getTodoReminderSnoozeIdentifier(todoId),
      );
    } finally {
      vi.useRealTimers();
      await db.closeAsync();
    }
  });
});
