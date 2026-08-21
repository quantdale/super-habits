import { describe, it, expect, vi } from 'vitest';
import * as notifications from '../lib/notifications';

describe('notifications error handling', () => {
  it('returns null for invalid/corrupt ID', async () => {
    await expect(notifications.cancelScheduledNotification(undefined)).resolves.toBeUndefined();
    await expect(notifications.cancelScheduledNotification(null)).resolves.toBeUndefined();
    // Simulate invalid ID
    await expect(notifications.cancelScheduledNotification('invalid-id')).resolves.toBeUndefined();
  });
});

describe('android notification channel (COR-007)', () => {
  it('creates the channel even when permission is already granted', async () => {
    vi.resetModules();
    const setNotificationChannelAsync = vi.fn().mockResolvedValue(undefined);
    const getPermissionsAsync = vi.fn().mockResolvedValue({ granted: true });
    const requestPermissionsAsync = vi.fn();

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: (obj: Record<string, unknown>) => obj['android'] ?? obj['default'],
      },
    }));
    vi.doMock('expo-notifications', () => ({
      setNotificationHandler: vi.fn(),
      getPermissionsAsync,
      requestPermissionsAsync,
      setNotificationChannelAsync,
      scheduleNotificationAsync: vi.fn(),
      cancelScheduledNotificationAsync: vi.fn(),
      AndroidImportance: { HIGH: 5 },
      PermissionStatus: { GRANTED: 'granted' },
      SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    }));

    try {
      const mod = await import('../lib/notifications');
      await expect(mod.ensureNotificationPermission()).resolves.toBe(true);

      // The old flow returned before creating the channel on pre-granted devices.
      expect(setNotificationChannelAsync).toHaveBeenCalledWith('default', {
        name: 'default',
        importance: 5,
      });
      expect(requestPermissionsAsync).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('react-native');
      vi.doUnmock('expo-notifications');
      vi.resetModules();
    }
  });
});

describe('habit reminder notification category', () => {
  it('registers one stable category with foregrounding Mark complete and Snooze actions', async () => {
    vi.resetModules();
    const setNotificationCategoryAsync = vi.fn().mockResolvedValue(undefined);
    const setNotificationChannelAsync = vi.fn().mockResolvedValue(undefined);

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: (obj: Record<string, unknown>) => obj['android'] ?? obj['default'],
      },
    }));
    vi.doMock('expo-notifications', () => ({
      setNotificationHandler: vi.fn(),
      setNotificationCategoryAsync,
      setNotificationChannelAsync,
      AndroidImportance: { DEFAULT: 3, HIGH: 5 },
      PermissionStatus: { GRANTED: 'granted' },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    }));

    try {
      const mod = await import('../lib/notifications');
      await mod.ensureHabitReminderChannel();

      expect(setNotificationCategoryAsync).toHaveBeenCalledWith('habitReminder', [
        expect.objectContaining({
          identifier: 'habit_reminder_mark_complete',
          buttonTitle: 'Mark complete',
          options: { opensAppToForeground: true },
        }),
        expect.objectContaining({
          identifier: 'habit_reminder_snooze',
          buttonTitle: 'Snooze',
          options: { opensAppToForeground: true },
        }),
      ]);
    } finally {
      vi.doUnmock('react-native');
      vi.doUnmock('expo-notifications');
      vi.resetModules();
    }
  });
});

describe('todo reminder notification category', () => {
  it('registers one stable category with foregrounding Mark done and Snooze actions', async () => {
    vi.resetModules();
    const setNotificationCategoryAsync = vi.fn().mockResolvedValue(undefined);
    const setNotificationChannelAsync = vi.fn().mockResolvedValue(undefined);

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: (obj: Record<string, unknown>) => obj['android'] ?? obj['default'],
      },
    }));
    vi.doMock('expo-notifications', () => ({
      setNotificationHandler: vi.fn(),
      setNotificationCategoryAsync,
      setNotificationChannelAsync,
      AndroidImportance: { DEFAULT: 3, HIGH: 5 },
      PermissionStatus: { GRANTED: 'granted' },
      SchedulableTriggerInputTypes: { DATE: 'date' },
    }));

    try {
      const mod = await import('../lib/notifications');
      await mod.ensureTodoReminderChannel();

      // The channel is created before the category so Android 13+ deliveries
      // land in the dedicated todo-reminders channel.
      expect(setNotificationChannelAsync).toHaveBeenCalledWith('todo-reminders', {
        name: 'Todo reminders',
        importance: 3,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250],
      });
      expect(setNotificationCategoryAsync).toHaveBeenCalledWith('todoReminder', [
        expect.objectContaining({
          identifier: 'todo_reminder_mark_done',
          buttonTitle: 'Mark done',
          options: { opensAppToForeground: true },
        }),
        expect.objectContaining({
          identifier: 'todo_reminder_snooze',
          buttonTitle: 'Snooze',
          options: { opensAppToForeground: true },
        }),
      ]);
    } finally {
      vi.doUnmock('react-native');
      vi.doUnmock('expo-notifications');
      vi.resetModules();
    }
  });
});
