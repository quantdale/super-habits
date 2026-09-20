import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Calorie-ledger write-contract hole against real SQLite.
 *
 * The entry form rejects empty/over-long food names, negative/over-range
 * macros, and zero/over-range kcal (`Food name is required.` et al.), but the
 * data layer asserted only the consumed date — so non-UI writers (quick
 * capture, command executor, linked-action effects) could land invalid rows
 * in the ledger, diary aggregates, frequent-food chips, and backup payloads.
 * The data-layer writers now fail closed with the exact UI messages and
 * write nothing, while valid writes on all three paths are unaffected.
 */
describe('calorie entry write validation (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('rejects invalid creates without writing', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await expect(
      calories.addCalorieEntry({ foodName: '   ', calories: 300, mealType: 'lunch' }),
    ).rejects.toThrow('Food name is required.');
    await expect(
      calories.addCalorieEntry({
        foodName: 'A'.repeat(101),
        calories: 300,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Food name must be 100 characters or less.');
    await expect(
      calories.addCalorieEntry({
        foodName: 'Bad protein',
        calories: 300,
        protein: -5,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Protein must be 0 or greater.');
    await expect(
      calories.addCalorieEntry({
        foodName: 'Too much fat',
        calories: 300,
        fats: 1000,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Fats value seems too high (max 999g).');
    await expect(
      calories.addCalorieEntry({ foodName: 'Zero kcal', calories: 0, mealType: 'snack' }),
    ).rejects.toThrow('Enter macro amounts so calories are greater than zero.');
    await expect(
      calories.addCalorieEntry({ foodName: 'Huge meal', calories: 10000, mealType: 'dinner' }),
    ).rejects.toThrow('Calories cannot exceed 9999 kcal.');

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM calorie_entries WHERE deleted_at IS NULL',
    );
    expect(count?.count).toBe(0);
  });

  it('rejects an invalid update without mutating the existing row', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.addCalorieEntry({
      foodName: 'Good meal',
      calories: 400,
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 2,
      mealType: 'lunch',
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Good meal'`,
    ))!.id;

    await expect(
      calories.updateCalorieEntry(id, {
        foodName: '',
        protein: 20,
        carbs: 30,
        fats: 10,
        fiber: 2,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Food name is required.');
    await expect(
      calories.updateCalorieEntry(id, {
        foodName: 'Good meal',
        protein: 20,
        carbs: 30,
        fats: 10,
        fiber: 2000,
        mealType: 'lunch',
      }),
    ).rejects.toThrow('Fiber value seems too high (max 999g).');

    const row = await db.getFirstAsync<{ food_name: string; fiber: number }>(
      'SELECT food_name, fiber FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.food_name).toBe('Good meal');
    expect(row?.fiber).toBe(2);
  });

  it('rejects an invalid linked-action log without writing', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const { toDateKey } = await import('@/lib/time');

    await expect(
      calories.addCalorieEntryFromLinkedAction({
        id: 'cal_invalid_linked_1',
        foodName: '',
        calories: 250,
        protein: 5,
        carbs: 5,
        fats: 5,
        fiber: 0,
        mealType: 'breakfast',
        consumedOn: toDateKey(),
      }),
    ).rejects.toThrow('Food name is required.');

    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE id = 'cal_invalid_linked_1' AND deleted_at IS NULL`,
    );
    expect(row).toBeNull();
  });

  it('still accepts valid writes on all three paths', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const { toDateKey } = await import('@/lib/time');
    const today = toDateKey();

    await calories.addCalorieEntry({
      foodName: 'Form meal',
      calories: 500,
      protein: 25,
      carbs: 40,
      fats: 15,
      fiber: 3,
      mealType: 'dinner',
      consumedOn: today,
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Form meal'`,
    ))!.id;

    expect(
      await calories.updateCalorieEntry(id, {
        foodName: 'Form meal v2',
        protein: 26,
        carbs: 41,
        fats: 15,
        fiber: 3,
        mealType: 'dinner',
      }),
    ).toBe('updated');

    const linked = await calories.addCalorieEntryFromLinkedAction({
      id: 'cal_valid_linked_1',
      foodName: 'Auto breakfast',
      calories: 350,
      protein: 15,
      carbs: 45,
      fats: 8,
      fiber: 5,
      mealType: 'breakfast',
      consumedOn: today,
    });
    expect(linked.status).toBe('applied');

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM calorie_entries WHERE deleted_at IS NULL',
    );
    expect(count?.count).toBe(2);
  });
});
