import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SQLite from 'expo-sqlite';
import { freshDatabase } from './helpers/db';

/**
 * Notification-preference backup round-trip (settings V4).
 *
 * Covers the split-brain fix: live reminder preferences are written to
 * AsyncStorage by the settings UI/schedulers, while the snapshot historically
 * read ONLY the app_meta copy (which nothing updated outside restore). After
 * this change the capture overlays live AsyncStorage values, restore stages
 * them through the durable pending-application marker, and the weekly-review
 * preference joins the same loop.
 */

const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.impl.getItem,
    setItem: asyncStorageMock.impl.setItem,
    removeItem: asyncStorageMock.impl.removeItem,
  },
}));

const KEY_TODO = 'superhabits.notifications.todo-reminders-enabled';
const KEY_PLAN_TIME = 'superhabits.notifications.daily-plan-reminder-time';
const KEY_WEEKLY = 'superhabits.notifications.weekly-review-reminder';

describe('notification preference backup round-trip (settings V4)', () => {
  beforeEach(() => {
    asyncStorageMock.state.clear();
  });

  it('capture overlays LIVE AsyncStorage reminder values over the stale app_meta copy', async () => {
    const db = await freshDatabase();
    const backupSettings = await import('@/core/backup/backupSettings');
    const sqliteDb = db as unknown as SQLite.SQLiteDatabase;

    // A previous RESTORE wrote these into app_meta…
    await backupSettings.applyRecoverableSettingsToSqlite(sqliteDb, {
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: null, slots: null },
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: {
        todoRemindersEnabled: false,
        dailyPlanReminderTime: { hour: 8, minute: 0 },
        weeklyReviewReminder: null,
      },
    });

    // …but the user has since changed everything in Settings (AsyncStorage).
    asyncStorageMock.state.set(KEY_TODO, 'enabled');
    asyncStorageMock.state.set(KEY_PLAN_TIME, '7:15');
    asyncStorageMock.state.set(
      KEY_WEEKLY,
      JSON.stringify({ enabled: true, weekday: 5, hour: 17, minute: 45 }),
    );

    const snapshot = await backupSettings.readRecoverableSettings(sqliteDb);

    expect(snapshot.notificationPreferences).toEqual({
      todoRemindersEnabled: true,
      dailyPlanReminderTime: { hour: 7, minute: 15 },
      weeklyReviewReminder: { enabled: true, weekday: 5, hour: 17, minute: 45 },
    });

    // The V4 canonical text carries the weekly field.
    const text = backupSettings.canonicalSettingsPayloadText(snapshot);
    expect(text).toContain('"weeklyReviewReminder":{"enabled":true,"weekday":5');
  });

  it('an explicit user-off toggle survives capture instead of falling back to app_meta', async () => {
    const db = await freshDatabase();
    const backupSettings = await import('@/core/backup/backupSettings');
    const notificationPreferences = await import('@/core/notifications/notificationPreferences');
    const sqliteDb = db as unknown as SQLite.SQLiteDatabase;

    await backupSettings.applyRecoverableSettingsToSqlite(sqliteDb, {
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: null, slots: null },
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: {
        todoRemindersEnabled: true,
        dailyPlanReminderTime: { hour: 8, minute: 0 },
        weeklyReviewReminder: null,
      },
    });

    // User turns todos OFF: the setter writes an explicit 'disabled' marker
    // (not removal), so the overlay must capture false rather than fall back.
    await notificationPreferences.setTodoRemindersEnabled(false);

    const snapshot = await backupSettings.readRecoverableSettings(sqliteDb);
    expect(snapshot.notificationPreferences?.todoRemindersEnabled).toBe(false);
  });

  it('restore stages reminder prefs through the durable marker and applies them post-commit', async () => {
    const db = await freshDatabase();
    const backupSettings = await import('@/core/backup/backupSettings');
    const notificationPreferences = await import('@/core/notifications/notificationPreferences');
    const sqliteDb = db as unknown as SQLite.SQLiteDatabase;

    const payload = {
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: 'dark', slots: null },
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: {
        todoRemindersEnabled: true,
        dailyPlanReminderTime: { hour: 9, minute: 5 },
        weeklyReviewReminder: { enabled: true, weekday: 0, hour: 18, minute: 30 },
      },
    };

    await backupSettings.stagePendingThemeApplication(sqliteDb, payload, 'sig-1');
    expect(await backupSettings.applyPendingThemeApplication()).toBe(true);

    // Live runtime getters (AsyncStorage-backed) now reflect the restore…
    notificationPreferences.resetNotificationPreferenceCaches();
    await expect(notificationPreferences.getTodoRemindersEnabled()).resolves.toBe(true);
    await expect(notificationPreferences.getDailyPlanReminderTime()).resolves.toEqual({
      hour: 9,
      minute: 5,
    });
    const weekly = await notificationPreferences.getWeeklyReviewReminder();
    expect(weekly).toMatchObject({ enabled: true, weekday: 0, hour: 18, minute: 30 });

    // …and the durable marker was cleared only after success.
    expect(await backupSettings.readPendingThemeApplication(sqliteDb)).toBeNull();
    expect(asyncStorageMock.state.get(KEY_WEEKLY)).toContain('"weekday":0');
  });

  it('keeps the V3 canonical text byte-stable when a payload carries the V4 field', async () => {
    const backupSettings = await import('@/core/backup/backupSettings');

    const v3ShapePayload = {
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: null, slots: null },
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: {
        todoRemindersEnabled: true,
        dailyPlanReminderTime: { hour: 8, minute: 0 },
      },
    };
    const v4ShapePayload = {
      ...v3ShapePayload,
      notificationPreferences: {
        ...v3ShapePayload.notificationPreferences,
        weeklyReviewReminder: { enabled: true, weekday: 1, hour: 9, minute: 0 },
      },
    };

    // Historical V3 canonicalization ignores the V4 field entirely.
    expect(
      backupSettings.canonicalSettingsPayloadText(v4ShapePayload, { settingsVersion: 3 }),
    ).toBe(backupSettings.canonicalSettingsPayloadText(v3ShapePayload, { settingsVersion: 3 }));

    // Current canonicalization includes it.
    expect(backupSettings.canonicalSettingsPayloadText(v4ShapePayload)).not.toBe(
      backupSettings.canonicalSettingsPayloadText(v3ShapePayload),
    );
    expect(backupSettings.canonicalSettingsPayloadText(v4ShapePayload)).toContain(
      '"weeklyReviewReminder"',
    );
  });
});
