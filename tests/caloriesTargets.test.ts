import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { appMetaKeys } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { enqueueBackupSettingsRecord } from '@/core/sync/syncedMutation';
import {
  CALORIES_TARGETS_STORAGE_KEY,
  loadMacroTargets,
  saveMacroTargets,
} from '@/features/calories/caloriesTargets';

vi.mock('@/core/db/client', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/sync/syncedMutation', () => ({
  enqueueBackupSettingsRecord: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const db = {
  runAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  getAllAsync: vi.fn(),
};

const TARGETS = { calories: 2400, protein: 180, carbs: 220, fats: 70 };
const APP_META_UPSERT = 'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)';

describe('caloriesTargets (app_meta calorie_targets store)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    // Default environment: no app_meta row, no legacy AsyncStorage value.
    db.getFirstAsync.mockResolvedValue(null);
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    db.runAsync.mockResolvedValue({ changes: 1 });
  });

  it('round-trips save/load through app_meta calorie_targets and re-captures the settings snapshot', async () => {
    await saveMacroTargets(TARGETS);

    expect(db.runAsync).toHaveBeenCalledWith(APP_META_UPSERT, [
      appMetaKeys.calorieTargets.key,
      JSON.stringify(TARGETS),
    ]);
    expect(enqueueBackupSettingsRecord).toHaveBeenCalledWith(db);

    db.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(TARGETS) });
    await expect(loadMacroTargets()).resolves.toEqual(TARGETS);
    // A stored value must win over any legacy import.
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  });

  it('returns null for malformed JSON in app_meta', async () => {
    db.getFirstAsync.mockResolvedValueOnce({ value: '{not valid json' });

    await expect(loadMacroTargets()).resolves.toBeNull();
  });

  it('returns null for non-object payloads', async () => {
    db.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify('junk') });
    await expect(loadMacroTargets()).resolves.toBeNull();

    db.getFirstAsync.mockResolvedValueOnce({ value: '42' });
    await expect(loadMacroTargets()).resolves.toBeNull();
  });

  it('returns null for objects without numeric fields', async () => {
    db.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify({ protein: 'high' }) });

    await expect(loadMacroTargets()).resolves.toBeNull();
  });

  it('clamps out-of-range fields via normalizeCalorieGoal bounds', async () => {
    db.getFirstAsync.mockResolvedValueOnce({
      value: JSON.stringify({ calories: 99_999, protein: -5 }),
    });

    await expect(loadMacroTargets()).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
  });

  describe('legacy AsyncStorage import (superhabits.calories.targets)', () => {
    it('imports the legacy key once, writes app_meta first, then removes the legacy key', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(TARGETS));

      await expect(loadMacroTargets()).resolves.toEqual(TARGETS);

      expect(db.runAsync).toHaveBeenCalledWith(APP_META_UPSERT, [
        appMetaKeys.calorieTargets.key,
        JSON.stringify(TARGETS),
      ]);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CALORIES_TARGETS_STORAGE_KEY);
    });

    it('is idempotent: an app_meta value short-circuits the legacy import', async () => {
      db.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(TARGETS) });

      await expect(loadMacroTargets()).resolves.toEqual(TARGETS);

      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('drops a malformed legacy value without writing app_meta', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue('{oops');

      await expect(loadMacroTargets()).resolves.toBeNull();

      expect(db.runAsync).not.toHaveBeenCalledWith(APP_META_UPSERT, expect.anything());
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CALORIES_TARGETS_STORAGE_KEY);
    });

    it('keeps the legacy key when the app_meta write fails (no data loss)', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(TARGETS));
      db.runAsync.mockRejectedValueOnce(new Error('disk full'));

      await expect(loadMacroTargets()).resolves.toBeNull();

      // Write-before-remove ordering: the legacy value survives for a retry.
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('ignores AsyncStorage read failures', async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('unavailable'));

      await expect(loadMacroTargets()).resolves.toBeNull();
    });
  });

  describe('saveMacroTargets validation', () => {
    it('rejects payloads without numeric fields instead of persisting junk', async () => {
      await expect(saveMacroTargets({} as never)).rejects.toThrow('Invalid macro targets payload.');

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(enqueueBackupSettingsRecord).not.toHaveBeenCalled();
    });
  });
});
