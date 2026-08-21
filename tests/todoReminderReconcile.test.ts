import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationRequest } from 'expo-notifications';
import {
  reconcileTodoReminders,
  TODO_REMINDER_BODY,
  type TodoReminderNativeAdapter,
  type TodoReminderSnapshot,
} from '@/core/notifications/todoReminderScheduler';
import {
  getTodoReminderSnoozeIdentifier,
  todoReminderIdentifier,
} from '@/core/notifications/reminderPlanning';
import {
  resetNotificationPreferenceCaches,
  setTodoRemindersEnabled,
} from '@/core/notifications/notificationPreferences';

const asyncStorage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => asyncStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      asyncStorage.set(key, value);
    },
    removeItem: async (key: string) => {
      asyncStorage.delete(key);
    },
  },
}));

const NOW = new Date(2026, 7, 12, 12, 0, 0, 0);
const DUE_MS = new Date(2026, 7, 12, 18, 0, 0).getTime();

function todoRequest(
  todoId: string,
  fireAtMs: number,
  overrides: Record<string, unknown> = {},
): NotificationRequest {
  return {
    identifier: todoReminderIdentifier(todoId),
    content: {
      data: {
        kind: 'todo-reminder',
        version: 1,
        todoId,
        occurrenceId: `${todoReminderIdentifier(todoId)}:${fireAtMs}`,
        dueAt: new Date(fireAtMs).toISOString(),
        snoozed: false,
        ...overrides,
      },
    },
    trigger: { type: 'date', date: fireAtMs },
  } as unknown as NotificationRequest;
}

function snoozeRequest(todoId: string, fireAtMs: number): NotificationRequest {
  return {
    identifier: getTodoReminderSnoozeIdentifier(todoId),
    content: {
      data: {
        kind: 'todo-reminder',
        version: 1,
        todoId,
        occurrenceId: `${todoReminderIdentifier(todoId)}:${DUE_MS}`,
        dueAt: new Date(fireAtMs).toISOString(),
        snoozed: true,
      },
    },
    trigger: { type: 'date', date: fireAtMs },
  } as unknown as NotificationRequest;
}

function habitRequest(): NotificationRequest {
  return {
    identifier: 'habit-reminder:habit_1:2026-08-12',
    content: { data: { kind: 'habit-reminder', version: 2, habitId: 'habit_1' } },
    trigger: { type: 'date', date: DUE_MS + 1000 },
  } as unknown as NotificationRequest;
}

function dailyPlanRequest(): NotificationRequest {
  return {
    identifier: 'daily-plan-reminder:daily',
    content: { data: { kind: 'daily-plan-reminder', version: 1 } },
    trigger: { type: 'daily', hour: 8, minute: 0 },
  } as unknown as NotificationRequest;
}

type Harness = {
  adapter: TodoReminderNativeAdapter;
  scheduled: {
    identifier: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    fireAt: Date;
  }[];
  cancelled: string[];
};

function harness(
  requests: NotificationRequest[],
  permission: 'granted' | 'denied' | 'unsupported' = 'granted',
): Harness {
  const scheduled: Harness['scheduled'] = [];
  const cancelled: string[] = [];
  const live = [...requests];
  const adapter: TodoReminderNativeAdapter = {
    getPermissionState: vi.fn(async () => permission),
    ensureChannel: vi.fn(async () => undefined),
    listScheduled: vi.fn(async () => live),
    schedule: vi.fn(async (item) => {
      scheduled.push(item);
      return item.identifier;
    }),
    cancel: vi.fn(async (identifier: string) => {
      cancelled.push(identifier);
      const index = live.findIndex((request) => request.identifier === identifier);
      if (index >= 0) live.splice(index, 1);
    }),
  };
  return { adapter, scheduled, cancelled };
}

const pendingTodo = (id: string): TodoReminderSnapshot => ({
  id,
  title: `Todo ${id}`,
  dueDate: new Date(DUE_MS).toISOString(),
  completedAt: null,
});

beforeEach(() => {
  asyncStorage.clear();
  resetNotificationPreferenceCaches();
});

describe('reconcileTodoReminders', () => {
  it('toggle-off cancels every todo-reminder request and never touches other namespaces', async () => {
    await setTodoRemindersEnabled(false);
    const env = harness([
      todoRequest('todo_1', DUE_MS),
      todoRequest('todo_2', DUE_MS + 5),
      habitRequest(),
      dailyPlanRequest(),
    ]);

    const result = await reconcileTodoReminders({ now: NOW, adapter: env.adapter });

    expect(result).toMatchObject({ status: 'reconciled', scheduled: 0, cancelled: 2 });
    expect(env.cancelled.sort()).toEqual([
      todoReminderIdentifier('todo_1'),
      todoReminderIdentifier('todo_2'),
    ]);
    expect(env.cancelled).not.toContain('habit-reminder:habit_1:2026-08-12');
    expect(env.cancelled).not.toContain('daily-plan-reminder:daily');
  });

  it('permission denial cancels inventory and reports permission_denied without scheduling', async () => {
    await setTodoRemindersEnabled(true);
    const env = harness([todoRequest('todo_1', DUE_MS)], 'denied');

    const result = await reconcileTodoReminders({ now: NOW, adapter: env.adapter });

    expect(result).toMatchObject({ status: 'permission_denied', scheduled: 0, cancelled: 1 });
    expect(env.scheduled).toHaveLength(0);
  });

  it('unsupported permission reports unsupported', async () => {
    await setTodoRemindersEnabled(true);
    const env = harness([], 'unsupported');
    const result = await reconcileTodoReminders({ now: NOW, adapter: env.adapter });
    expect(result.status).toBe('unsupported');
  });

  it('toggle-on schedules pending due todos and preserves correct live requests', async () => {
    await setTodoRemindersEnabled(true);
    const correct = todoRequest('todo_kept', DUE_MS);
    const env = harness([correct]);

    const result = await reconcileTodoReminders({
      now: NOW,
      adapter: env.adapter,
      loadTodos: async () => [pendingTodo('todo_kept'), pendingTodo('todo_new')],
    });

    expect(result).toMatchObject({ status: 'reconciled', scheduled: 1 });
    expect(env.cancelled).toHaveLength(0);
    expect(env.scheduled[0].identifier).toBe(todoReminderIdentifier('todo_new'));
    expect(env.scheduled[0].data.occurrenceId).toBe(
      `${todoReminderIdentifier('todo_new')}:${DUE_MS}`,
    );
    expect(env.scheduled[0].body).toBe(TODO_REMINDER_BODY);
  });

  it('reschedules a stale fire time after the due moment was edited', async () => {
    await setTodoRemindersEnabled(true);
    const stale = todoRequest('todo_1', DUE_MS - 60_000);
    const env = harness([stale]);

    const result = await reconcileTodoReminders({
      now: NOW,
      adapter: env.adapter,
      loadTodos: async () => [pendingTodo('todo_1')],
    });

    expect(result).toMatchObject({ status: 'reconciled', scheduled: 1, cancelled: 1 });
    expect(env.cancelled).toContain(stale.identifier);
    expect(env.scheduled[0].data.occurrenceId).toBe(
      `${todoReminderIdentifier('todo_1')}:${DUE_MS}`,
    );
  });

  it('cancels restore-shaped reminders for todos that no longer exist', async () => {
    await setTodoRemindersEnabled(true);
    const env = harness([
      todoRequest('todo_ghost', DUE_MS),
      snoozeRequest('todo_ghost', DUE_MS + 15 * 60_000),
    ]);

    const result = await reconcileTodoReminders({
      now: NOW,
      adapter: env.adapter,
      loadTodos: async () => [],
    });

    expect(result).toMatchObject({ status: 'reconciled', scheduled: 0, cancelled: 2 });
    expect(env.scheduled).toHaveLength(0);
  });

  it('keeps one valid snooze for a pending todo and cancels completed-todo snoozes', async () => {
    await setTodoRemindersEnabled(true);
    const liveSnooze = snoozeRequest('todo_pending', DUE_MS + 15 * 60_000);
    const deadSnooze = snoozeRequest('todo_done', DUE_MS + 15 * 60_000);
    const env = harness([liveSnooze, deadSnooze]);

    const result = await reconcileTodoReminders({
      now: NOW,
      adapter: env.adapter,
      loadTodos: async () => [
        pendingTodo('todo_pending'),
        {
          id: 'todo_done',
          title: 'Done',
          dueDate: new Date(DUE_MS).toISOString(),
          completedAt: '2026-08-12T10:00:00.000Z',
        },
      ],
    });

    // The pending todo's missing base reminder is also (re)scheduled.
    expect(result).toMatchObject({ status: 'reconciled', scheduled: 1, cancelled: 1 });
    expect(env.scheduled[0].identifier).toBe(todoReminderIdentifier('todo_pending'));
    expect(env.cancelled).toContain(deadSnooze.identifier);
    expect(env.cancelled).not.toContain(liveSnooze.identifier);
  });

  it('skips completed and past-due todos when computing the desired plan', async () => {
    await setTodoRemindersEnabled(true);
    const env = harness([]);
    const result = await reconcileTodoReminders({
      now: NOW,
      adapter: env.adapter,
      loadTodos: async () => [
        {
          id: 'todo_done',
          title: 'Done',
          dueDate: new Date(DUE_MS).toISOString(),
          completedAt: 'x',
        },
        { id: 'todo_past', title: 'Past', dueDate: '2001-01-01T09:00:00.000Z', completedAt: null },
        { id: 'todo_nodue', title: 'No due', dueDate: '', completedAt: null },
      ],
    });
    expect(result).toMatchObject({ status: 'reconciled', scheduled: 0, cancelled: 0 });
    expect(env.scheduled).toHaveLength(0);
  });
});
