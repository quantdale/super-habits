import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetNotificationPreferenceCaches,
  setWeeklyReviewReminder,
} from '@/core/notifications/notificationPreferences';
import {
  syncWeeklyReviewReminder,
  WEEKLY_REVIEW_REMINDER_IDENTIFIER,
} from '@/core/notifications/weeklyReviewReminderScheduler';

const scheduleWeeklyReviewReminderNotification = vi.fn();
const cancelScheduledNotification = vi.fn();

vi.mock('@/lib/notifications', () => ({
  scheduleWeeklyReviewReminderNotification: (...args: unknown[]) =>
    scheduleWeeklyReviewReminderNotification(...args),
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
  scheduleWeeklyReviewReminderNotification.mockReset();
  scheduleWeeklyReviewReminderNotification.mockResolvedValue('weekly-notif-id');
  cancelScheduledNotification.mockReset();
  cancelScheduledNotification.mockResolvedValue(undefined);
  asyncStorage.clear();
  resetNotificationPreferenceCaches();
});

describe('syncWeeklyReviewReminder', () => {
  it('cancels the fixed reminder while the preference is disabled', async () => {
    await setWeeklyReviewReminder({ enabled: false, weekday: 0, hour: 18, minute: 0 });

    await expect(syncWeeklyReviewReminder()).resolves.toMatchObject({ status: 'cancelled' });
    expect(cancelScheduledNotification).toHaveBeenCalledWith(WEEKLY_REVIEW_REMINDER_IDENTIFIER);
    expect(scheduleWeeklyReviewReminderNotification).not.toHaveBeenCalled();
  });

  it('schedules the stored weekday and wall-clock time', async () => {
    await setWeeklyReviewReminder({ enabled: true, weekday: 5, hour: 17, minute: 45 });

    await expect(syncWeeklyReviewReminder()).resolves.toEqual({
      status: 'scheduled',
      identifier: 'weekly-notif-id',
      weekday: 5,
      hour: 17,
      minute: 45,
    });
    expect(cancelScheduledNotification).toHaveBeenCalledWith(WEEKLY_REVIEW_REMINDER_IDENTIFIER);
    expect(scheduleWeeklyReviewReminderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: WEEKLY_REVIEW_REMINDER_IDENTIFIER,
        jsWeekday: 5,
        hour: 17,
        minute: 45,
        data: { kind: 'weekly-review-reminder', version: 1 },
      }),
    );
  });

  it('reports native permission denial without claiming it scheduled', async () => {
    await setWeeklyReviewReminder({ enabled: true, weekday: 2, hour: 8, minute: 30 });
    scheduleWeeklyReviewReminderNotification.mockResolvedValue('permission-denied');

    await expect(syncWeeklyReviewReminder()).resolves.toEqual({
      status: 'skipped',
      reason: 'permission-denied',
    });
  });

  it('reports web as skipped without touching native scheduling', async () => {
    vi.resetModules();
    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'web',
        select: (obj: Record<string, unknown>) => obj['web'] ?? obj['default'],
      },
    }));
    try {
      const webScheduler = await import('@/core/notifications/weeklyReviewReminderScheduler');
      await expect(webScheduler.syncWeeklyReviewReminder()).resolves.toEqual({
        status: 'skipped',
        reason: 'web',
      });
      expect(scheduleWeeklyReviewReminderNotification).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('react-native');
      vi.resetModules();
    }
  });
});
