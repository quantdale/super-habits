import { describe, expect, it } from 'vitest';
import {
  buildPortableBackupFile,
  computePortablePayloadChecksum,
  validatePortableBackupFile,
} from '@/core/portable/portableFormat';
import {
  canonicalizeSettingsPayload,
  normalizeRecoverableSettings,
  projectCertifiedRecoverableSettings,
} from '@/core/backup/backupSettings';

const workout = {
  effortScale: 'rir' as const,
  goalWeight: { value: 75, unit: 'kg' as const },
  workoutReminder: { enabled: true, time: { hour: 9, minute: 30 } },
};
const weekly = { enabled: true, weekday: 1 as const, hour: 8, minute: 0 };
const macroTargets = { calories: 2100, protein: 140, carbs: 220, fats: 70 };
const notification = {
  todoRemindersEnabled: true,
  dailyPlanReminderTime: { hour: 7, minute: 30 },
  weeklyReviewReminder: weekly,
};
function historicalSettingsFile(version: number) {
  const file = buildPortableBackupFile({
    exportedAt: '2026-11-15T00:00:00.000Z',
    appVersion: '1.0.0',
    platform: 'web',
    ownerFingerprint: null,
    rowsByEntity: {},
    settings: {
      calorieGoal: { calories: 2200, protein: 140, carbs: 240, fats: 70 },
      theme: { mode: 'dark', slots: null },
      macroTargets: version >= 3 ? macroTargets : null,
      workoutRestSeconds: version >= 3 ? 90 : null,
      notificationPreferences:
        version >= 3
          ? { ...notification, weeklyReviewReminder: version >= 4 ? weekly : null }
          : null,
    },
  });
  const settings = normalizeRecoverableSettings(file.settings);
  file.settings = settings;
  file.integrity.settings.version = version;
  file.integrity.settings.checksum = canonicalizeSettingsPayload(settings, {
    settingsVersion: version,
  });
  file.integrity.payloadChecksum = computePortablePayloadChecksum(file, {
    settingsVersion: version,
  });
  // These edits leave historical hashes unchanged; they must not alter recovery.
  settings.workoutPreferences = workout;
  if (version < 4 && settings.notificationPreferences)
    settings.notificationPreferences.weeklyReviewReminder = weekly;
  if (version === 2) {
    settings.macroTargets = macroTargets;
    settings.workoutRestSeconds = 600;
    settings.notificationPreferences = notification;
  }
  return { ...file, settings };
}

describe('historical settings integrity epochs', () => {
  it.each([0, 1, 2.5, 6])('refuses unsupported settings integrity epoch %s', (version) => {
    expect(() => projectCertifiedRecoverableSettings({}, version)).toThrow(/Unsupported/);
  });

  it.each([3, 4, 5])(
    'preserves preset display order without trusting extra preset fields in epoch %s',
    (version) => {
      const original = normalizeRecoverableSettings({
        pomodoroPresets: {
          presets: [
            {
              id: 'zz_custom',
              name: 'Favorite',
              focusMinutes: 25,
              shortBreakMinutes: 5,
              longBreakMinutes: 15,
              sessionsBeforeLongBreak: 4,
              autoStartBreaks: false,
              autoStartFocus: false,
            },
          ],
          activePresetId: 'zz_custom',
        },
      });
      const recovered = projectCertifiedRecoverableSettings(original, version);
      expect(recovered.pomodoroPresets?.presets.map((preset) => preset.id)).toEqual(
        original.pomodoroPresets?.presets.map((preset) => preset.id),
      );
      expect(recovered.pomodoroPresets?.activePresetId).toBe('zz_custom');
      expect(canonicalizeSettingsPayload(recovered, { settingsVersion: version })).toBe(
        canonicalizeSettingsPayload(original, { settingsVersion: version }),
      );
    },
  );

  it.each([2, 3, 4])('restores only fields certified by settings version %s', (version) => {
    const input = historicalSettingsFile(version);
    const result = validatePortableBackupFile(input);
    expect(result.ok, result.ok ? '' : result.errors.join('; ')).toBe(true);
    if (!result.ok) throw new Error('historical fixture was rejected');
    const restored = normalizeRecoverableSettings(result.file.settings);
    expect(restored.calorieGoal?.calories).toBe(2200);
    expect(restored.theme.mode).toBe('dark');
    expect(restored.workoutPreferences).toBeNull();
    if (version === 2) {
      expect(restored.macroTargets).toBeNull();
      expect(restored.workoutRestSeconds).toBeNull();
      expect(restored.notificationPreferences).toBeNull();
    } else {
      expect(restored.macroTargets).toEqual(macroTargets);
      expect(restored.workoutRestSeconds).toBe(90);
      expect(restored.notificationPreferences?.todoRemindersEnabled).toBe(true);
      expect(restored.notificationPreferences?.weeklyReviewReminder).toEqual(
        version === 3 ? null : weekly,
      );
    }
    expect(input.settings.workoutPreferences).toEqual(workout);
    expect(canonicalizeSettingsPayload(restored, { settingsVersion: version })).toBe(
      input.integrity.settings.checksum,
    );
  });

  it('continues to certify and recover all current settings fields', () => {
    const file = buildPortableBackupFile({
      exportedAt: '2026-11-15T00:00:00.000Z',
      appVersion: '1.0.0',
      platform: 'web',
      ownerFingerprint: null,
      rowsByEntity: {},
      settings: {
        macroTargets,
        workoutPreferences: workout,
        notificationPreferences: notification,
      },
    });
    const settings = normalizeRecoverableSettings(file.settings);
    file.settings = settings;
    const validated = validatePortableBackupFile(file);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error('current fixture was rejected');
    const restored = normalizeRecoverableSettings(validated.file.settings);
    expect(restored.workoutPreferences).toEqual(workout);
    expect(restored.notificationPreferences).toEqual(notification);
    settings.workoutPreferences!.goalWeight = { value: 90, unit: 'kg' };
    expect(validatePortableBackupFile(file).ok).toBe(false);
  });
});
