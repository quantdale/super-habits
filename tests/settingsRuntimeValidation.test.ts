import { describe, expect, it } from 'vitest';
import { normalizeRecoverableSettings } from '@/core/backup/backupSettings';
import { appMetaKeys, getAppMetaJsonOrDefault } from '@/core/db/appMeta';
import { DEFAULT_CALORIE_GOAL, normalizeCalorieGoal } from '@/features/calories/calories.domain';
import { DEFAULT_SETTINGS, normalizePomodoroSettings } from '@/features/pomodoro/pomodoro.domain';

describe('persisted app_meta runtime normalization', () => {
  it('normalizes malformed, partial, and legacy Pomodoro settings field-by-field', () => {
    expect(
      normalizePomodoroSettings({
        focusMinutes: 50,
        shortBreakMinutes: '5',
        longBreakMinutes: -1,
        extra: 'ignored',
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      focusMinutes: 50,
    });
    expect(normalizePomodoroSettings({ sessionsBeforeLongBreak: 99 })).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes malformed calorie goals without allowing NaN or out-of-range values', () => {
    expect(
      normalizeCalorieGoal({ calories: 2500.5, protein: -1, carbs: Number.NaN, fats: 70 }),
    ).toEqual({
      ...DEFAULT_CALORIE_GOAL,
      calories: 2500.5,
      fats: 70,
    });
    expect(normalizeCalorieGoal(null)).toEqual(DEFAULT_CALORIE_GOAL);
  });

  it('falls back on corrupted JSON and normalizes valid JSON before returning it', async () => {
    const db = {
      getFirstAsync: async () => ({ value: JSON.stringify({ focusMinutes: 0, extra: true }) }),
    };
    await expect(
      getAppMetaJsonOrDefault(
        db as never,
        appMetaKeys.pomodoroSettings,
        DEFAULT_SETTINGS,
        normalizePomodoroSettings,
      ),
    ).resolves.toEqual(DEFAULT_SETTINGS);

    const corruptedDb = {
      getFirstAsync: async () => ({ value: '{broken' }),
    };
    await expect(
      getAppMetaJsonOrDefault(
        corruptedDb as never,
        appMetaKeys.calorieGoal,
        DEFAULT_CALORIE_GOAL,
        normalizeCalorieGoal,
      ),
    ).resolves.toEqual(DEFAULT_CALORIE_GOAL);
  });

  it('preserves a valid settings object while discarding extra fields', () => {
    expect(
      normalizePomodoroSettings({
        focusMinutes: 40,
        shortBreakMinutes: 10,
        longBreakMinutes: 20,
        sessionsBeforeLongBreak: 5,
        unexpected: 'legacy',
      }),
    ).toEqual({
      focusMinutes: 40,
      shortBreakMinutes: 10,
      longBreakMinutes: 20,
      sessionsBeforeLongBreak: 5,
    });
  });

  it('normalizes weekly-review reminder settings and preserves valid wall-clock values', () => {
    expect(
      normalizeRecoverableSettings({
        notificationPreferences: {
          todoRemindersEnabled: true,
          dailyPlanReminderTime: { hour: 9, minute: 5 },
          weeklyReviewReminder: { enabled: true, weekday: 3, hour: 18, minute: 30 },
        },
      }).notificationPreferences,
    ).toEqual({
      todoRemindersEnabled: true,
      dailyPlanReminderTime: { hour: 9, minute: 5 },
      weeklyReviewReminder: { enabled: true, weekday: 3, hour: 18, minute: 30 },
    });

    expect(
      normalizeRecoverableSettings({
        notificationPreferences: {
          weeklyReviewReminder: { enabled: true, weekday: 7, hour: 25, minute: 60 },
        },
      }).notificationPreferences?.weeklyReviewReminder,
    ).toBeNull();
  });
});
