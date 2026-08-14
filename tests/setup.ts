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
  setNotificationCategoryAsync: vi.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: vi.fn().mockResolvedValue('notif-id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: vi.fn().mockResolvedValue([]),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponse: vi.fn().mockReturnValue(null),
  clearLastNotificationResponse: vi.fn(),
  AndroidImportance: { DEFAULT: 5, HIGH: 6 },
  PermissionStatus: { GRANTED: 'granted' },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
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
  isSupabaseConfigured: vi.fn(() => false),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
  getSupabaseAuthEvidence: vi.fn().mockResolvedValue({
    sessionUserId: null,
    verifiedUserId: null,
    isAnonymous: null,
    email: null,
  }),
  getSupabaseSessionUserId: vi.fn().mockResolvedValue(null),
  getSupabaseAuthUserId: vi.fn().mockResolvedValue(null),
  getSupabaseAccessToken: vi.fn().mockResolvedValue(null),
  requestEmailProtection: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  verifyEmailChangeOtp: vi
    .fn()
    .mockResolvedValue({ data: { session: null, user: null }, error: null }),
  resendEmailChange: vi.fn().mockResolvedValue({ error: null }),
  requestExistingAccountRecovery: vi.fn().mockResolvedValue({ error: null }),
  resendExistingAccountRecovery: vi.fn().mockResolvedValue(undefined),
  verifyExistingAccountOtp: vi
    .fn()
    .mockResolvedValue({ data: { session: null, user: null }, error: null }),
  classifySupabaseAuthError: vi.fn((error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes('exist')
      ? 'email_conflict'
      : 'auth',
  ),
  signOutSupabase: vi.fn().mockResolvedValue({ error: null }),
  startSupabaseAutoRefresh: vi.fn(),
  stopSupabaseAutoRefresh: vi.fn(),
}));
