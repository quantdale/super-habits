import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import { resolveCalorieLogDateKey } from '@/features/calories/calories.domain';
import { toDateKey } from '@/lib/time';

/**
 * Audit C #14: the Calories manual form logged to an implicit "today" while the
 * Diary day navigator was parked on a past day, so a meal added from Form mode
 * landed on the wrong calendar day and the diary header kept showing the older
 * day's totals.
 *
 * The screen now derives ONE day key (`resolveCalorieLogDateKey`) and passes it
 * to `addCalorieEntry` as `consumedOn` on every create path. These oracles
 * pin the write contract those paths depend on: the selected day is honoured,
 * today is only the fallback, and a future selection can never produce the row
 * the data layer rejects.
 */
describe('Calories form logging day (real SQLite)', () => {
  it('writes the selected past day, not today', async () => {
    const db = await freshDatabase();
    try {
      const calories = await import('@/features/calories/calories.data');
      const today = toDateKey();
      const selected = '2026-10-06';
      // Precondition: the non-UTC/UTC boundary cannot make these equal.
      expect(selected < today).toBe(true);

      const logDateKey = resolveCalorieLogDateKey(selected, today);
      expect(logDateKey).toBe(selected);

      await calories.addCalorieEntry({
        foodName: 'Backfilled toast',
        calories: 180,
        protein: 6,
        carbs: 30,
        fats: 4,
        fiber: 3,
        mealType: 'breakfast',
        consumedOn: logDateKey,
      });

      const rows = await db.getAllAsync<{ consumed_on: string }>(
        'SELECT consumed_on FROM calorie_entries WHERE deleted_at IS NULL',
      );
      expect(rows).toEqual([{ consumed_on: selected }]);

      // The selected day's summary is where the entry shows up, and today's
      // stays empty — the exact two facts the audited bug mixed up.
      const selectedSummary = await calories.getCalorieSummaryByRange(selected, selected);
      expect(selectedSummary).toHaveLength(1);
      expect(selectedSummary[0]).toMatchObject({ dateKey: selected, totalCalories: 180 });
      const todaySummary = await calories.getCalorieSummaryByRange(today, today);
      expect(todaySummary).toEqual([]);
    } finally {
      await db.closeAsync();
    }
  });

  it('falls back to today when nothing is selected, and never writes the future', async () => {
    const db = await freshDatabase();
    try {
      const calories = await import('@/features/calories/calories.data');
      const today = toDateKey();

      expect(resolveCalorieLogDateKey(null, today)).toBe(today);
      const tomorrow = resolveCalorieLogDateKey('2999-01-01', today);
      expect(tomorrow).toBe(today);

      await calories.addCalorieEntry({
        foodName: 'Default-day oats',
        calories: 200,
        protein: 8,
        carbs: 34,
        fats: 4,
        fiber: 5,
        mealType: 'breakfast',
        consumedOn: resolveCalorieLogDateKey(null, today),
      });

      expect(
        await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM calorie_entries WHERE consumed_on = ? AND deleted_at IS NULL',
          [today],
        ),
      ).toEqual({ n: 1 });
      // Nothing landed on a future date.
      expect(
        await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM calorie_entries WHERE consumed_on > ?',
          [today],
        ),
      ).toEqual({ n: 0 });
    } finally {
      await db.closeAsync();
    }
  });
});
