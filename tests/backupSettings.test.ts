import { describe, expect, it, vi } from 'vitest';

import {
  buildRecoverableSettings,
  canonicalizeSettingsPayload,
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
    expect(normalizeRecoverableSettings(input)).toEqual(input);
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
