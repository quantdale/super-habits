import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

function shiftDateKey(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/**
 * Calorie entry day-correction against real SQLite: the entry moves IN PLACE
 * (same id, one coalesced update intent), both day ledgers reflect the move,
 * and invalid dates fail without touching the row.
 */
describe('calorie entry day correction (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('moves an entry between days preserving identity and coalescing one intent', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const yesterday = shiftDateKey(-1);
    const today = shiftDateKey(0);

    await calories.addCalorieEntry({
      foodName: 'Wrong-day soup',
      calories: 400,
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 4,
      mealType: 'dinner',
      consumedOn: yesterday,
    });
    const before = await db.getFirstAsync<{ id: string; consumed_on: string }>(
      `SELECT id, consumed_on FROM calorie_entries WHERE food_name = 'Wrong-day soup'`,
    );
    expect(before?.consumed_on).toBe(yesterday);

    const result = await calories.updateCalorieEntry(before!.id, {
      foodName: 'Wrong-day soup',
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 4,
      mealType: 'dinner',
    });
    expect(result).toBe('updated');

    const moved = await calories.updateCalorieEntry(before!.id, {
      foodName: 'Wrong-day soup',
      protein: 20,
      carbs: 30,
      fats: 10,
      fiber: 4,
      mealType: 'dinner',
      consumedOn: today,
    });
    expect(moved).toBe('updated');

    const row = await db.getFirstAsync<{ id: string; consumed_on: string; calories: number }>(
      'SELECT id, consumed_on, calories FROM calorie_entries WHERE id = ?',
      [before!.id],
    );
    expect(row?.id).toBe(before!.id);
    expect(row?.consumed_on).toBe(today);

    const yesterdayEntries = await calories.listCalorieEntries(yesterday);
    const todayEntries = await calories.listCalorieEntries(today);
    expect(yesterdayEntries.filter((e) => e.id === before!.id)).toHaveLength(0);
    expect(todayEntries.filter((e) => e.id === before!.id)).toHaveLength(1);

    // Exactly one coalesced durable intent for the entity row, operation update.
    const intents = await db.getAllAsync<{ operation: string }>(
      'SELECT operation FROM sync_outbox WHERE entity = ? AND id = ?',
      ['calorie_entries', before!.id],
    );
    expect(intents).toHaveLength(1);
    expect(intents[0].operation).toBe('update');
  });

  it('handles month boundaries and repeated saves without duplicates', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const monthEnd = '2026-07-31';
    const nextMonthStart = '2026-08-01';

    await calories.addCalorieEntry({
      foodName: 'Boundary snack',
      calories: 120,
      protein: 1,
      carbs: 20,
      fats: 3,
      fiber: 0,
      mealType: 'snack',
      consumedOn: monthEnd,
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Boundary snack'`,
    ))!.id;

    const edits = {
      foodName: 'Boundary snack',
      protein: 1,
      carbs: 20,
      fats: 3,
      fiber: 0,
      mealType: 'snack' as const,
      consumedOn: nextMonthStart,
    };
    expect(await calories.updateCalorieEntry(id, edits)).toBe('updated');
    expect(await calories.updateCalorieEntry(id, edits)).toBe('updated');

    expect(await calories.listCalorieEntries(monthEnd)).toHaveLength(0);
    const moved = await calories.listCalorieEntries(nextMonthStart);
    expect(moved.filter((e) => e.id === id)).toHaveLength(1);
  });

  it('rejects an invalid day without touching the stored entry', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const yesterday = shiftDateKey(-1);

    await calories.addCalorieEntry({
      foodName: 'Kept entry',
      calories: 100,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'snack',
      consumedOn: yesterday,
    });
    const id = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Kept entry'`,
    ))!.id;

    await expect(
      calories.updateCalorieEntry(id, {
        foodName: 'Kept entry',
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
        consumedOn: '2026-13-45',
      }),
    ).rejects.toThrow(/YYYY-MM-DD/);

    const row = await db.getFirstAsync<{ consumed_on: string }>(
      'SELECT consumed_on FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.consumed_on).toBe(yesterday);
  });
});
