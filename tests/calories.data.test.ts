import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDatabase } from '@/core/db/client';
import { syncEngine } from '@/core/sync/sync.engine';
import { createId } from '@/lib/id';
import { nowIso, toDateKey } from '@/lib/time';
import {
  addCalorieEntry,
  deleteCalorieEntry,
  getCalorieGoal,
  setCalorieGoal,
  updateCalorieEntry,
  upsertSavedMeal,
} from '@/features/calories/calories.data';

vi.mock('@/core/db/client', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/core/sync/sync.engine', () => ({
  syncEngine: {
    enqueue: vi.fn(),
    prepare: vi.fn((record: Record<string, unknown>) => ({ ...record, revision: 1 })),
    enqueuePrepared: vi.fn(),
  },
}));

vi.mock('@/lib/id', () => ({
  createId: vi.fn(),
}));

vi.mock('@/lib/time', () => ({
  nowIso: vi.fn(),
  toDateKey: vi.fn(),
}));

const db = {
  runAsync: vi.fn(),
  getFirstAsync: vi.fn(),
  getAllAsync: vi.fn(),
};

describe('calories.data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    vi.mocked(nowIso).mockReturnValue('2026-04-06T10:00:00.000Z');
    vi.mocked(toDateKey).mockReturnValue('2026-04-06');
    db.runAsync.mockResolvedValue({ changes: 1 });
    // Backup Completeness V2: upsertSavedMeal writes through an atomic
    // INSERT ... RETURNING id statement (getFirstAsync) instead of runAsync,
    // and the surrounding transaction reads the outbox owner via getFirstAsync.
    db.getFirstAsync.mockImplementation(async (sql: string) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO saved_meals')) {
        return { id: 'smeal_test' };
      }
      return null;
    });
  });

  it('addCalorieEntry inserts the entry, saves the meal, and enqueues create', async () => {
    vi.mocked(createId).mockReturnValueOnce('cal_1').mockReturnValueOnce('smeal_1');
    db.getFirstAsync.mockResolvedValueOnce(null);

    await addCalorieEntry({
      foodName: 'Chicken breast',
      calories: 220,
      protein: 40,
      carbs: 0,
      fats: 5,
      fiber: 0,
      mealType: 'lunch',
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO calorie_entries'),
      [
        'cal_1',
        'Chicken breast',
        220,
        40,
        0,
        5,
        0,
        'lunch',
        '2026-04-06',
        '2026-04-06T10:00:00.000Z',
        '2026-04-06T10:00:00.000Z',
      ],
    );
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO saved_meals'),
      [
        'smeal_1',
        'Chicken breast',
        220,
        40,
        0,
        5,
        0,
        'lunch',
        '2026-04-06T10:00:00.000Z',
        '2026-04-06T10:00:00.000Z',
      ],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'calorie_entries',
        id: 'cal_1',
        updatedAt: '2026-04-06T10:00:00.000Z',
        operation: 'create',
        revision: 1,
      },
      { durablyPersisted: true },
    );
  });

  it('updateCalorieEntry recalculates calories, updates saved meals, and enqueues update', async () => {
    vi.mocked(createId).mockReturnValueOnce('smeal_2');
    db.getFirstAsync.mockResolvedValueOnce(null);

    await updateCalorieEntry('cal_1', {
      foodName: 'Protein oats',
      protein: 30,
      carbs: 40,
      fats: 10,
      fiber: 5,
      mealType: 'breakfast',
    });

    expect(db.runAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE calorie_entries SET'),
      ['Protein oats', 360, 30, 40, 10, 5, 'breakfast', '2026-04-06T10:00:00.000Z', 'cal_1'],
    );
    expect(db.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO saved_meals'),
      [
        'smeal_2',
        'Protein oats',
        360,
        30,
        40,
        10,
        5,
        'breakfast',
        '2026-04-06T10:00:00.000Z',
        '2026-04-06T10:00:00.000Z',
      ],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'calorie_entries',
        id: 'cal_1',
        updatedAt: '2026-04-06T10:00:00.000Z',
        operation: 'update',
        revision: 1,
      },
      { durablyPersisted: true },
    );
  });

  it('deleteCalorieEntry soft-deletes the row and enqueues delete', async () => {
    await deleteCalorieEntry('cal_9');

    expect(db.runAsync).toHaveBeenCalledWith(
      'UPDATE calorie_entries SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      ['2026-04-06T10:00:00.000Z', '2026-04-06T10:00:00.000Z', 'cal_9'],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'calorie_entries',
        id: 'cal_9',
        updatedAt: '2026-04-06T10:00:00.000Z',
        operation: 'delete',
        revision: 1,
      },
      { durablyPersisted: true },
    );
  });

  it('upsertSavedMeal issues a single atomic case-insensitive upsert', async () => {
    vi.mocked(createId).mockReturnValue('smeal_new');

    await upsertSavedMeal({
      foodName: 'Protein oats',
      calories: 360,
      protein: 30,
      carbs: 40,
      fats: 10,
      fiber: 5,
      mealType: 'breakfast',
    });

    // COR-001: one INSERT ... ON CONFLICT statement instead of the old
    // read-then-branch, which raced idx_saved_meals_food_name. The upsert now
    // runs through getFirstAsync with a RETURNING id clause, so assert the
    // single atomic statement there rather than counting runAsync calls (the
    // surrounding backup transaction also writes sync_outbox + app_meta rows).
    const savedMealUpserts = db.getFirstAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO saved_meals'),
    );
    expect(savedMealUpserts).toHaveLength(1);
    const [sql, args] = savedMealUpserts[0];
    expect(sql).toContain('INSERT INTO saved_meals');
    expect(sql).toContain('ON CONFLICT(food_name COLLATE NOCASE) DO UPDATE SET');
    expect(sql).toContain('use_count    = use_count + 1');
    expect(args).toEqual([
      'smeal_new',
      'Protein oats',
      360,
      30,
      40,
      10,
      5,
      'breakfast',
      '2026-04-06T10:00:00.000Z',
      '2026-04-06T10:00:00.000Z',
    ]);
  });

  it('upsertSavedMeal returns early for blank names', async () => {
    await upsertSavedMeal({
      foodName: '   ',
      calories: 100,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'snack',
    });

    expect(getDatabase).not.toHaveBeenCalled();
    expect(db.getFirstAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('getCalorieGoal falls back to the default goal when the row is missing or invalid', async () => {
    db.getFirstAsync.mockResolvedValueOnce(null).mockResolvedValueOnce({
      value: '{not valid json}',
    });

    await expect(getCalorieGoal()).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
    await expect(getCalorieGoal()).resolves.toEqual({
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 65,
    });
  });

  it('setCalorieGoal stores the goal through app_meta JSON serialization', async () => {
    await setCalorieGoal({
      calories: 2300,
      protein: 180,
      carbs: 240,
      fats: 70,
    });

    expect(db.runAsync).toHaveBeenCalledWith(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
      [
        'calorie_goal',
        JSON.stringify({
          calories: 2300,
          protein: 180,
          carbs: 240,
          fats: 70,
        }),
      ],
    );
  });
});

describe('copyCalorieEntriesFromDay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    vi.mocked(nowIso).mockReturnValue('2026-04-06T10:00:00.000Z');
    vi.mocked(toDateKey).mockReturnValue('2026-04-06');
    db.runAsync.mockResolvedValue({ changes: 1 });
    db.getFirstAsync.mockImplementation(async () => null);
  });

  it('duplicates source entries into the target day with fresh ids and create records', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([
      {
        id: 'cal_src1',
        food_name: 'Oats',
        calories: 300,
        protein: 10,
        carbs: 50,
        fats: 6,
        fiber: 8,
        meal_type: 'breakfast',
        consumed_on: '2026-04-05',
        created_at: '2026-04-05T08:00:00.000Z',
        updated_at: '2026-04-05T08:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'cal_src2',
        food_name: 'Chicken breast',
        calories: 220,
        protein: 40,
        carbs: 0,
        fats: 5,
        fiber: 0,
        meal_type: 'lunch',
        consumed_on: '2026-04-05',
        created_at: '2026-04-05T12:00:00.000Z',
        updated_at: '2026-04-05T12:00:00.000Z',
        deleted_at: null,
      },
    ]);
    vi.mocked(createId).mockReturnValueOnce('cal_new1').mockReturnValueOnce('cal_new2');

    const copied = await copyCalorieEntriesFromDay('2026-04-05', '2026-04-06');

    expect(copied).toBe(2);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('consumed_on = ?'), [
      '2026-04-05',
    ]);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO calorie_entries'),
      [
        'cal_new1',
        'Oats',
        300,
        10,
        50,
        6,
        8,
        'breakfast',
        '2026-04-06',
        '2026-04-06T10:00:00.000Z',
        '2026-04-06T10:00:00.000Z',
      ],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'calorie_entries',
        id: 'cal_new2',
        updatedAt: '2026-04-06T10:00:00.000Z',
        operation: 'create',
        revision: 1,
      },
      { durablyPersisted: true },
    );
  });

  it('copies nothing when the source day is empty', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([]);

    await expect(copyCalorieEntriesFromDay('2026-04-01')).resolves.toBe(0);
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
  });
});
