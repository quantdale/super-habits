import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Saved-meal write-contract hole against real SQLite.
 *
 * The calories form rejects empty/over-long food names, bad macros, and
 * bad kcal (`Food name is required.` et al.), but `upsertSavedMeal`
 * silently returns on blank names and performs no macro/kcal/meal-type
 * checks — so direct callers (seeders, future writers, any non-ledger
 * path) can land invalid rows in the `saved_meals` catalog, the
 * recent/frequent chips, and backup payloads. The direct upsert path
 * must fail closed with the exact UI messages and write nothing,
 * while valid upserts (NOCASE coalesce + use_count bump + backup
 * enqueue) are unaffected.
 */
describe('saved meal write validation (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('rejects blank food names with the exact UI message instead of silently dropping', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await expect(
      calories.upsertSavedMeal({
        foodName: '   ',
        calories: 100,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
      }),
    ).rejects.toThrow('Food name is required.');

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM saved_meals',
    );
    expect(count?.count).toBe(0);
  });

  it('rejects invalid macros/kcal/mealType without writing', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await expect(
      calories.upsertSavedMeal({
        foodName: 'A'.repeat(101),
        calories: 300,
        protein: 10,
        carbs: 10,
        fats: 10,
        fiber: 0,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Food name must be 100 characters or less.');
    await expect(
      calories.upsertSavedMeal({
        foodName: 'Bad protein',
        calories: 300,
        protein: -5,
        carbs: 10,
        fats: 10,
        fiber: 0,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Protein must be 0 or greater.');
    await expect(
      calories.upsertSavedMeal({
        foodName: 'Too much fat',
        calories: 300,
        protein: 10,
        carbs: 10,
        fats: 1000,
        fiber: 0,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Fats value seems too high (max 999g).');
    await expect(
      calories.upsertSavedMeal({
        foodName: 'Zero kcal',
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
      }),
    ).rejects.toThrow('Enter macro amounts so calories are greater than zero.');
    await expect(
      calories.upsertSavedMeal({
        foodName: 'Huge meal',
        calories: 10000,
        protein: 10,
        carbs: 10,
        fats: 10,
        fiber: 0,
        mealType: 'dinner',
      }),
    ).rejects.toThrow('Calories cannot exceed 9999 kcal.');
    await expect(
      calories.upsertSavedMeal({
        foodName: 'Brunch special',
        calories: 300,
        protein: 10,
        carbs: 10,
        fats: 10,
        fiber: 0,
        mealType: 'brunch',
      }),
    ).rejects.toThrow('Choose a supported meal type.');

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM saved_meals',
    );
    expect(count?.count).toBe(0);
  });

  it('rejects an invalid upsert without mutating the existing row', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.upsertSavedMeal({
      foodName: 'Good meal',
      calories: 400,
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 2,
      mealType: 'lunch',
    });

    await expect(
      calories.upsertSavedMeal({
        foodName: 'Good meal',
        calories: 400,
        protein: 20,
        carbs: 30,
        fats: 1000,
        fiber: 2,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Fats value seems too high (max 999g).');

    const row = await db.getFirstAsync<{ fats: number; use_count: number }>(
      'SELECT fats, use_count FROM saved_meals WHERE food_name = ?',
      ['Good meal'],
    );
    expect(row?.fats).toBe(10);
    expect(Number(row?.use_count)).toBe(1);
  });

  it('still accepts valid upserts (NOCASE coalesce + use_count bump)', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.upsertSavedMeal({
      foodName: 'Chicken Breast',
      calories: 300,
      protein: 30,
      carbs: 0,
      fats: 20,
      fiber: 0,
      mealType: 'lunch',
    });
    await calories.upsertSavedMeal({
      foodName: 'chicken breast',
      calories: 320,
      protein: 32,
      carbs: 0,
      fats: 21,
      fiber: 0,
      mealType: 'dinner',
    });

    const rows = await db.getAllAsync<{
      id: string;
      food_name: string;
      calories: number;
      use_count: number;
    }>('SELECT id, food_name, calories, use_count FROM saved_meals');
    expect(rows).toHaveLength(1);
    expect(rows[0].food_name).toBe('Chicken Breast');
    expect(rows[0].calories).toBe(320);
    expect(Number(rows[0].use_count)).toBe(2);
  });
});
