import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_PRESETS,
  findPresetById,
  normalizePomodoroPresets,
  shouldAutoStartNext,
  type PomodoroPreset,
} from '@/features/pomodoro/pomodoro.domain';

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { enqueueBackupSettingsRecord } = vi.hoisted(() => ({
  enqueueBackupSettingsRecord: vi.fn().mockResolvedValue(undefined),
}));

const asyncStorage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

vi.mock('@/core/db/client', () => ({
  getDatabase,
}));

vi.mock('@/core/sync/syncedMutation', () => ({
  enqueueBackupSettingsRecord,
}));

/** app_meta-aware double mirroring the real key/value SQL surface. */
function createAppMetaDb() {
  const meta = new Map<string, string>();
  return {
    meta,
    runAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      const p = params ?? [];
      if (sql.includes('app_meta') && sql.includes('INSERT OR REPLACE')) {
        meta.set(String(p[0]), String(p[1]));
      }
      return { changes: 1, lastInsertRowId: 1 };
    }),
    getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      const p = params ?? [];
      if (sql.includes('FROM app_meta')) {
        const value = meta.get(String(p[0]));
        return value === undefined ? null : { value };
      }
      return null;
    }),
    getAllAsync: vi.fn(async () => []),
  };
}

describe('normalizePomodoroPresets', () => {
  it('returns built-in presets for non-array input', () => {
    expect(normalizePomodoroPresets(null)).toEqual(BUILT_IN_PRESETS);
    expect(normalizePomodoroPresets('junk')).toEqual(BUILT_IN_PRESETS);
    expect(normalizePomodoroPresets({})).toEqual(BUILT_IN_PRESETS);
  });

  it('returns built-in presets for empty storage', () => {
    expect(normalizePomodoroPresets([])).toEqual(BUILT_IN_PRESETS);
  });

  it('drops malformed entries and keeps valid ones', () => {
    const result = normalizePomodoroPresets([
      null,
      'nope',
      { noId: true },
      {
        id: 'classic',
        name: 'Custom Classic',
        focusMinutes: 30,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLongBreak: 4,
        autoStartBreaks: true,
        autoStartFocus: false,
      },
    ]);
    expect(result).toHaveLength(3); // classic + the two missing built-ins
    const classic = result.find((p) => p.id === 'classic');
    expect(classic?.name).toBe('Custom Classic');
    expect(classic?.focusMinutes).toBe(30);
    expect(classic?.autoStartBreaks).toBe(true);
    // Built-ins are always present.
    expect(result.map((p) => p.id)).toContain('deep');
    expect(result.map((p) => p.id)).toContain('sprint');
  });

  it('clamps out-of-range values to fallbacks', () => {
    const result = normalizePomodoroPresets([
      { id: 'classic', focusMinutes: 999, shortBreakMinutes: -5, sessionsBeforeLongBreak: 1 },
    ]);
    const classic = result[0];
    expect(classic.focusMinutes).toBe(25);
    expect(classic.shortBreakMinutes).toBe(5);
    expect(classic.sessionsBeforeLongBreak).toBe(4);
  });

  it('deduplicates by id keeping the first occurrence', () => {
    const result = normalizePomodoroPresets([
      { id: 'classic', name: 'First' },
      { id: 'classic', name: 'Second' },
    ]);
    expect(result.filter((p) => p.id === 'classic')).toHaveLength(1);
    expect(result.find((p) => p.id === 'classic')?.name).toBe('First');
  });

  it('accepts custom (non-builtin) ids with sane defaults', () => {
    const result = normalizePomodoroPresets([{ id: 'custom-1', name: 'Mine' }]);
    const custom = result.find((p) => p.id === 'custom-1');
    expect(custom?.focusMinutes).toBe(25);
    expect(custom?.autoStartFocus).toBe(false);
  });
});

describe('findPresetById', () => {
  it('finds a preset by id', () => {
    expect(findPresetById(BUILT_IN_PRESETS, 'deep')?.name).toBe('Deep Work');
  });

  it('returns null for missing/null id', () => {
    expect(findPresetById(BUILT_IN_PRESETS, 'missing')).toBeNull();
    expect(findPresetById(BUILT_IN_PRESETS, null)).toBeNull();
    expect(findPresetById(BUILT_IN_PRESETS, undefined)).toBeNull();
  });
});

describe('shouldAutoStartNext', () => {
  const preset: PomodoroPreset = {
    ...BUILT_IN_PRESETS[0],
    autoStartBreaks: true,
    autoStartFocus: false,
  };

  it('uses autoStartBreaks after focus completes', () => {
    expect(shouldAutoStartNext('focus', preset)).toBe(true);
  });

  it('uses autoStartFocus after breaks complete', () => {
    expect(shouldAutoStartNext('short_break', preset)).toBe(false);
    expect(shouldAutoStartNext('long_break', preset)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Preset store on app_meta pomodoro_presets (Recoverable Settings V3 source)
// ---------------------------------------------------------------------------

describe('pomodoro.presets.store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.store.clear();
  });

  it('returns built-ins when neither app_meta nor legacy storage has data', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);

    const { getPomodoroPresetsState } = await import('@/features/pomodoro/pomodoro.presets.store');
    await expect(getPomodoroPresetsState()).resolves.toEqual({
      presets: BUILT_IN_PRESETS,
      activePresetId: null,
    });
  });

  it('imports legacy AsyncStorage storage once and retires the keys', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);
    asyncStorage.store.set(
      'superhabits.pomodoro.presets',
      JSON.stringify([{ id: 'classic', name: 'Custom Classic', focusMinutes: 30 }]),
    );
    asyncStorage.store.set('superhabits.pomodoro.activePresetId', 'classic');

    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    const state = await store.getPomodoroPresetsState();

    expect(state.activePresetId).toBe('classic');
    expect(state.presets.find((p) => p.id === 'classic')?.focusMinutes).toBe(30);
    expect(state.presets.map((p) => p.id)).toEqual(BUILT_IN_PRESETS.map((p) => p.id));
    // Legacy keys retired after import.
    expect(asyncStorage.store.has('superhabits.pomodoro.presets')).toBe(false);
    expect(asyncStorage.store.has('superhabits.pomodoro.activePresetId')).toBe(false);

    // Second read comes from app_meta without touching AsyncStorage again.
    asyncStorage.getItem.mockClear();
    const again = await store.getPomodoroPresetsState();
    expect(again).toEqual(state);
    expect(asyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('prefers app_meta over stale legacy keys and still cleans them up', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);
    db.meta.set(
      'pomodoro_presets',
      JSON.stringify({ presets: BUILT_IN_PRESETS, activePresetId: 'deep' }),
    );
    asyncStorage.store.set('superhabits.pomodoro.activePresetId', 'classic');

    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    const state = await store.getPomodoroPresetsState();
    expect(state.activePresetId).toBe('deep');
    expect(asyncStorage.store.has('superhabits.pomodoro.activePresetId')).toBe(false);
  });

  it('falls back to built-ins for corrupt app_meta payloads', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);
    db.meta.set('pomodoro_presets', '{not json');

    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    await expect(store.getPomodoroPresets()).resolves.toEqual(BUILT_IN_PRESETS);
  });

  it('validates setActivePresetId against the preset list and snapshots settings', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);

    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    await store.setActivePresetId('bogus');
    expect(db.meta.has('pomodoro_presets')).toBe(false);

    await store.setActivePresetId('sprint');
    const raw = db.meta.get('pomodoro_presets');
    expect(raw).not.toBeUndefined();
    expect(JSON.parse(raw as string)).toMatchObject({ activePresetId: 'sprint' });
    // Allowlisted settings snapshot enqueued for backup.
    expect(enqueueBackupSettingsRecord).toHaveBeenCalled();

    await store.clearActivePresetId();
    expect(JSON.parse(db.meta.get('pomodoro_presets') as string)).toMatchObject({
      activePresetId: null,
    });
  });

  it('keeps the active selection when saving a preset list that still contains it', async () => {
    const db = createAppMetaDb();
    getDatabase.mockResolvedValue(db);

    const store = await import('@/features/pomodoro/pomodoro.presets.store');
    await store.setActivePresetId('deep');
    await store.savePomodoroPresets([
      ...BUILT_IN_PRESETS,
      { ...BUILT_IN_PRESETS[0], id: 'custom-1', name: 'Mine' },
    ]);

    const saved = JSON.parse(db.meta.get('pomodoro_presets') as string);
    expect(saved.activePresetId).toBe('deep');
    expect(saved.presets.map((p: PomodoroPreset) => p.id)).toContain('custom-1');
  });
});
