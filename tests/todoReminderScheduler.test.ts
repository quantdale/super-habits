import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetNotificationPreferenceCaches,
  setTodoRemindersEnabled,
} from '@/core/notifications/notificationPreferences';
import {
  cancelTodoDueReminder,
  syncTodoDueReminder,
  TODO_REMINDER_BODY,
} from '@/core/notifications/todoReminderScheduler';
import {
  todoReminderIdentifier,
  getTodoReminderSnoozeIdentifier,
} from '@/core/notifications/reminderPlanning';
import { TODO_REMINDER_DATA_KIND, TODO_REMINDER_DATA_VERSION } from '@/lib/notificationConstants';

const scheduleTodoReminderNotification = vi.fn();
const cancelTodoReminderNotification = vi.fn();

vi.mock('@/lib/notifications', () => ({
  scheduleTodoReminderNotification: (...args: unknown[]) =>
    scheduleTodoReminderNotification(...args),
  cancelTodoReminderNotification: (...args: unknown[]) => cancelTodoReminderNotification(...args),
  getNotificationPermissionState: vi.fn(async () => 'granted'),
  ensureTodoReminderChannel: vi.fn(async () => undefined),
  listScheduledNotifications: vi.fn(async () => []),
}));

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

const FUTURE_DUE = '2027-03-01T09:30:00.000Z';

function snapshot(overrides: Partial<Parameters<typeof syncTodoDueReminder>[0]> = {}) {
  return { id: 'todo_1', title: 'Laundry', dueDate: FUTURE_DUE, completedAt: null, ...overrides };
}

beforeEach(() => {
  scheduleTodoReminderNotification.mockReset();
  scheduleTodoReminderNotification.mockResolvedValue('notif-id');
  cancelTodoReminderNotification.mockReset();
  cancelTodoReminderNotification.mockResolvedValue(undefined);
  asyncStorage.clear();
  resetNotificationPreferenceCaches();
});

describe('syncTodoDueReminder matrix', () => {
  it('skips todos without a due date', async () => {
    await expect(syncTodoDueReminder(snapshot({ dueDate: '' }))).resolves.toMatchObject({
      status: 'skipped',
      reason: 'missing-due',
    });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
    expect(cancelTodoReminderNotification).not.toHaveBeenCalled();
  });

  it('cancels both identifiers when the todo is completed', async () => {
    await expect(
      syncTodoDueReminder(snapshot({ completedAt: '2026-08-12T00:00:00.000Z' })),
    ).resolves.toMatchObject({ status: 'cancelled' });
    expect(cancelTodoReminderNotification).toHaveBeenCalledWith(todoReminderIdentifier('todo_1'));
    expect(cancelTodoReminderNotification).toHaveBeenCalledWith(
      getTodoReminderSnoozeIdentifier('todo_1'),
    );
  });

  it('cancels stale reminders while the preference is disabled', async () => {
    await setTodoRemindersEnabled(false);
    await expect(syncTodoDueReminder(snapshot())).resolves.toMatchObject({
      status: 'skipped',
      reason: 'disabled',
    });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
    expect(cancelTodoReminderNotification).toHaveBeenCalledTimes(2);
  });

  it('cancels past-due reminders instead of scheduling retroactively', async () => {
    await setTodoRemindersEnabled(true);
    await expect(
      syncTodoDueReminder(snapshot({ dueDate: '2001-01-01T09:00:00.000Z' })),
    ).resolves.toMatchObject({ status: 'skipped', reason: 'past-due' });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
    expect(cancelTodoReminderNotification).toHaveBeenCalledTimes(2);
  });

  it('schedules a payload carrying kind/version/todoId/occurrenceId/dueAt/snoozed', async () => {
    await setTodoRemindersEnabled(true);
    const result = await syncTodoDueReminder(snapshot());

    expect(result.status).toBe('scheduled');
    expect(scheduleTodoReminderNotification).toHaveBeenCalledTimes(1);
    const input = scheduleTodoReminderNotification.mock.calls[0][0];
    const fireAtMs = new Date(FUTURE_DUE).getTime();
    expect(input.identifier).toBe(todoReminderIdentifier('todo_1'));
    expect(input.body).toBe(TODO_REMINDER_BODY);
    expect(input.data).toEqual({
      kind: TODO_REMINDER_DATA_KIND,
      version: TODO_REMINDER_DATA_VERSION,
      todoId: 'todo_1',
      occurrenceId: `${todoReminderIdentifier('todo_1')}:${fireAtMs}`,
      dueAt: new Date(fireAtMs).toISOString(),
      snoozed: false,
    });
    expect(input.fireAt.getTime()).toBe(fireAtMs);
  });

  it('reschedules under the stable identifier when the due moment changes', async () => {
    await setTodoRemindersEnabled(true);
    await syncTodoDueReminder(snapshot());
    await syncTodoDueReminder(snapshot({ dueDate: '2027-06-01T10:00:00.000Z' }));

    expect(scheduleTodoReminderNotification).toHaveBeenCalledTimes(2);
    const first = scheduleTodoReminderNotification.mock.calls[0][0];
    const second = scheduleTodoReminderNotification.mock.calls[1][0];
    expect(first.identifier).toBe(second.identifier);
    expect(first.data.occurrenceId).not.toBe(second.data.occurrenceId);
  });

  it('reports permission denial as permission-denied, not web (audit F5)', async () => {
    await setTodoRemindersEnabled(true);
    scheduleTodoReminderNotification.mockResolvedValue('permission-denied');
    await expect(syncTodoDueReminder(snapshot())).resolves.toMatchObject({
      status: 'skipped',
      reason: 'permission-denied',
    });
  });

  it('reports web as skipped/web without touching native calls', async () => {
    vi.resetModules();
    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
        select: (obj: Record<string, unknown>) => obj['web'] ?? obj['default'],
      },
    }));
    try {
      const webScheduler = await import('@/core/notifications/todoReminderScheduler');
      await expect(webScheduler.syncTodoDueReminder(snapshot())).resolves.toMatchObject({
        status: 'skipped',
        reason: 'web',
      });
      expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('react-native');
      vi.resetModules();
    }
  });
});

describe('cancelTodoDueReminder (audit F4)', () => {
  it('cancels BOTH the base and the snooze identifiers', async () => {
    await cancelTodoDueReminder('todo_9');
    expect(cancelTodoReminderNotification).toHaveBeenCalledTimes(2);
    expect(cancelTodoReminderNotification).toHaveBeenCalledWith(todoReminderIdentifier('todo_9'));
    expect(cancelTodoReminderNotification).toHaveBeenCalledWith(
      getTodoReminderSnoozeIdentifier('todo_9'),
    );
  });
});
