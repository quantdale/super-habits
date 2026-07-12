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
    const getPermissionsAsync = vi.fn().mockResolvedValue({ status: 'granted' });
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
