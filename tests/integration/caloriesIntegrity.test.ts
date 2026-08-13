import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

describe('calorie authoritative ledger integrity', () => {
  it('reports success when saved-meal cache maintenance fails after the ledger commits', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    await db.execAsync('DROP TABLE saved_meals');

    await expect(
      calories.addCalorieEntry({
        foodName: 'cache failure meal',
        calories: 500,
        protein: 25,
        carbs: 50,
        fats: 15,
        fiber: 4,
        mealType: 'dinner',
        consumedOn: '2026-08-14',
      }),
    ).resolves.toBeUndefined();

    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM calorie_entries
         WHERE food_name = 'cache failure meal' AND deleted_at IS NULL`,
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('does not mutate cache or enqueue sync for a stale calorie update', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const result = await calories.updateCalorieEntry('cal_missing', {
      foodName: 'missing',
      protein: 1,
      carbs: 1,
      fats: 1,
      fiber: 0,
      mealType: 'snack',
    });

    expect(result).toBe('not_found');
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM sync_outbox
         WHERE entity = 'calorie_entries' AND id = 'cal_missing'`,
      ),
    ).toEqual({ count: 0 });
    await db.closeAsync();
  });

  it('does not enqueue a delete for an already missing or deleted entry', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    expect(await calories.deleteCalorieEntry('cal_missing')).toBe('not_found');
    expect(
      await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM sync_outbox
         WHERE entity = 'calorie_entries' AND id = 'cal_missing' AND operation = 'delete'`,
      ),
    ).toEqual({ count: 0 });
    await db.closeAsync();
  });
});
