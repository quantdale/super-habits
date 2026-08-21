import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * One-time migration of the pre-v20 AsyncStorage pause/archive id sets into
 * the durable `habits.status` column (F2). The data layer is mocked so these
 * tests assert the import contract: which habits transition, that deleted
 * ids are skipped, that the legacy keys are retired only on success, and
 * that a failed import retries instead of dropping user intent.
 */

const asyncStorageState = vi.hoisted(() => ({
  map: new Map<string, string>(),
  removed: [] as string[],
}));

const habitsData = vi.hoisted(() => ({
  listHabits: vi.fn(),
  pauseHabit: vi.fn(),
  archiveHabit: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStorageState.map.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      asyncStorageState.removed.push(key);
      asyncStorageState.map.delete(key);
    }),
  },
}));

vi.mock('@/features/habits/habits.data', () => ({
  listHabits: habitsData.listHabits,
  pauseHabit: habitsData.pauseHabit,
  archiveHabit: habitsData.archiveHabit,
}));

const PAUSED_KEY = 'superhabits.habits.pausedIds';
const ARCHIVED_KEY = 'superhabits.habits.archivedIds';

function setLegacySets(pausedIds: string[], archivedIds: string[]): void {
  asyncStorageState.map.set(PAUSED_KEY, JSON.stringify(pausedIds));
  asyncStorageState.map.set(ARCHIVED_KEY, JSON.stringify(archivedIds));
}

async function loadStore() {
  // The module caches its in-flight import promise, so every test re-imports
  // it after resetModules for a fresh one-shot state.
  return await import('@/features/habits/habitLifecycle.store');
}

describe('migrateLegacyHabitLifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    asyncStorageState.map.clear();
    asyncStorageState.removed = [];
    habitsData.pauseHabit.mockResolvedValue(true);
    habitsData.archiveHabit.mockResolvedValue(true);
  });

  it('imports live paused/archived ids into the status column and retires the keys', async () => {
    setLegacySets(['habit_paused'], ['habit_archived']);
    habitsData.listHabits.mockResolvedValue([
      { id: 'habit_paused', name: 'P' },
      { id: 'habit_archived', name: 'A' },
    ]);

    const { migrateLegacyHabitLifecycle } = await loadStore();
    await migrateLegacyHabitLifecycle();

    expect(habitsData.archiveHabit).toHaveBeenCalledWith('habit_archived');
    expect(habitsData.pauseHabit).toHaveBeenCalledWith('habit_paused');
    expect(asyncStorageState.removed).toEqual(expect.arrayContaining([PAUSED_KEY, ARCHIVED_KEY]));
    expect(asyncStorageState.map.has(PAUSED_KEY)).toBe(false);
  });

  it('skips ids whose habits no longer exist and keeps states exclusive', async () => {
    setLegacySets(['habit_gone', 'habit_both'], ['habit_both']);
    habitsData.listHabits.mockResolvedValue([{ id: 'habit_both', name: 'B' }]);

    const { migrateLegacyHabitLifecycle } = await loadStore();
    await migrateLegacyHabitLifecycle();

    expect(habitsData.pauseHabit).not.toHaveBeenCalled();
    expect(habitsData.archiveHabit).toHaveBeenCalledTimes(1);
    expect(habitsData.archiveHabit).toHaveBeenCalledWith('habit_both');
  });

  it('is a no-op once the legacy keys are gone', async () => {
    const { migrateLegacyHabitLifecycle } = await loadStore();

    await migrateLegacyHabitLifecycle();
    await migrateLegacyHabitLifecycle();

    expect(habitsData.listHabits).not.toHaveBeenCalled();
    expect(habitsData.pauseHabit).not.toHaveBeenCalled();
    expect(habitsData.archiveHabit).not.toHaveBeenCalled();
  });

  it('keeps the legacy keys when an import fails so a later call can retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setLegacySets([], ['habit_archived']);
    habitsData.listHabits.mockResolvedValue([{ id: 'habit_archived', name: 'A' }]);
    habitsData.archiveHabit.mockRejectedValueOnce(new Error('db locked'));

    const { migrateLegacyHabitLifecycle } = await loadStore();
    await migrateLegacyHabitLifecycle();

    expect(asyncStorageState.removed).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();

    // Retry after the transient failure completes the import.
    habitsData.archiveHabit.mockResolvedValueOnce(true);
    await migrateLegacyHabitLifecycle();
    expect(habitsData.archiveHabit).toHaveBeenCalledWith('habit_archived');
    expect(asyncStorageState.removed).toEqual(expect.arrayContaining([ARCHIVED_KEY]));
    errorSpy.mockRestore();
  });
});
