import { describe, expect, it, vi } from 'vitest';

import {
  buildRecoverableSettings,
  canonicalizeSettingsPayload,
  canonicalSettingsPayloadText,
  normalizeRecoverableSettings,
  isValidRecoverableSettings,
} from '@/core/backup/backupSettings';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('recoverable settings allowlist', () => {
  it('builds the exact allowlisted contract', () => {
    const settings = buildRecoverableSettings({
      calorieGoal: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
      pomodoroSettings: {
        focusMinutes: 50,
        shortBreakMinutes: 10,
        longBreakMinutes: 30,
        sessionsBeforeLongBreak: 3,
      },
      themeMode: 'dark',
      themeSlots: { lightThemeId: 'ocean', darkThemeId: 'midnight' },
    });
    expect(settings).toEqual({
      calorieGoal: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
      pomodoroSettings: {
        focusMinutes: 50,
        shortBreakMinutes: 10,
        longBreakMinutes: 30,
        sessionsBeforeLongBreak: 3,
      },
      theme: { mode: 'dark', slots: { lightThemeId: 'ocean', darkThemeId: 'midnight' } },
      // V3 keys default to null when not supplied.
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: null,
      workoutPreferences: null,
    });
  });

  it('normalizes a poisoned payload to safe defaults and drops unknown keys', () => {
    const normalized = normalizeRecoverableSettings({
      calorieGoal: { calories: -100, protein: 'lots' },
      pomodoroSettings: { focusMinutes: 9999, sessionsBeforeLongBreak: 0 },
      theme: { mode: 'neon', slots: { evil: { nested: true } } },
      account: { owner_user_id: 'should-never-apply' },
      secret: 'nope',
    });
    // Known keys normalized via the feature normalizers (bounded clamps).
    expect(normalized.calorieGoal?.calories).toBeGreaterThanOrEqual(0);
    expect(normalized.pomodoroSettings?.focusMinutes).toBeLessThanOrEqual(120);
    expect(normalized.theme.mode).toBeNull(); // 'neon' is not an allowed mode
    expect(normalized.theme.slots).toBeNull(); // non-string slot values dropped
    // Unknown keys never appear in the payload.
    expect('account' in normalized).toBe(false);
    expect('secret' in normalized).toBe(false);
  });

  it('rejects non-object payloads', () => {
    expect(isValidRecoverableSettings(null)).toBe(false);
    expect(isValidRecoverableSettings('string')).toBe(false);
    expect(isValidRecoverableSettings(42)).toBe(false);
    expect(isValidRecoverableSettings({})).toBe(true);
    expect(isValidRecoverableSettings({ calorieGoal: 'not-an-object' })).toBe(false);
  });

  it('normalizes valid values unchanged', () => {
    const input = {
      calorieGoal: { calories: 1800, protein: 120, carbs: 180, fats: 60 },
      pomodoroSettings: {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLongBreak: 4,
      },
      theme: { mode: 'light', slots: { lightThemeId: 'ocean' } },
    };
    expect(normalizeRecoverableSettings(input)).toEqual({
      ...input,
      // V2-shaped input normalizes into the V3 contract with null V3 keys.
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: null,
      workoutPreferences: null,
    });
  });

  it('normalizes V3 keys and drops malformed ones', () => {
    const normalized = normalizeRecoverableSettings({
      macroTargets: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
      pomodoroPresets: {
        presets: [
          {
            id: 'preset_custom',
            name: 'Custom',
            focusMinutes: 30,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
            sessionsBeforeLongBreak: 4,
            autoStartBreaks: true,
            autoStartFocus: false,
          },
        ],
        activePresetId: 'preset_custom',
      },
      workoutRestSeconds: 90,
      notificationPreferences: {
        todoRemindersEnabled: true,
        dailyPlanReminderTime: '7:30',
        weeklyReviewReminder: { enabled: true, weekday: 3, hour: 8, minute: 30 },
      },
      // Malformed V3 values fall back to null rather than poisoning.
      badMacroTargets: { protein: 'lots' },
    });
    expect(normalized.macroTargets).toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 70,
    });
    expect(normalized.pomodoroPresets?.activePresetId).toBe('preset_custom');
    expect(normalized.workoutRestSeconds).toBe(90);
    expect(normalized.notificationPreferences).toEqual({
      todoRemindersEnabled: true,
      dailyPlanReminderTime: { hour: 7, minute: 30 },
      weeklyReviewReminder: { enabled: true, weekday: 3, hour: 8, minute: 30 },
    });
    // A malformed weekly payload falls back to null instead of poisoning.
    const badWeekly = normalizeRecoverableSettings({
      notificationPreferences: {
        todoRemindersEnabled: false,
        dailyPlanReminderTime: '8:00',
        weeklyReviewReminder: { enabled: true, weekday: 9, hour: 8, minute: 0 },
      },
    });
    expect(badWeekly.notificationPreferences?.weeklyReviewReminder).toBeNull();
    expect('badMacroTargets' in normalized).toBe(false);
  });
});

describe('canonicalizeSettingsPayload (settings integrity)', () => {
  const sample = {
    calorieGoal: { calories: 2000, protein: 150, carbs: 200, fats: 70 },
    pomodoroSettings: {
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      sessionsBeforeLongBreak: 3,
    },
    theme: { mode: 'dark', slots: { darkThemeId: 'midnight', lightThemeId: 'ocean' } },
  };

  it('returns a deterministic 64-hex SHA-256 digest', () => {
    const digest = canonicalizeSettingsPayload(sample);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(canonicalizeSettingsPayload(sample)).toBe(digest);
  });

  it('is independent of object key order and theme-slot order', () => {
    const reordered = {
      theme: { slots: { lightThemeId: 'ocean', darkThemeId: 'midnight' }, mode: 'dark' },
      pomodoroSettings: {
        sessionsBeforeLongBreak: 3,
        longBreakMinutes: 30,
        shortBreakMinutes: 10,
        focusMinutes: 50,
      },
      calorieGoal: { fats: 70, carbs: 200, protein: 150, calories: 2000 },
    };
    expect(canonicalizeSettingsPayload(reordered)).toBe(canonicalizeSettingsPayload(sample));
  });

  it('freezes the V2 canonical text against V3 field additions', () => {
    // A historical V2 payload (three original fields) must hash identically
    // under explicit V2 canonicalization regardless of the current version.
    const v2Payload = {
      calorieGoal: sample.calorieGoal,
      pomodoroSettings: sample.pomodoroSettings,
      theme: sample.theme,
    };
    const v2Digest = canonicalizeSettingsPayload(v2Payload, { settingsVersion: 2 });
    expect(v2Digest).toMatch(/^[0-9a-f]{64}$/);
    // The V2 text covers ONLY the three original fields: adding V3 keys to
    // the payload must not change the V2 canonicalization.
    const withV3Keys = { ...v2Payload, macroTargets: null, workoutRestSeconds: 90 };
    expect(canonicalizeSettingsPayload(withV3Keys, { settingsVersion: 2 })).toBe(v2Digest);
    // And the current-version digest differs once V3 keys carry values.
    expect(canonicalizeSettingsPayload(withV3Keys)).not.toBe(v2Digest);
  });

  it('freezes the V3 canonical text against the V4 weekly-review field', () => {
    const withV3Notifications = {
      ...sample,
      notificationPreferences: {
        todoRemindersEnabled: true,
        dailyPlanReminderTime: { hour: 7, minute: 30 },
      },
    };
    const withV4Field = {
      ...withV3Notifications,
      notificationPreferences: {
        ...withV3Notifications.notificationPreferences,
        weeklyReviewReminder: { enabled: true, weekday: 0, hour: 18, minute: 0 },
      },
    };
    // Historical V3 canonicalization ignores the V4 field entirely…
    expect(canonicalizeSettingsPayload(withV4Field, { settingsVersion: 3 })).toBe(
      canonicalizeSettingsPayload(withV3Notifications, { settingsVersion: 3 }),
    );
    // …while the current version includes it as notificationPreferences' last field.
    const v4Text = canonicalSettingsPayloadText(withV4Field);
    expect(v4Text.indexOf('"weeklyReviewReminder"')).toBeGreaterThan(
      v4Text.indexOf('"dailyPlanReminderTime"'),
    );
    expect(canonicalizeSettingsPayload(withV4Field)).not.toBe(
      canonicalizeSettingsPayload(withV3Notifications),
    );
  });

  it('drops unknown/poisoned keys before hashing', () => {
    const poisoned = {
      ...sample,
      account: { owner_user_id: 'should-never-hash' },
      secret: 'nope',
      extraNested: { anything: 'ignored' },
    };
    expect(canonicalizeSettingsPayload(poisoned)).toBe(canonicalizeSettingsPayload(sample));
  });

  it('treats missing and null fields identically', () => {
    const withNulls = {
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: null, slots: null },
    };
    const withAbsents = {};
    expect(canonicalizeSettingsPayload(withNulls)).toBe(canonicalizeSettingsPayload(withAbsents));
  });

  it('changes when a certified value changes', () => {
    const changed = {
      ...sample,
      calorieGoal: { ...sample.calorieGoal, calories: 2100 },
    };
    expect(canonicalizeSettingsPayload(changed)).not.toBe(canonicalizeSettingsPayload(sample));
  });

  it('is stable across the JSON round-trip a JSONB remote row would produce', () => {
    // JSONB reorders keys and normalizes whitespace; re-parsing must hash the
    // same because canonicalization re-sorts keys client-side.
    const roundTripped = JSON.parse(JSON.stringify(sample));
    const reshuffled = JSON.parse(JSON.stringify(sample));
    expect(canonicalizeSettingsPayload(roundTripped)).toBe(canonicalizeSettingsPayload(sample));
    expect(canonicalizeSettingsPayload(reshuffled)).toBe(canonicalizeSettingsPayload(sample));
  });

  it('never includes user_id, updated_at, auth, or sync data in the hash input', () => {
    const withRemoteColumns = {
      ...sample,
      user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      updated_at: '2026-08-15T12:00:00.000Z',
      auth: { session: 'secret' },
    };
    expect(canonicalizeSettingsPayload(withRemoteColumns)).toBe(
      canonicalizeSettingsPayload(sample),
    );
  });

  it('matches the digest of the same payload built through the allowlist builder', () => {
    const built = buildRecoverableSettings({
      calorieGoal: sample.calorieGoal,
      pomodoroSettings: sample.pomodoroSettings,
      themeMode: sample.theme.mode,
      themeSlots: sample.theme.slots,
    });
    expect(canonicalizeSettingsPayload(built)).toBe(canonicalizeSettingsPayload(sample));
  });
});
