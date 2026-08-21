import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clampRestSeconds,
  DEFAULT_REST_SECONDS,
  LEGACY_REST_SECONDS_STORAGE_KEY,
  REST_SECONDS_MAX,
  REST_SECONDS_MIN,
} from '@/features/workout/restTimerPreferences';
// The app_meta-backed load/save live in the data layer (they touch SQLite);
// restTimerPreferences deliberately does not re-export them (import-cycle
// safety for core/backup/backupSettings).
import {
  loadRestSecondsDefault,
  saveRestSecondsDefault,
} from '@/features/workout/workout.data';

const { getItem, removeItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem, removeItem },
}));

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

/** Minimal fake exposing just the app_meta surface the preference store uses. */
function makeMetaDb() {
  const meta = new Map<string, string>();
  const db = {
    meta,
    getFirstAsync: vi.fn(async (_sql: string, params?: readonly unknown[]) => {
      const value = meta.get(params?.[0] as string);
      return value === undefined ? null : { value };
    }),
    runAsync: vi.fn(async (_sql: string, params?: readonly unknown[]) => {
      meta.set(params?.[0] as string, params?.[1] as string);
      return { changes: 1, lastInsertRowId: 1 };
    }),
  };
  getDatabase.mockResolvedValue(db);
  return db;
}

describe('clampRestSeconds', () => {
  it('clamps to the shared 30-minute ceiling (aligned with per-set validation)', () => {
    expect(REST_SECONDS_MAX).toBe(1800);
    expect(clampRestSeconds(5000)).toBe(1800);
    expect(clampRestSeconds(1800)).toBe(1800);
  });

  it('clamps to the minimum and rounds fractional input', () => {
    expect(REST_SECONDS_MIN).toBe(5);
    expect(clampRestSeconds(1)).toBe(5);
    expect(clampRestSeconds(90.4)).toBe(90);
  });

  it('falls back to the default for non-finite input', () => {
    expect(clampRestSeconds(Number.NaN)).toBe(DEFAULT_REST_SECONDS);
    expect(clampRestSeconds(Number.POSITIVE_INFINITY)).toBe(DEFAULT_REST_SECONDS);
  });
});

describe('loadRestSecondsDefault / saveRestSecondsDefault (app_meta workout_rest_seconds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeItem.mockResolvedValue(undefined);
  });

  it('returns the default and seeds app_meta when nothing is stored', async () => {
    const db = makeMetaDb();
    await expect(loadRestSecondsDefault()).resolves.toBe(DEFAULT_REST_SECONDS);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(DEFAULT_REST_SECONDS);
    // No legacy key present: nothing is imported, nothing is removed.
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('round-trips a saved value through app_meta', async () => {
    const db = makeMetaDb();
    await saveRestSecondsDefault(90);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(90);
    await expect(loadRestSecondsDefault()).resolves.toBe(90);
  });

  it('clamps out-of-range saves to the documented boundaries', async () => {
    const db = makeMetaDb();
    await saveRestSecondsDefault(9999);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(REST_SECONDS_MAX);
    await saveRestSecondsDefault(0);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(REST_SECONDS_MIN);
  });

  it('imports a legacy AsyncStorage value once, then removes the old key', async () => {
    const db = makeMetaDb();
    getItem.mockResolvedValue('45');

    await expect(loadRestSecondsDefault()).resolves.toBe(45);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(45);
    expect(removeItem).toHaveBeenCalledWith(LEGACY_REST_SECONDS_STORAGE_KEY);

    // Second load reads app_meta only — the import is one-time/idempotent.
    getItem.mockClear();
    await expect(loadRestSecondsDefault()).resolves.toBe(45);
    expect(getItem).not.toHaveBeenCalled();
  });

  it('ignores unusable legacy values and stores the default instead', async () => {
    const db = makeMetaDb();
    getItem.mockResolvedValue('not-a-number');
    await expect(loadRestSecondsDefault()).resolves.toBe(DEFAULT_REST_SECONDS);
    expect(JSON.parse(db.meta.get('workout_rest_seconds')!)).toBe(DEFAULT_REST_SECONDS);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('falls back to a corrupt app_meta payload via re-import/default', async () => {
    const db = makeMetaDb();
    db.meta.set('workout_rest_seconds', '{broken json');
    getItem.mockResolvedValue(null);
    await expect(loadRestSecondsDefault()).resolves.toBe(DEFAULT_REST_SECONDS);
  });

  it('still serves the legacy value when the database is unavailable', async () => {
    getDatabase.mockRejectedValue(new Error('db not ready'));
    getItem.mockResolvedValue('120');
    await expect(loadRestSecondsDefault()).resolves.toBe(120);
  });
});
