import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

function shiftDateKey(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Past-only consumed-date contract against real SQLite.
 *
 * The command path rejects future calorie dates
 * (`Calorie logging is limited to today or a past local date.`), the diary
 * navigator caps at today, and every aggregate range ends at today — so a
 * future `consumed_on` row would be orphaned from the diary, summaries,
 * trends, heatmaps, and frequent foods with no error. The data-layer writers
 * fail closed instead: future creates, future day-moves, and future
 * linked-action logs throw and write nothing, while today/past writes are
 * unaffected.
 */
describe('calorie future-date rejection (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('rejects a future create without writing', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const tomorrow = shiftDateKey(1);

    await expect(
      calories.addCalorieEntry({
        foodName: 'Tomorrow feast',
        calories: 900,
        protein: 10,
        carbs: 10,
        fats: 10,
        fiber: 0,
        mealType: 'dinner',
        consumedOn: tomorrow,
      }),
    ).rejects.toThrow(/today or a past local date/);

    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Tomorrow feast' AND deleted_at IS NULL`,
    );
    expect(row).toBeNull();
  });

  it('still accepts today and past creates', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.addCalorieEntry({
      foodName: 'Today lunch',
      calories: 600,
      mealType: 'lunch',
      consumedOn: shiftDateKey(0),
    });
    await calories.addCalorieEntry({
      foodName: 'Yesterday dinner',
      calories: 700,
      mealType: 'dinner',
      consumedOn: shiftDateKey(-1),
    });

    const count = await db.getFirstAsync<{ value: number }>(
      `SELECT COUNT(*) AS value FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(count?.value).toBe(2);
  });

  it('rejects a future day-move without touching the stored entry', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const yesterday = shiftDateKey(-1);
    const tomorrow = shiftDateKey(1);

    await calories.addCalorieEntry({
      foodName: 'Staying put',
      calories: 300,
      mealType: 'snack',
      consumedOn: yesterday,
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Staying put'`,
    ))!.id;

    await expect(
      calories.updateCalorieEntry(id, {
        foodName: 'Staying put',
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
        consumedOn: tomorrow,
      }),
    ).rejects.toThrow(/today or a past local date/);

    const row = await db.getFirstAsync<{ consumed_on: string }>(
      'SELECT consumed_on FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.consumed_on).toBe(yesterday);
  });

  it('still allows same-day edits and past-to-today moves', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const yesterday = shiftDateKey(-1);
    const today = shiftDateKey(0);

    await calories.addCalorieEntry({
      foodName: 'Movable meal',
      calories: 400,
      mealType: 'lunch',
      consumedOn: yesterday,
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Movable meal'`,
    ))!.id;

    expect(
      await calories.updateCalorieEntry(id, {
        foodName: 'Movable meal v2',
        protein: 5,
        carbs: 5,
        fats: 5,
        fiber: 0,
        mealType: 'lunch',
        consumedOn: yesterday,
      }),
    ).toBe('updated');
    expect(
      await calories.updateCalorieEntry(id, {
        foodName: 'Movable meal v2',
        protein: 5,
        carbs: 5,
        fats: 5,
        fiber: 0,
        mealType: 'lunch',
        consumedOn: today,
      }),
    ).toBe('updated');

    const row = await db.getFirstAsync<{ consumed_on: string; food_name: string }>(
      'SELECT consumed_on, food_name FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.consumed_on).toBe(today);
    expect(row?.food_name).toBe('Movable meal v2');
  });

  it('rejects a future linked-action log without writing', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const tomorrow = shiftDateKey(1);

    await expect(
      calories.addCalorieEntryFromLinkedAction({
        id: 'cal_future_linked_1',
        foodName: 'Future fuel',
        calories: 250,
        protein: 5,
        carbs: 5,
        fats: 5,
        fiber: 0,
        mealType: 'breakfast',
        consumedOn: tomorrow,
      }),
    ).rejects.toThrow(/today or a past local date/);

    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE id = 'cal_future_linked_1' AND deleted_at IS NULL`,
    );
    expect(row).toBeNull();
  });

  it('still accepts a today linked-action log', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const result = await calories.addCalorieEntryFromLinkedAction({
      id: 'cal_today_linked_1',
      foodName: 'Today fuel',
      calories: 250,
      protein: 5,
      carbs: 5,
      fats: 5,
      fiber: 0,
      mealType: 'breakfast',
      consumedOn: shiftDateKey(0),
    });
    expect(result.status).toBe('applied');

    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE id = 'cal_today_linked_1' AND deleted_at IS NULL`,
    );
    expect(row?.id).toBe('cal_today_linked_1');
  });
});
