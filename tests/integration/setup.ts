import { vi } from 'vitest';

/**
 * Integration-project setup for `tests/integration/**`.
 *
 * Mirrors `tests/setup.ts` (react-native Platform, expo-crypto,
 * expo-notifications, `@/lib/supabase`) EXCEPT `expo-sqlite`, which here is
 * mocked so `openDatabaseAsync()` returns a REAL in-process better-sqlite3
 * database via `createTestDatabase()`. `core/db/client.ts` then runs its real
 * bootstrap DDL + `runMigrations()` against it, and the feature data layers
 * execute unmodified.
 */

vi.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj['ios'] ?? obj['default'] },
}));

vi.mock('expo-crypto', () => {
  // `createId()` = `{prefix}_{Date.now()}_{8_random_chars}`. The unit-test
  // mock returns the same bytes on every call, which is invisible against the
  // stubbed database but collides under the integration project's REAL UNIQUE
  // constraints when two ids are created in the same millisecond. Use a
  // per-call counter so each call yields a distinct (still deterministic)
  // byte sequence: bytes 0–3 carry the counter, bytes 4–7 a permuted copy.
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

/**
 * The non-mocked half: every `openDatabaseAsync()` call returns a fresh real
 * database. `core/db/client.ts`'s module-level `dbPromise` cache means the
 * real bootstrap runs once per freshened module; `freshDatabase()` in
 * `tests/integration/helpers/db.ts` resets that cache so each test gets a
 * fresh database.
 */
vi.mock('expo-sqlite', async () => {
  const { createTestDatabase } = await import('./helpers/db');
  return {
    openDatabaseAsync: vi.fn(() => createTestDatabase()),
  };
});
