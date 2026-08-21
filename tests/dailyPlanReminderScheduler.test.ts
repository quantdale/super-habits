import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetNotificationPreferenceCaches,
  setTodoRemindersEnabled,
} from '@/core/notifications/notificationPreferences';
import { syncDailyPlanReminder } from '@/core/notifications/dailyPlanReminderScheduler';
import { DAILY_PLAN_REMINDER_IDENTIFIER } from '@/core/notifications/reminderPlanning';

const scheduleDailyPlanReminderNotification = vi.fn();
const cancelScheduledNotification = vi.fn();

vi.mock('@/lib/notifications', () => ({
  scheduleDailyPlanReminderNotification: (...args: unknown[]) =>
    scheduleDailyPlanReminderNotification(...args),
  cancelScheduledNotification: (...args: unknown[]) => cancelScheduledNotification(...args),
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

beforeEach(() => {
  scheduleDailyPlanReminderNotification.mockReset();
  scheduleDailyPlanReminderNotification.mockResolvedValue('daily-notif-id');
  cancelScheduledNotification.mockReset();
  cancelScheduledNotification.mockResolvedValue(undefined);
  asyncStorage.clear();
  resetNotificationPreferenceCaches();
});

describe('syncDailyPlanReminder gating and honest outcomes', () => {
  it('cancels the repeating reminder while the master todo toggle is off (audit F6)', async () => {
    await setTodoRemindersEnabled(false);
    const result = await syncDailyPlanReminder();

    expect(result).toMatchObject({ status: 'cancelled' });
    expect(cancelScheduledNotification).toHaveBeenCalledWith(DAILY_PLAN_REMINDER_IDENTIFIER);
    expect(scheduleDailyPlanReminderNotification).not.toHaveBeenCalled();
  });

  it('schedules at the stored time when enabled and permission is granted', async () => {
    await setTodoRemindersEnabled(true);
    const result = await syncDailyPlanReminder();

    expect(result).toMatchObject({
      status: 'scheduled',
      identifier: 'daily-notif-id',
      hour: 8,
      minute: 0,
    });
    expect(scheduleDailyPlanReminderNotification).toHaveBeenCalledTimes(1);
    expect(scheduleDailyPlanReminderNotification.mock.calls[0][0].identifier).toBe(
      DAILY_PLAN_REMINDER_IDENTIFIER,
    );
  });

  it('propagates native permission denial as skipped/permission-denied (audit F5)', async () => {
    await setTodoRemindersEnabled(true);
    scheduleDailyPlanReminderNotification.mockResolvedValue('permission-denied');
    await expect(syncDailyPlanReminder()).resolves.toMatchObject({
      status: 'skipped',
      reason: 'permission-denied',
    });
  });

  it('reports web as skipped/web without touching native calls', async () => {
    await setTodoRemindersEnabled(true);
    vi.resetModules();
    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
        select: (obj: Record<string, unknown>) => obj['web'] ?? obj['default'],
      },
    }));
    try {
      const webScheduler = await import('@/core/notifications/dailyPlanReminderScheduler');
      await expect(webScheduler.syncDailyPlanReminder()).resolves.toMatchObject({
        status: 'skipped',
        reason: 'web',
      });
      expect(scheduleDailyPlanReminderNotification).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('react-native');
      vi.resetModules();
    }
  });
});
