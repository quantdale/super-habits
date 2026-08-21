import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User-configurable default rest between sets, persisted in app_meta
 * (`workout_rest_seconds`) so it joins the recoverable Settings V3 backup.
 * The pre-V3 AsyncStorage key is imported once, then removed. The app_meta
 * read/write lives in the data layer (`workout.data.ts`); this module keeps
 * the pure clamp/constant contract and the legacy AsyncStorage reader so UI
 * and `core/backup` consumers have a stable, DB-free import site.
 */

/** Legacy device-local key; only read during the one-time import. */
export const LEGACY_REST_SECONDS_STORAGE_KEY = 'superhabits.workout.restSeconds';

export const REST_SECONDS_MIN = 5;
/** Aligned with the per-set rest ceiling in `validateSetTiming` (30 minutes). */
export const REST_SECONDS_MAX = 1800;
export const REST_SECONDS_STEP = 15;
/** Fallback when nothing is stored or the stored value is unusable. */
export const DEFAULT_REST_SECONDS = 60;

export function clampRestSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_REST_SECONDS;
  return Math.min(REST_SECONDS_MAX, Math.max(REST_SECONDS_MIN, Math.round(value)));
}

export function normalizeStoredRestSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? clampRestSeconds(value) : null;
}

export async function readLegacyStoredRestSeconds(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_REST_SECONDS_STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clampRestSeconds(parsed) : null;
  } catch {
    return null;
  }
}

// NOTE: the app_meta-backed load/save live in `workout.data.ts` (they touch
// SQLite). Import them from there — do NOT re-export them here, because
// `core/backup/backupSettings` imports this module and a data-layer back-edge
// would create an adapter → settings → workout.data → sync.engine → adapter
// import cycle that breaks `new SupabaseSyncAdapter()` at module scope.

