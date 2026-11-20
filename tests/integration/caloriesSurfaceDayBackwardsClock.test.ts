import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * The Calories surface has ONE day: the day it SHOWS and the day it WRITES to.
 *
 * Confirmed defect (previously an unconfirmed lead): the screen resolved a
 * write-safe day (`resolveCalorieLogDateKey`, which clamps a future selection to
 * today) but kept reading/displaying the RAW selection. So a clock or timezone
 * move BACKWARDS past an explicitly selected historical day (D9b keeps an
 * explicit selection pinned) left the diary visibly on, say, 2026-11-10 while a
 * meal typed into the form on that screen landed on 2026-11-08 — absent from
 * the day log beneath it, and "copy a previous day" then failed outright
 * because its target had become a future day.
 *
 * The write now uses `resolveCalorieSurfaceDay`, the same resolved value the
 * surface displays, so the meal always lands on the visible day (or, when the
 * selection became impossible, the surface itself shows today).
 */
describe('Calories surface day survives a backwards clock/timezone move (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    vi.useRealTimers();
    await db?.closeAsync();
  });

  it('logs the form entry onto the day the diary is showing, not an invisible day', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const { resolveCalorieSurfaceDay } = await import('@/features/calories/calories.domain');

    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 1. At 2026-11-18 the user explicitly opens 2026-11-10 (a past day).
    vi.setSystemTime(new Date(2026, 10, 18, 23, 40, 0));
    const selectedDateKey = '2026-11-10';
    await calories.addCalorieEntry({
      foodName: 'Backfilled lunch',
      calories: 500,
      protein: 30,
      carbs: 40,
      fats: 15,
      fiber: 5,
      mealType: 'lunch',
      consumedOn: selectedDateKey,
    });

    // 2. The clock moves BACKWARDS past that day (e.g. a timezone change).
    vi.setSystemTime(new Date(2026, 10, 8, 0, 30, 0));
    const todayKey = '2026-11-08';

    // 3. The surface resolves the day it shows (= what the writes use).
    const surfaceDateKey = resolveCalorieSurfaceDay(selectedDateKey, todayKey);
    expect(surfaceDateKey).toBe(todayKey);

    // 4. A form submit lands on that SAME day.
    await calories.addCalorieEntry({
      foodName: 'Form entry',
      calories: 300,
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 3,
      mealType: 'breakfast',
      consumedOn: surfaceDateKey,
    });

    // The visible day log contains what was just typed. (Pre-fix this read
    // `selectedDateKey` and showed only 'Backfilled lunch'.)
    const visible = await calories.listCalorieEntries(surfaceDateKey);
    expect(visible.map((entry) => entry.food_name)).toContain('Form entry');

    // Nothing was filed onto the now-unreachable day: the pre-existing
    // backfilled row is still the only row there.
    const onSelection = await calories.listCalorieEntries(selectedDateKey);
    expect(onSelection.map((entry) => entry.food_name)).toEqual(['Backfilled lunch']);
    expect(
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Form entry'`,
      ),
    ).toEqual({ n: 1 });
  });

  it('copy-day into the visible day still works after the backwards move', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const { resolveCalorieSurfaceDay } = await import('@/features/calories/calories.domain');

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 10, 18, 23, 40, 0));
    await calories.addCalorieEntry({
      foodName: 'Copied oats',
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 6,
      fiber: 8,
      mealType: 'breakfast',
      consumedOn: '2026-11-01',
    });

    vi.setSystemTime(new Date(2026, 10, 8, 0, 30, 0));
    const surfaceDateKey = resolveCalorieSurfaceDay('2026-11-10', '2026-11-08');
    expect(surfaceDateKey).toBe('2026-11-08');

    // The screen's copy handler targets `surfaceDateKey`; that must succeed.
    expect(await calories.copyCalorieEntriesFromDay('2026-11-01', surfaceDateKey)).toEqual({
      status: 'copied',
      copiedCount: 1,
    });
  });
});
