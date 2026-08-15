import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as SQLite from 'expo-sqlite';
import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import {
  DEFAULT_SETTINGS as DEFAULT_POMODORO_SETTINGS,
  normalizePomodoroSettings,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';
import { DEFAULT_CALORIE_GOAL, normalizeCalorieGoal } from '@/features/calories/calories.domain';
import type { CalorieGoal } from '@/features/calories/types';
import { type RecoverableSettingsV2 } from '@/core/backup/backup.types';

const THEME_MODE_STORAGE_KEY = 'superhabits.theme.mode';
const THEME_SLOTS_STORAGE_KEY = 'superhabits.theme.slots.v2';

export const THEME_MODES = ['light', 'dark', 'system'] as const;

/**
 * The recoverable settings allowlist. Only these keys are ever backed up or
 * restored; auth/sync/system/device state never enters the payload.
 */
export function buildRecoverableSettings(input: {
  calorieGoal: CalorieGoal | null;
  pomodoroSettings: PomodoroSettings | null;
  themeMode: string | null;
  themeSlots: Record<string, string> | null;
}): RecoverableSettingsV2 {
  return {
    calorieGoal: input.calorieGoal,
    pomodoroSettings: input.pomodoroSettings,
    theme: {
      mode: input.themeMode,
      slots: input.themeSlots,
    },
  };
}

/**
 * Validate and normalize an untrusted settings payload. Unknown keys are
 * dropped; malformed known keys fall back to defaults via the feature
 * normalizers so a poisoned payload cannot corrupt local settings.
 */
export function normalizeRecoverableSettings(input: unknown): RecoverableSettingsV2 {
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
  return {
    calorieGoal,
    pomodoroSettings,
    theme: { mode, slots },
  };
}

export function isValidRecoverableSettings(input: unknown): input is RecoverableSettingsV2 {
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
  return true;
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

/** Read the current allowlisted settings snapshot (used at push time). */
export async function readRecoverableSettings(
  db: SQLite.SQLiteDatabase,
): Promise<RecoverableSettingsV2> {
  const [calorieGoal, pomodoroSettings, theme] = await Promise.all([
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
    readThemeSnapshot(),
  ]);
  return buildRecoverableSettings({
    calorieGoal,
    pomodoroSettings,
    themeMode: theme.mode,
    themeSlots: theme.slots,
  });
}

/**
 * Apply a validated settings payload to local storage (restore path only).
 * Theme writes are fire-and-forget like the provider's own persistence.
 */
export async function applyRecoverableSettings(
  db: SQLite.SQLiteDatabase,
  payload: unknown,
): Promise<RecoverableSettingsV2> {
  const normalized = normalizeRecoverableSettings(payload);
  if (normalized.calorieGoal) {
    await setAppMetaJson(db, appMetaKeys.calorieGoal, normalized.calorieGoal);
  }
  if (normalized.pomodoroSettings) {
    await setAppMetaJson(db, appMetaKeys.pomodoroSettings, normalized.pomodoroSettings);
  }
  if (normalized.theme.mode) {
    void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, normalized.theme.mode).catch(() => undefined);
  }
  if (normalized.theme.slots) {
    void AsyncStorage.setItem(
      THEME_SLOTS_STORAGE_KEY,
      JSON.stringify(normalized.theme.slots),
    ).catch(() => undefined);
  }
  return normalized;
}
