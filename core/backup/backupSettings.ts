import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as SQLite from 'expo-sqlite';
import {
  appMetaKeys,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
  setAppMetaText,
} from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import {
  DEFAULT_SETTINGS as DEFAULT_POMODORO_SETTINGS,
  findPresetById,
  normalizePomodoroPresets,
  normalizePomodoroSettings,
  type PomodoroPreset,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';
import {
  DEFAULT_CALORIE_GOAL,
  normalizeCalorieGoal,
  normalizeMacroTargets,
} from '@/features/calories/calories.domain';
import type { CalorieGoal } from '@/features/calories/types';
import { clampRestSeconds } from '@/features/workout/restTimerPreferences';
import {
  DEFAULT_DAILY_PLAN_REMINDER_TIME,
  DAILY_PLAN_REMINDER_TIME_KEY,
  TODO_REMINDERS_ENABLED_KEY,
} from '@/core/notifications/notificationPreferences';
import {
  formatTimeOfDay,
  parseTimeOfDay,
  type TimeOfDay,
} from '@/core/notifications/reminderPlanning';
import {
  WEEKLY_REVIEW_REMINDER_STORAGE_KEY,
  normalizeRecoverableWeeklyReviewReminder,
  type RecoverableWeeklyReviewReminder,
} from '@/features/weekly-review/weeklyReviewReminder.domain';
import { sha256Hex } from '@/lib/checksum';
import { BACKUP_SETTINGS_VERSION, type RecoverableSettingsV5 } from '@/core/backup/backup.types';

const THEME_MODE_STORAGE_KEY = 'superhabits.theme.mode';
const THEME_SLOTS_STORAGE_KEY = 'superhabits.theme.slots.v2';

export const THEME_MODES = ['light', 'dark', 'system'] as const;

/** Pomodoro presets + active preset id as carried in the recoverable payload. */
export type RecoverablePomodoroPresets = {
  presets: PomodoroPreset[];
  activePresetId: string | null;
};

/** Todo/daily-plan/weekly-review reminder preferences as carried in the payload. */
export type RecoverableNotificationPreferences = {
  todoRemindersEnabled: boolean;
  dailyPlanReminderTime: TimeOfDay;
  /** Settings V4; null in historical V3 payloads and when never configured. */
  weeklyReviewReminder: RecoverableWeeklyReviewReminder | null;
};

export type RecoverableWorkoutPreferences = {
  effortScale: 'off' | 'rir' | 'rpe';
  goalWeight: { value: number; unit: 'kg' | 'lb' } | null;
  workoutReminder: { enabled: boolean; time: TimeOfDay } | null;
};

/**
 * The recoverable settings allowlist. Only these keys are ever backed up or
 * restored; auth/sync/system/device state never enters the payload. The V3/V4
 * additions are SQLite-backed (app_meta) so they join the restore import
 * transaction; theme and live reminder preferences remain AsyncStorage-backed
 * and stage separately where needed.
 */
export function buildRecoverableSettings(input: {
  calorieGoal: CalorieGoal | null;
  pomodoroSettings: PomodoroSettings | null;
  themeMode: string | null;
  themeSlots: Record<string, string> | null;
  macroTargets?: CalorieGoal | null;
  pomodoroPresets?: RecoverablePomodoroPresets | null;
  workoutRestSeconds?: number | null;
  notificationPreferences?: RecoverableNotificationPreferences | null;
  workoutPreferences?: RecoverableWorkoutPreferences | null;
}): RecoverableSettingsV5 {
  return {
    calorieGoal: input.calorieGoal,
    pomodoroSettings: input.pomodoroSettings,
    theme: {
      mode: input.themeMode,
      slots: input.themeSlots,
    },
    macroTargets: input.macroTargets ?? null,
    pomodoroPresets: input.pomodoroPresets ?? null,
    workoutRestSeconds: input.workoutRestSeconds ?? null,
    notificationPreferences: input.notificationPreferences ?? null,
    workoutPreferences: input.workoutPreferences ?? null,
  };
}

function normalizeRecoverablePomodoroPresets(value: unknown): RecoverablePomodoroPresets | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.presets)) return null;
  const presets = normalizePomodoroPresets(candidate.presets);
  const rawActiveId =
    typeof candidate.activePresetId === 'string' && candidate.activePresetId.length > 0
      ? candidate.activePresetId
      : null;
  return {
    presets,
    // The active id must resolve against the normalized preset list.
    activePresetId: rawActiveId ? (findPresetById(presets, rawActiveId)?.id ?? null) : null,
  };
}

function normalizeRecoverableNotificationPreferences(
  value: unknown,
): RecoverableNotificationPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const todoRemindersEnabled = candidate.todoRemindersEnabled === true;
  const rawTime = candidate.dailyPlanReminderTime;
  const rawHour =
    rawTime && typeof rawTime === 'object' ? (rawTime as Record<string, unknown>).hour : undefined;
  const rawMinute =
    rawTime && typeof rawTime === 'object'
      ? (rawTime as Record<string, unknown>).minute
      : undefined;
  const objectTime =
    typeof rawHour === 'number' &&
    typeof rawMinute === 'number' &&
    Number.isInteger(rawHour) &&
    Number.isInteger(rawMinute) &&
    rawHour >= 0 &&
    rawHour <= 23 &&
    rawMinute >= 0 &&
    rawMinute <= 59
      ? { hour: rawHour, minute: rawMinute }
      : null;
  const dailyPlanReminderTime =
    typeof rawTime === 'string'
      ? (parseTimeOfDay(rawTime) ?? DEFAULT_DAILY_PLAN_REMINDER_TIME)
      : (objectTime ?? DEFAULT_DAILY_PLAN_REMINDER_TIME);
  return {
    todoRemindersEnabled,
    dailyPlanReminderTime,
    weeklyReviewReminder: normalizeRecoverableWeeklyReviewReminder(candidate.weeklyReviewReminder),
  };
}

function normalizeRecoverableWorkoutPreferences(
  value: unknown,
): RecoverableWorkoutPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const effortScale =
    candidate.effortScale === 'rir' || candidate.effortScale === 'rpe'
      ? candidate.effortScale
      : 'off';
  const rawGoal = candidate.goalWeight;
  const goalWeight =
    rawGoal && typeof rawGoal === 'object'
      ? (() => {
          const goal = rawGoal as Record<string, unknown>;
          const value = goal.value;
          const unit = goal.unit;
          const normalizedUnit: 'kg' | 'lb' | null = unit === 'kg' || unit === 'lb' ? unit : null;
          return typeof value === 'number' &&
            Number.isFinite(value) &&
            value > 0 &&
            value <= 1_000 &&
            normalizedUnit
            ? { value, unit: normalizedUnit }
            : null;
        })()
      : null;
  const rawReminder = candidate.workoutReminder;
  const workoutReminder =
    rawReminder && typeof rawReminder === 'object'
      ? (() => {
          const reminder = rawReminder as Record<string, unknown>;
          const rawTime = reminder.time;
          const time =
            rawTime && typeof rawTime === 'object'
              ? {
                  hour: (rawTime as Record<string, unknown>).hour,
                  minute: (rawTime as Record<string, unknown>).minute,
                }
              : null;
          return reminder.enabled === true &&
            time &&
            typeof time.hour === 'number' &&
            Number.isInteger(time.hour) &&
            time.hour >= 0 &&
            time.hour <= 23 &&
            typeof time.minute === 'number' &&
            Number.isInteger(time.minute) &&
            time.minute >= 0 &&
            time.minute <= 59
            ? { enabled: true, time: { hour: time.hour, minute: time.minute } }
            : {
                enabled: false,
                time:
                  time && typeof time.hour === 'number' && typeof time.minute === 'number'
                    ? {
                        hour: Math.max(0, Math.min(23, Math.round(time.hour))),
                        minute: Math.max(0, Math.min(59, Math.round(time.minute))),
                      }
                    : { hour: 8, minute: 0 },
              };
        })()
      : null;
  return { effortScale, goalWeight, workoutReminder };
}

/**
 * Validate and normalize an untrusted settings payload. Unknown keys are
 * dropped; malformed known keys fall back to defaults via the feature
 * normalizers so a poisoned payload cannot corrupt local settings. V2/V3
 * payloads (without the newer V3/V4 keys) normalize cleanly — absent keys
 * become null.
 */
export function normalizeRecoverableSettings(input: unknown): RecoverableSettingsV5 {
  const candidate = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const calorieGoal =
    candidate.calorieGoal === null || candidate.calorieGoal === undefined
      ? null
      : normalizeCalorieGoal(candidate.calorieGoal);
  const pomodoroSettings =
    candidate.pomodoroSettings === null || candidate.pomodoroSettings === undefined
      ? null
      : normalizePomodoroSettings(candidate.pomodoroSettings);
  const theme =
    candidate.theme && typeof candidate.theme === 'object'
      ? (candidate.theme as Record<string, unknown>)
      : {};
  const mode =
    typeof theme.mode === 'string' && (THEME_MODES as readonly string[]).includes(theme.mode)
      ? theme.mode
      : null;
  let slots: Record<string, string> | null = null;
  if (theme.slots && typeof theme.slots === 'object') {
    const rawSlots = theme.slots as Record<string, unknown>;
    const cleaned: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawSlots)) {
      if (typeof value === 'string' && value.length <= 100 && key.length <= 100) {
        cleaned[key] = value;
      }
    }
    if (Object.keys(cleaned).length > 0) slots = cleaned;
  }
  const macroTargets =
    candidate.macroTargets === null || candidate.macroTargets === undefined
      ? null
      : normalizeMacroTargets(candidate.macroTargets);
  const pomodoroPresets =
    candidate.pomodoroPresets === null || candidate.pomodoroPresets === undefined
      ? null
      : normalizeRecoverablePomodoroPresets(candidate.pomodoroPresets);
  const workoutRestSeconds =
    typeof candidate.workoutRestSeconds === 'number'
      ? clampRestSeconds(candidate.workoutRestSeconds)
      : null;
  const notificationPreferences =
    candidate.notificationPreferences === null || candidate.notificationPreferences === undefined
      ? null
      : normalizeRecoverableNotificationPreferences(candidate.notificationPreferences);
  const workoutPreferences =
    candidate.workoutPreferences === null || candidate.workoutPreferences === undefined
      ? null
      : normalizeRecoverableWorkoutPreferences(candidate.workoutPreferences);
  return {
    calorieGoal,
    pomodoroSettings,
    theme: { mode, slots },
    macroTargets,
    pomodoroPresets,
    workoutRestSeconds,
    notificationPreferences,
    workoutPreferences,
  };
}

export function isValidRecoverableSettings(input: unknown): input is RecoverableSettingsV5 {
  if (!input || typeof input !== 'object') return false;
  const candidate = input as Record<string, unknown>;
  if (
    'calorieGoal' in candidate &&
    candidate.calorieGoal !== null &&
    typeof candidate.calorieGoal !== 'object'
  ) {
    return false;
  }
  if (
    'pomodoroSettings' in candidate &&
    candidate.pomodoroSettings !== null &&
    typeof candidate.pomodoroSettings !== 'object'
  ) {
    return false;
  }
  if ('theme' in candidate && candidate.theme !== null && typeof candidate.theme !== 'object') {
    return false;
  }
  if (
    'workoutPreferences' in candidate &&
    candidate.workoutPreferences !== null &&
    typeof candidate.workoutPreferences !== 'object'
  ) {
    return false;
  }
  return true;
}

function sortedEntries(record: Record<string, string>): [string, string][] {
  return Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Deterministic SHA-256 of the allowlisted settings payload.
 *
 * Both the backing-up device (at checkpoint capture) and the restoring device
 * (at pre-import verification) normalize then canonicalize the payload to a
 * fixed shape: explicit null defaults for absent keys, fixed field order,
 * sorted theme-slot keys, `undefined` normalized to `null`. Remote JSONB key
 * reordering/whitespace normalization is therefore neutralized (values are
 * re-canonicalized client-side before hashing), and only the allowlisted
 * contract is hashed — `user_id`, remote `updated_at`, auth and sync data are
 * excluded by construction.
 *
 * The hash is byte-identical across node (tests), web (WASM SQLite), and
 * native (Hermes) because it uses the pure-TS SHA-256 in `lib/checksum.ts`.
 */
export function canonicalizeSettingsPayload(
  payload: unknown,
  options?: { settingsVersion?: number },
): string {
  return sha256Hex(canonicalSettingsPayloadText(payload, options));
}

/**
 * Canonical TEXT form of the allowlisted settings payload (the exact string
 * that `canonicalizeSettingsPayload` hashes). Exported so the portable
 * backup envelope can cover the same canonical settings text in its payload
 * checksum; the checksum itself is byte-identical either way.
 *
 * Versioned canonicalization: `settingsVersion: 2` reproduces the frozen V2
 * text (three original fields only) so historical payloads verify byte-stably
 * after the V3/V4 keys were appended; the current version appends the V3/V4
 * fields at the END of the canonical object, keeping the V2 prefix stable.
 */
export function canonicalSettingsPayloadText(
  payload: unknown,
  options?: { settingsVersion?: number },
): string {
  const normalized = normalizeRecoverableSettings(payload);
  const canonical: Record<string, unknown> = {
    calorieGoal: normalized.calorieGoal
      ? {
          calories: normalized.calorieGoal.calories,
          protein: normalized.calorieGoal.protein,
          carbs: normalized.calorieGoal.carbs,
          fats: normalized.calorieGoal.fats,
        }
      : null,
    pomodoroSettings: normalized.pomodoroSettings
      ? {
          focusMinutes: normalized.pomodoroSettings.focusMinutes,
          shortBreakMinutes: normalized.pomodoroSettings.shortBreakMinutes,
          longBreakMinutes: normalized.pomodoroSettings.longBreakMinutes,
          sessionsBeforeLongBreak: normalized.pomodoroSettings.sessionsBeforeLongBreak,
        }
      : null,
    theme: {
      mode: normalized.theme.mode ?? null,
      slots: normalized.theme.slots
        ? Object.fromEntries(sortedEntries(normalized.theme.slots))
        : null,
    },
  };
  const requestedVersion = options?.settingsVersion ?? BACKUP_SETTINGS_VERSION;
  if (requestedVersion < 3) {
    // Frozen V2 canonical text — must stay byte-identical to the pre-V3 form.
    return JSON.stringify(canonical);
  }
  canonical.macroTargets = normalized.macroTargets
    ? {
        calories: normalized.macroTargets.calories,
        protein: normalized.macroTargets.protein,
        carbs: normalized.macroTargets.carbs,
        fats: normalized.macroTargets.fats,
      }
    : null;
  canonical.pomodoroPresets = normalized.pomodoroPresets
    ? {
        presets: [...normalized.pomodoroPresets.presets]
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .map((preset) => ({
            id: preset.id,
            name: preset.name,
            focusMinutes: preset.focusMinutes,
            shortBreakMinutes: preset.shortBreakMinutes,
            longBreakMinutes: preset.longBreakMinutes,
            sessionsBeforeLongBreak: preset.sessionsBeforeLongBreak,
            autoStartBreaks: preset.autoStartBreaks,
            autoStartFocus: preset.autoStartFocus,
          })),
        activePresetId: normalized.pomodoroPresets.activePresetId ?? null,
      }
    : null;
  canonical.workoutRestSeconds =
    normalized.workoutRestSeconds === null ? null : normalized.workoutRestSeconds;
  const notificationPrefs = normalized.notificationPreferences;
  if (!notificationPrefs) {
    canonical.notificationPreferences = null;
    if (requestedVersion < 5) return JSON.stringify(canonical);
    canonical.workoutPreferences = normalized.workoutPreferences
      ? canonicalWorkoutPreferences(normalized.workoutPreferences)
      : null;
    return JSON.stringify(canonical);
  }
  if (requestedVersion < 4) {
    // Frozen V3 canonical text — byte-identical to the pre-V4 form so every
    // historical V3 snapshot/file still verifies against the checksum its
    // capturing device computed.
    canonical.notificationPreferences = {
      todoRemindersEnabled: notificationPrefs.todoRemindersEnabled,
      dailyPlanReminderTime: {
        hour: notificationPrefs.dailyPlanReminderTime.hour,
        minute: notificationPrefs.dailyPlanReminderTime.minute,
      },
    };
    return JSON.stringify(canonical);
  }
  // V4 appends the weekly-review reminder INSIDE notificationPreferences as
  // the last field; the V3 prefix above stays stable.
  canonical.notificationPreferences = {
    todoRemindersEnabled: notificationPrefs.todoRemindersEnabled,
    dailyPlanReminderTime: {
      hour: notificationPrefs.dailyPlanReminderTime.hour,
      minute: notificationPrefs.dailyPlanReminderTime.minute,
    },
    weeklyReviewReminder: notificationPrefs.weeklyReviewReminder
      ? {
          enabled: notificationPrefs.weeklyReviewReminder.enabled,
          weekday: notificationPrefs.weeklyReviewReminder.weekday,
          hour: notificationPrefs.weeklyReviewReminder.hour,
          minute: notificationPrefs.weeklyReviewReminder.minute,
        }
      : null,
  };
  if (requestedVersion < 5) return JSON.stringify(canonical);
  canonical.workoutPreferences = normalized.workoutPreferences
    ? canonicalWorkoutPreferences(normalized.workoutPreferences)
    : null;
  return JSON.stringify(canonical);
}

function canonicalWorkoutPreferences(preferences: RecoverableWorkoutPreferences) {
  return {
    effortScale: preferences.effortScale,
    goalWeight: preferences.goalWeight
      ? { value: preferences.goalWeight.value, unit: preferences.goalWeight.unit }
      : null,
    workoutReminder: preferences.workoutReminder
      ? {
          enabled: preferences.workoutReminder.enabled,
          time: {
            hour: preferences.workoutReminder.time.hour,
            minute: preferences.workoutReminder.time.minute,
          },
        }
      : null,
  };
}

async function readThemeSnapshot(): Promise<{
  mode: string | null;
  slots: Record<string, string> | null;
}> {
  let mode: string | null = null;
  let slots: Record<string, string> | null = null;
  try {
    const storedMode = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (storedMode && (THEME_MODES as readonly string[]).includes(storedMode)) {
      mode = storedMode;
    }
    const storedSlots = await AsyncStorage.getItem(THEME_SLOTS_STORAGE_KEY);
    if (storedSlots) {
      const parsed: unknown = JSON.parse(storedSlots);
      if (parsed && typeof parsed === 'object') {
        const cleaned: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && key.length <= 100 && value.length <= 100) {
            cleaned[key] = value;
          }
        }
        if (Object.keys(cleaned).length > 0) slots = cleaned;
      }
    }
  } catch {
    // Theme persistence is best-effort; a read failure yields an empty theme.
  }
  return { mode, slots };
}

/**
 * Live AsyncStorage values for the reminder preferences. The runtime source of
 * truth for these is AsyncStorage (schedulers read it directly), while the
 * snapshot historically read the app_meta copy — which only restore writes.
 * Without this overlay, a fresh device's backups would silently capture stale
 * or empty notification preferences. Raw-null means "unset here" and falls
 * back to the app_meta value so a restored preference survives until the user
 * changes it locally.
 */
async function readLiveNotificationPreferenceOverrides(): Promise<{
  todoRemindersEnabled?: boolean;
  dailyPlanReminderTime?: TimeOfDay;
  weeklyReviewReminder?: RecoverableWeeklyReviewReminder | null;
}> {
  const overrides: {
    todoRemindersEnabled?: boolean;
    dailyPlanReminderTime?: TimeOfDay;
    weeklyReviewReminder?: RecoverableWeeklyReviewReminder | null;
  } = {};
  try {
    const rawToggle = await AsyncStorage.getItem(TODO_REMINDERS_ENABLED_KEY);
    if (rawToggle !== null) overrides.todoRemindersEnabled = rawToggle === 'enabled';
  } catch {
    // Unreadable AsyncStorage keeps the app_meta fallback for this field.
  }
  try {
    const rawTime = await AsyncStorage.getItem(DAILY_PLAN_REMINDER_TIME_KEY);
    if (rawTime !== null) {
      const parsed = parseTimeOfDay(rawTime);
      if (parsed) overrides.dailyPlanReminderTime = parsed;
    }
  } catch {
    // Same fallback rule as above.
  }
  try {
    const rawWeekly = await AsyncStorage.getItem(WEEKLY_REVIEW_REMINDER_STORAGE_KEY);
    if (rawWeekly !== null) {
      try {
        overrides.weeklyReviewReminder = normalizeRecoverableWeeklyReviewReminder(
          JSON.parse(rawWeekly),
        );
      } catch {
        // Malformed JSON keeps the app_meta fallback.
      }
    }
  } catch {
    // Same fallback rule as above.
  }
  return overrides;
}

/** Read the current allowlisted settings snapshot (used at push time). */
export async function readRecoverableSettings(
  db: SQLite.SQLiteDatabase,
): Promise<RecoverableSettingsV5> {
  const [
    calorieGoal,
    pomodoroSettings,
    macroTargets,
    pomodoroPresets,
    workoutRestSeconds,
    notificationPreferences,
    workoutPreferences,
    liveNotificationOverrides,
    theme,
  ] = await Promise.all([
    getAppMetaJsonOrDefault<CalorieGoal>(
      db,
      appMetaKeys.calorieGoal,
      DEFAULT_CALORIE_GOAL,
      normalizeCalorieGoal,
    ),
    getAppMetaJsonOrDefault<PomodoroSettings>(
      db,
      appMetaKeys.pomodoroSettings,
      DEFAULT_POMODORO_SETTINGS,
      normalizePomodoroSettings,
    ),
    getAppMetaJsonOrDefault<CalorieGoal | null>(
      db,
      appMetaKeys.calorieTargets,
      null,
      normalizeMacroTargets,
    ),
    getAppMetaJsonOrDefault<RecoverablePomodoroPresets | null>(
      db,
      appMetaKeys.pomodoroPresets,
      null,
      normalizeRecoverablePomodoroPresets,
    ),
    getAppMetaJsonOrDefault<number | null>(db, appMetaKeys.workoutRestSeconds, null, (value) =>
      typeof value === 'number' && Number.isFinite(value) ? clampRestSeconds(value) : null,
    ),
    getAppMetaJsonOrDefault<RecoverableNotificationPreferences | null>(
      db,
      appMetaKeys.notificationPreferences,
      null,
      normalizeRecoverableNotificationPreferences,
    ),
    getAppMetaJsonOrDefault<RecoverableWorkoutPreferences | null>(
      db,
      appMetaKeys.workoutPreferences,
      null,
      normalizeRecoverableWorkoutPreferences,
    ),
    readLiveNotificationPreferenceOverrides(),
    readThemeSnapshot(),
  ]);
  // Overlay the LIVE AsyncStorage preferences over the app_meta copy so the
  // snapshot reflects what the user actually configured on this device.
  let mergedNotificationPreferences = notificationPreferences;
  if (liveNotificationOverrides.todoRemindersEnabled !== undefined) {
    mergedNotificationPreferences = {
      todoRemindersEnabled: liveNotificationOverrides.todoRemindersEnabled,
      dailyPlanReminderTime:
        mergedNotificationPreferences?.dailyPlanReminderTime ?? DEFAULT_DAILY_PLAN_REMINDER_TIME,
      weeklyReviewReminder: mergedNotificationPreferences?.weeklyReviewReminder ?? null,
    };
  }
  if (liveNotificationOverrides.dailyPlanReminderTime !== undefined) {
    mergedNotificationPreferences = {
      todoRemindersEnabled: mergedNotificationPreferences?.todoRemindersEnabled ?? false,
      dailyPlanReminderTime: liveNotificationOverrides.dailyPlanReminderTime,
      weeklyReviewReminder: mergedNotificationPreferences?.weeklyReviewReminder ?? null,
    };
  }
  if (liveNotificationOverrides.weeklyReviewReminder !== undefined) {
    mergedNotificationPreferences = {
      todoRemindersEnabled: mergedNotificationPreferences?.todoRemindersEnabled ?? false,
      dailyPlanReminderTime:
        mergedNotificationPreferences?.dailyPlanReminderTime ?? DEFAULT_DAILY_PLAN_REMINDER_TIME,
      weeklyReviewReminder: liveNotificationOverrides.weeklyReviewReminder,
    };
  }
  return buildRecoverableSettings({
    calorieGoal,
    pomodoroSettings,
    themeMode: theme.mode,
    themeSlots: theme.slots,
    macroTargets,
    pomodoroPresets,
    workoutRestSeconds,
    notificationPreferences: mergedNotificationPreferences,
    workoutPreferences,
  });
}

/**
 * Apply the SQLite-backed recoverable settings to app_meta — restore import
 * path, called INSIDE the import transaction. Theme and live reminder settings
 * live in AsyncStorage and cannot join the SQLite transaction; stage them with
 * `stagePendingThemeApplication` in the same transaction and apply after
 * commit with restart reconciliation. Newer keys are only written when
 * present in the payload, so restoring a legacy V2/V3 payload never clears
 * local newer preferences.
 */
export async function applyRecoverableSettingsToSqlite(
  db: SQLite.SQLiteDatabase,
  payload: unknown,
): Promise<RecoverableSettingsV5> {
  const normalized = normalizeRecoverableSettings(payload);
  if (normalized.calorieGoal) {
    await setAppMetaJson(db, appMetaKeys.calorieGoal, normalized.calorieGoal);
  }
  if (normalized.pomodoroSettings) {
    await setAppMetaJson(db, appMetaKeys.pomodoroSettings, normalized.pomodoroSettings);
  }
  if (normalized.macroTargets) {
    await setAppMetaJson(db, appMetaKeys.calorieTargets, normalized.macroTargets);
  }
  if (normalized.pomodoroPresets) {
    await setAppMetaJson(db, appMetaKeys.pomodoroPresets, normalized.pomodoroPresets);
  }
  if (normalized.workoutRestSeconds !== null) {
    await setAppMetaJson(db, appMetaKeys.workoutRestSeconds, normalized.workoutRestSeconds);
  }
  if (normalized.notificationPreferences) {
    await setAppMetaJson(
      db,
      appMetaKeys.notificationPreferences,
      normalized.notificationPreferences,
    );
  }
  if (normalized.workoutPreferences) {
    await setAppMetaJson(db, appMetaKeys.workoutPreferences, normalized.workoutPreferences);
  }
  return normalized;
}

export type PendingThemeApplication = {
  mode: string | null;
  slots: Record<string, string> | null;
  signature: string;
  /** Settings V4: reminder preferences to replay into AsyncStorage after commit. */
  notifications?: {
    todoRemindersEnabled?: boolean;
    dailyPlanReminderTime?: TimeOfDay;
    weeklyReviewReminder?: RecoverableWeeklyReviewReminder | null;
  } | null;
};

/**
 * Durably stage the validated AsyncStorage-backed settings so they can be
 * updated AFTER the import transaction commits (SQLite cannot transactionally
 * commit AsyncStorage). The marker survives crashes; `applyPendingThemeApplication`
 * retries it until successful and only then clears it.
 */
export async function stagePendingThemeApplication(
  db: SQLite.SQLiteDatabase,
  payload: unknown,
  signature: string,
): Promise<void> {
  const normalized = normalizeRecoverableSettings(payload);
  await setAppMetaJson(db, appMetaKeys.backupPendingThemeApply, {
    mode: normalized.theme.mode,
    slots: normalized.theme.slots,
    signature,
    notifications: normalized.notificationPreferences
      ? {
          todoRemindersEnabled: normalized.notificationPreferences.todoRemindersEnabled,
          dailyPlanReminderTime: normalized.notificationPreferences.dailyPlanReminderTime,
          weeklyReviewReminder: normalized.notificationPreferences.weeklyReviewReminder,
        }
      : null,
  } satisfies PendingThemeApplication);
}

export async function readPendingThemeApplication(
  db: SQLite.SQLiteDatabase,
): Promise<PendingThemeApplication | null> {
  const stored = await getAppMetaJsonOrDefault<unknown>(
    db,
    appMetaKeys.backupPendingThemeApply,
    null,
  );
  if (!stored || typeof stored !== 'object') return null;
  const candidate = stored as Record<string, unknown>;
  if (
    (candidate.mode !== null && typeof candidate.mode !== 'string') ||
    (candidate.slots !== null && typeof candidate.slots !== 'object') ||
    typeof candidate.signature !== 'string'
  ) {
    return null;
  }
  return candidate as unknown as PendingThemeApplication;
}

/**
 * Apply staged AsyncStorage-backed settings and clear the durable marker ONLY
 * on success. Returns true when nothing is pending or the application
 * completed; false when the marker remains and must be retried (bootstrap
 * maintenance retries until it succeeds).
 */
export async function applyPendingThemeApplication(): Promise<boolean> {
  const db = await getDatabase();
  const pending = await readPendingThemeApplication(db);
  if (!pending) return true;
  try {
    if (pending.mode !== null) {
      await AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, pending.mode);
    }
    if (pending.slots !== null) {
      await AsyncStorage.setItem(THEME_SLOTS_STORAGE_KEY, JSON.stringify(pending.slots));
    }
    if (pending.notifications) {
      const n = pending.notifications;
      if (n.todoRemindersEnabled !== undefined) {
        await AsyncStorage.setItem(
          TODO_REMINDERS_ENABLED_KEY,
          n.todoRemindersEnabled ? 'enabled' : 'disabled',
        );
      }
      if (n.dailyPlanReminderTime !== undefined) {
        await AsyncStorage.setItem(
          DAILY_PLAN_REMINDER_TIME_KEY,
          formatTimeOfDay(n.dailyPlanReminderTime),
        );
      }
      if (n.weeklyReviewReminder !== undefined && n.weeklyReviewReminder !== null) {
        await AsyncStorage.setItem(
          WEEKLY_REVIEW_REMINDER_STORAGE_KEY,
          JSON.stringify(n.weeklyReviewReminder),
        );
      }
    }
    // Marker cleared only after every AsyncStorage write succeeded.
    await setAppMetaText(db, appMetaKeys.backupPendingThemeApply, 'null');
    return true;
  } catch {
    // AsyncStorage failed; the marker stays durable for the next retry.
    return false;
  }
}
