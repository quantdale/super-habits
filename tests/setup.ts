import { vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'] },
}));

vi.mock('expo-crypto', () => ({
  getRandomValues: vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      // Deterministic but non-repeating enough for test IDs
      array[i] = (i * 17 + 31) % 256;
    }
    return array;
  }),
}));

vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn().mockResolvedValue({ status: 'denied' }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ status: 'denied' }),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 5 },
  PermissionStatus: { GRANTED: 'granted' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn().mockResolvedValue({
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue(undefined),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
      await task();
    }),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  }),
}));

/** Avoid loading @react-native-async-storage via real `lib/supabase` when tests import sync.engine. */
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  setRemoteMode: vi.fn(),
  isRemoteEnabled: vi.fn(() => true),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));
