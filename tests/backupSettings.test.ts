import { describe, expect, it, vi } from 'vitest';

import {
  buildRecoverableSettings,
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
