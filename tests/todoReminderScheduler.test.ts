import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

/**
 * Date-only `due_date` handling (audit C #1, CRITICAL).
 *
 * A todo's `due_date` is a LOCAL CALENDAR KEY (`toDateKey()` → `YYYY-MM-DD`),
 * never an instant. Before this fix the bridge handed that key to
 * `new Date(...)`, which ECMA-262 parses as UTC midnight. Two silent failures
 * followed, and both are pinned below against the LOCAL wall clock:
 *
 *  - UTC+8 (Asia/Manila): the key became 08:00 local, so a due-today todo
 *    reminded at 08:00 instead of at the documented local reminder time, and
 *    turning reminders on later that morning (e.g. 10:00) hit
 *    `computeTodoReminderFireAt → null` and the scheduler *cancelled* the
 *    reminder as `past-due` — the day had no reminder at all.
 *  - UTC-5 (America/New_York): the key became 19:00 the PREVIOUS evening.
 *
 * Node re-reads `process.env.TZ` per Date operation, so forcing the zone here
 * really does move the local calendar; each block first asserts the offset so
 * a zone-less runner cannot silently pass.
 */
describe('date-only due_date resolves to the local calendar day (audit C #1)', () => {
  const previousTz = process.env.TZ;

  afterEach(() => {
    vi.useRealTimers();
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  function localFireAt() {
    expect(scheduleTodoReminderNotification).toHaveBeenCalledTimes(1);
    return scheduleTodoReminderNotification.mock.calls[0][0].fireAt as Date;
  }

  it('UTC+8: a due-today todo fires at 09:00 local, not at UTC midnight (08:00)', async () => {
    process.env.TZ = 'Asia/Manila';
    // Prove the forced zone really is UTC+8 (Node re-reads TZ per operation).
    expect(new Date(2026, 2, 4, 12).getTimezoneOffset()).toBe(-480);

    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 4, 7, 0, 0, 0));

    const result = await syncTodoDueReminder(snapshot({ dueDate: '2026-03-04' }));

    expect(result.status).toBe('scheduled');
    // 09:00 LOCAL on the due calendar day — the pre-fix UTC parse answered
    // 08:00 local, three hours before the workday and one hour early here.
    expect(localFireAt().getHours()).toBe(9);
    expect(localFireAt().getDate()).toBe(4);
    expect(localFireAt().getTime()).toBe(new Date(2026, 2, 4, 9, 0, 0, 0).getTime());
    expect(cancelTodoReminderNotification).not.toHaveBeenCalled();
  });

  it('UTC+8: the past-due boundary is the LOCAL reminder time, not UTC midnight', async () => {
    process.env.TZ = 'Asia/Manila';
    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();

    // 08:30 local is AFTER the pre-fix UTC instant (08:00 local, i.e. 00:00Z)
    // but BEFORE the 09:00 local reminder time: the reminder must still be
    // schedulable, which the UTC parse could not do.
    vi.setSystemTime(new Date(2026, 2, 4, 8, 30, 0, 0));
    await expect(syncTodoDueReminder(snapshot({ dueDate: '2026-03-04' }))).resolves.toMatchObject({
      status: 'scheduled',
    });

    // 09:01 local is genuinely past the reminder time, so the documented
    // no-retroactive-fire rule applies (skip + cancel), exactly as for an
    // explicit ISO instant that already passed.
    scheduleTodoReminderNotification.mockClear();
    cancelTodoReminderNotification.mockClear();
    vi.setSystemTime(new Date(2026, 2, 4, 9, 1, 0, 0));
    await expect(syncTodoDueReminder(snapshot({ dueDate: '2026-03-04' }))).resolves.toMatchObject({
      status: 'skipped',
      reason: 'past-due',
    });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
    expect(cancelTodoReminderNotification).toHaveBeenCalledTimes(2);
  });

  it('UTC-5: a tomorrow-due todo fires tomorrow morning, never the previous evening', async () => {
    process.env.TZ = 'America/New_York';
    expect(new Date(2026, 2, 4, 12).getTimezoneOffset()).toBe(300); // EST, UTC-5

    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 4, 20, 0, 0, 0));

    await syncTodoDueReminder(snapshot({ dueDate: '2026-03-05' }));

    const fireAt = localFireAt();
    expect(fireAt.getDate()).toBe(5); // NOT Mar 4 19:00, the pre-fix answer
    expect(fireAt.getHours()).toBe(9);
    expect(fireAt.getTime()).toBe(new Date(2026, 2, 5, 9, 0, 0, 0).getTime());
  });

  it('a stale leadMinutes is applied to the local due moment, not to UTC midnight', async () => {
    process.env.TZ = 'Asia/Manila';
    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 4, 6, 0, 0, 0));

    await syncTodoDueReminder(snapshot({ dueDate: '2026-03-04', leadMinutes: 30 }));

    // 09:00 local minus 30 minutes.
    expect(localFireAt().getTime()).toBe(new Date(2026, 2, 4, 8, 30, 0, 0).getTime());
  });

  it('a genuinely past date key still skips scheduling (no retroactive fire)', async () => {
    process.env.TZ = 'Asia/Manila';
    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 6, 12, 0, 0, 0));

    await expect(syncTodoDueReminder(snapshot({ dueDate: '2026-03-04' }))).resolves.toMatchObject({
      status: 'skipped',
      reason: 'past-due',
    });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
  });

  it('rejects an impossible date key instead of parsing it loosely', async () => {
    await setTodoRemindersEnabled(true);
    await expect(syncTodoDueReminder(snapshot({ dueDate: '2026-02-30' }))).resolves.toMatchObject({
      status: 'skipped',
      reason: 'missing-due',
    });
    expect(scheduleTodoReminderNotification).not.toHaveBeenCalled();
  });

  it('still accepts an explicit ISO instant (due-moment snapshots are unchanged)', async () => {
    await setTodoRemindersEnabled(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 4, 7, 0, 0, 0));

    await syncTodoDueReminder(snapshot({ dueDate: '2026-03-04T09:30:00.000Z' }));

    expect(localFireAt().getTime()).toBe(new Date('2026-03-04T09:30:00.000Z').getTime());
  });
});
