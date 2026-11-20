import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Copy-day must obey the SAME past-only consumed-date contract as every other
 * calorie writer.
 *
 * `assertConsumableDateKey` in `features/calories/calories.data.ts` states the
 * invariant: a forward-dated row is orphaned (the diary navigator caps at
 * today, every aggregate range ends at today, and `getCalorieSummaryByRange`
 * can never include it), so writers fail closed. `copyCalorieEntriesFromDay`
 * was the one create path with no such guard: it only rejected a source later
 * than the target, so a target after today happily wrote rows no surface can
 * reach — reachable from the diary when the local day moves BACKWARDS under an
 * explicitly selected historical day (the resolved write day clamps to today
 * while a non-UI caller can still pass the stale day).
 */
describe('copy-day rejects a target after the local today (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    vi.useRealTimers();
    await db?.closeAsync();
  });

  it('refuses a future target and writes no rows or backup intents', async () => {
    db = await freshDatabase();
    // Pin "today" so the assertion cannot depend on the host calendar.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 0));
    const calories = await import('@/features/calories/calories.data');

    await calories.addCalorieEntry({
      foodName: 'Monday oats',
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 6,
      fiber: 8,
      mealType: 'breakfast',
      consumedOn: '2026-11-09',
    });

    const result = await calories.copyCalorieEntriesFromDay('2026-11-09', '2026-11-17');

    expect(result).toEqual({ status: 'invalid-range', reason: 'target-after-today' });
    expect(
      await db.getAllAsync<{ id: string }>(
        `SELECT id FROM calorie_entries WHERE consumed_on = '2026-11-17'`,
      ),
    ).toEqual([]);
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM sync_outbox
         WHERE entity = 'calorie_entries' AND operation = 'create'`,
      ),
    ).toEqual({ count: 1 });
  });

  it('still copies into today and into any past day', async () => {
    db = await freshDatabase();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 10, 9, 0, 0));
    const calories = await import('@/features/calories/calories.data');

    await calories.addCalorieEntry({
      foodName: 'Sunday oats',
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 6,
      fiber: 8,
      mealType: 'breakfast',
      consumedOn: '2026-11-08',
    });

    expect(await calories.copyCalorieEntriesFromDay('2026-11-08')).toEqual({
      status: 'copied',
      copiedCount: 1,
    });
    expect(await calories.copyCalorieEntriesFromDay('2026-11-08', '2026-11-09')).toEqual({
      status: 'copied',
      copiedCount: 1,
    });

    const perDay = await db.getAllAsync<{ consumed_on: string; n: number }>(
      `SELECT consumed_on, COUNT(*) AS n
       FROM calorie_entries
       WHERE deleted_at IS NULL
       GROUP BY consumed_on
       ORDER BY consumed_on`,
    );
    expect(perDay).toEqual([
      { consumed_on: '2026-11-08', n: 1 },
      { consumed_on: '2026-11-09', n: 1 },
      { consumed_on: '2026-11-10', n: 1 },
    ]);
  });
});
