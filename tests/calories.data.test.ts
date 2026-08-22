import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDatabase } from '@/core/db/client';
import { syncEngine } from '@/core/sync/sync.engine';
import { getSupabaseSessionUserId } from '@/lib/supabase';
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

// Keep the real date-key helpers (isValidDateKey etc.) — only the clock-backed
// functions are faked.
vi.mock('@/lib/time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/time')>()),
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

  it('addCalorieEntry inserts the entry and maintains the saved meal on the default form path', async () => {
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

  it('quick-add path (maintainSavedMeal: false) writes the ledger but never touches saved_meals', async () => {
    vi.mocked(createId).mockReturnValueOnce('cal_quick');

    await addCalorieEntry(
      {
        foodName: 'Quick add',
        calories: 150,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
      },
      { maintainSavedMeal: false },
    );

    // The one-off entry itself still commits and rides the sync outbox...
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO calorie_entries'),
      [
        'cal_quick',
        'Quick add',
        150,
        0,
        0,
        0,
        0,
        'snack',
        '2026-04-06',
        '2026-04-06T10:00:00.000Z',
        '2026-04-06T10:00:00.000Z',
      ],
    );
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledWith(
      {
        entity: 'calorie_entries',
        id: 'cal_quick',
        updatedAt: '2026-04-06T10:00:00.000Z',
        operation: 'create',
        revision: 1,
      },
      { durablyPersisted: true },
    );
    // ...but a one-off quick log must not create/update the saved-meal
    // catalog: no phantom "Quick add" row, no use_count inflation.
    const savedMealStatements = db.getFirstAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('saved_meals'),
    );
    expect(savedMealStatements).toHaveLength(0);
  });

  it('addCalorieEntryFromLinkedAction logs once without touching saved_meals', async () => {
    const { addCalorieEntryFromLinkedAction } = await import('@/features/calories/calories.data');
    db.getFirstAsync.mockResolvedValue(null);

    const result = await addCalorieEntryFromLinkedAction({
      id: 'cal_link_1',
      foodName: 'Automated snack',
      calories: 180,
      protein: 4,
      carbs: 20,
      fats: 8,
      fiber: 2,
      mealType: 'snack',
      consumedOn: '2026-04-06',
    });

    expect(result).toMatchObject({ status: 'applied', producedEntityId: 'cal_link_1' });
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO calorie_entries'),
      expect.arrayContaining(['cal_link_1', 'Automated snack']),
    );
    const savedMealStatements = db.getFirstAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('saved_meals'),
    );
    expect(savedMealStatements).toHaveLength(0);
  });

  it('updateCalorieEntry recalculates calories, enqueues update, and never touches saved meals', async () => {
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
    // Editing an existing ledger entry is not a "use": no catalog statement
    // may run at all, so use_count and last_used_at stay untouched.
    const savedMealStatements = [...db.getFirstAsync.mock.calls, ...db.runAsync.mock.calls].filter(
      ([sql]) => typeof sql === 'string' && sql.includes('saved_meals'),
    );
    expect(savedMealStatements).toHaveLength(0);
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
  const sourceEntry = (id: string, foodName: string, createdAt: string) => ({
    id,
    food_name: foodName,
    calories: 300,
    protein: 10,
    carbs: 50,
    fats: 6,
    fiber: 8,
    meal_type: 'breakfast',
    consumed_on: '2026-04-05',
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  });

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
      sourceEntry('cal_src1', 'Oats', '2026-04-05T08:00:00.000Z'),
      sourceEntry('cal_src2', 'Chicken breast', '2026-04-05T12:00:00.000Z'),
    ]);
    vi.mocked(createId).mockReturnValueOnce('cal_new1').mockReturnValueOnce('cal_new2');

    await expect(copyCalorieEntriesFromDay('2026-04-05', '2026-04-06')).resolves.toEqual({
      status: 'copied',
      copiedCount: 2,
    });
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

  it('runs the whole batch as ONE backup mutation (single owner resolution)', async () => {
    // Finding 2 pin: read + all inserts + all enqueues share one
    // runBackupMutation. The old per-row loop resolved the sync owner once per
    // entry; the collapsed transaction resolves it exactly once.
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([
      sourceEntry('cal_src1', 'Oats', '2026-04-05T08:00:00.000Z'),
      sourceEntry('cal_src2', 'Chicken breast', '2026-04-05T12:00:00.000Z'),
      sourceEntry('cal_src3', 'Greek yogurt', '2026-04-05T18:00:00.000Z'),
    ]);
    vi.mocked(createId)
      .mockReturnValueOnce('cal_new1')
      .mockReturnValueOnce('cal_new2')
      .mockReturnValueOnce('cal_new3');

    await copyCalorieEntriesFromDay('2026-04-05', '2026-04-06');

    expect(vi.mocked(getSupabaseSessionUserId)).toHaveBeenCalledTimes(1);
    const inserts = db.runAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO calorie_entries'),
    );
    expect(inserts).toHaveLength(3);
    // Every copy carries the single batch timestamp captured once up front.
    for (const [, args] of inserts) {
      expect(args[9]).toBe('2026-04-06T10:00:00.000Z');
    }
    expect(syncEngine.enqueuePrepared).toHaveBeenCalledTimes(3);
  });

  it('rolls back the whole batch when an insert fails mid-copy', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([
      sourceEntry('cal_src1', 'Oats', '2026-04-05T08:00:00.000Z'),
      sourceEntry('cal_src2', 'Chicken breast', '2026-04-05T12:00:00.000Z'),
    ]);
    vi.mocked(createId).mockReturnValueOnce('cal_new1').mockReturnValueOnce('cal_new2');
    let insertCount = 0;
    db.runAsync.mockImplementation(async (sql: unknown) => {
      if (typeof sql === 'string' && sql.includes('INSERT INTO calorie_entries')) {
        insertCount += 1;
        if (insertCount === 2) throw new Error('disk full');
      }
      return { changes: 1 };
    });

    await expect(copyCalorieEntriesFromDay('2026-04-05', '2026-04-06')).rejects.toThrow(
      'disk full',
    );

    // Both inserts were attempted inside the single transaction...
    expect(insertCount).toBe(2);
    // ...but the transaction never committed, so no durable intent may reach
    // the in-memory sync queue — never a silent partial copy.
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
  });

  it('reports source-empty without writing when the source day has no entries', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([]);

    await expect(copyCalorieEntriesFromDay('2026-04-01')).resolves.toEqual({
      status: 'source-empty',
    });
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
  });

  it('defaults the target day to today', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([sourceEntry('cal_src1', 'Oats', '2026-04-01T08:00:00Z')]);
    vi.mocked(createId).mockReturnValueOnce('cal_new1');

    await expect(copyCalorieEntriesFromDay('2026-04-01')).resolves.toEqual({
      status: 'copied',
      copiedCount: 1,
    });

    const inserts = db.runAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO calorie_entries'),
    );
    expect(inserts).toHaveLength(1);
    // consumed_on = mocked today key.
    expect(inserts[0][1][8]).toBe('2026-04-06');
  });

  it('rejects same-day copies without touching the database', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');

    await expect(copyCalorieEntriesFromDay('2026-04-06', '2026-04-06')).resolves.toEqual({
      status: 'invalid-range',
      reason: 'same-day',
    });
    expect(db.getAllAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(syncEngine.enqueuePrepared).not.toHaveBeenCalled();
  });

  it('rejects source-after-target copies', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');

    await expect(copyCalorieEntriesFromDay('2026-04-07', '2026-04-06')).resolves.toEqual({
      status: 'invalid-range',
      reason: 'source-after-target',
    });
    expect(db.getAllAsync).not.toHaveBeenCalled();
  });

  it.each(['2026-13-40', 'not-a-date', '20260406'])(
    'rejects malformed date keys (%s) for source and target',
    async (badKey) => {
      const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');

      await expect(copyCalorieEntriesFromDay(badKey, '2026-04-06')).resolves.toEqual({
        status: 'invalid-range',
        reason: 'malformed-date-key',
      });
      await expect(copyCalorieEntriesFromDay('2026-04-05', badKey)).resolves.toEqual({
        status: 'invalid-range',
        reason: 'malformed-date-key',
      });
      expect(db.getAllAsync).not.toHaveBeenCalled();
    },
  );

  it('emits no saved_meals writes (copying must not inflate use_count)', async () => {
    const { copyCalorieEntriesFromDay } = await import('@/features/calories/calories.data');
    db.getAllAsync.mockResolvedValueOnce([sourceEntry('cal_src1', 'Oats', '2026-04-05T08:00:00Z')]);
    vi.mocked(createId).mockReturnValueOnce('cal_new1');

    await copyCalorieEntriesFromDay('2026-04-05', '2026-04-06');

    const savedMealWrites = db.runAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('saved_meals'),
    );
    const savedMealReads = db.getFirstAsync.mock.calls.filter(
      ([sql]) => typeof sql === 'string' && sql.includes('saved_meals'),
    );
    expect(savedMealWrites).toHaveLength(0);
    expect(savedMealReads).toHaveLength(0);
  });
});

describe('searchSavedMeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
    db.getAllAsync.mockResolvedValue([]);
  });

  it('caps the unfiltered catalog load at 500 rows', async () => {
    const { searchSavedMeals } = await import('@/features/calories/calories.data');

    await searchSavedMeals('');

    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'), [500]);
  });

  it('leaves named searches uncapped', async () => {
    const { searchSavedMeals } = await import('@/features/calories/calories.data');

    await searchSavedMeals('oats');

    const [sql, args] = db.getAllAsync.mock.calls[0];
    expect(sql).toContain('LIKE');
    expect(sql).not.toContain('LIMIT');
    expect(args).toEqual(['%oats%']);
  });
});
