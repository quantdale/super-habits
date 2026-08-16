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
  normalizePomodoroSettings,
  type PomodoroSettings,
} from '@/features/pomodoro/pomodoro.domain';
import { DEFAULT_CALORIE_GOAL, normalizeCalorieGoal } from '@/features/calories/calories.domain';
import type { CalorieGoal } from '@/features/calories/types';
import { sha256Hex } from '@/lib/checksum';
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
export function canonicalizeSettingsPayload(payload: unknown): string {
  return sha256Hex(canonicalSettingsPayloadText(payload));
}

/**
 * Canonical TEXT form of the allowlisted settings payload (the exact string
 * that `canonicalizeSettingsPayload` hashes). Exported so the portable
 * backup envelope can cover the same canonical settings text in its payload
 * checksum; the checksum itself is byte-identical either way.
 */
export function canonicalSettingsPayloadText(payload: unknown): string {
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
  return JSON.stringify(canonical);
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
 * Apply the SQLite-backed recoverable settings (calorie goal + pomodoro
 * defaults) to app_meta — restore import path, called INSIDE the import
 * transaction. Theme settings live in AsyncStorage and cannot join the SQLite
 * transaction; stage them with `stagePendingThemeApplication` in the same
 * transaction and apply after commit with restart reconciliation.
 */
export async function applyRecoverableSettingsToSqlite(
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
  return normalized;
}

export type PendingThemeApplication = {
  mode: string | null;
  slots: Record<string, string> | null;
  signature: string;
};

/**
 * Durably stage the validated theme settings so AsyncStorage can be updated
 * AFTER the import transaction commits (SQLite cannot transactionally commit
 * AsyncStorage). The marker survives crashes; `applyPendingThemeApplication`
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
 * Apply a staged theme application to AsyncStorage and clear the durable
 * marker ONLY on success. Returns true when nothing is pending or the
 * application completed; false when the marker remains and must be retried
 * (bootstrap maintenance retries until it succeeds).
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
    // Marker cleared only after both AsyncStorage writes succeeded.
    await setAppMetaText(db, appMetaKeys.backupPendingThemeApply, 'null');
    return true;
  } catch {
    // AsyncStorage failed; the marker stays durable for the next retry.
    return false;
  }
}
