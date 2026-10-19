import { vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'] },
}));

vi.mock('expo-crypto', () => {
  // `createId()` is `{prefix}_{Date.now()}_{8 random chars}`. Returning the SAME
  // bytes on every call makes two ids created in the same millisecond IDENTICAL,
  // which silently drops rows under a real PRIMARY KEY / UNIQUE constraint — the
  // audited symptom was a quest event vanishing while its quest row persisted.
  // The integration setup already used a per-call counter; the unit setup did
  // not. This matches it: a deterministic per-call byte sequence, so ids stay
  // reproducible AND unique.
  let counter = 0;
  return {
    getRandomValues: vi.fn((array: Uint8Array) => {
      counter = (counter + 1) >>> 0;
      for (let i = 0; i < array.length; i++) {
        const byte = (counter >>> ((i % 4) * 8)) & 0xff;
        array[i] = (byte ^ (i * 37)) & 0xff;
      }
      return array;
    }),
  };
});

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

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(() => ({
    volume: 1,
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  })),
  setAudioModeAsync: vi.fn().mockResolvedValue(undefined),
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
