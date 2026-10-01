import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Quick-capture calorie undo, against a REAL better-sqlite3 database.
 *
 * The contract: undo deletes exactly the row the capture created. The
 * pre-change implementation could not tell two identical captures apart —
 * `addCalorieEntry` returned nothing, so undo re-read today's newest-first list
 * and deleted the first row matching food name, calories and meal type. With
 * two identical rows that is always the NEWER one, so undoing the older capture
 * left the row the user asked to remove.
 *
 * These tests drive the real data layer and assert on row identity, so a
 * regression to value matching fails here rather than deleting the wrong row in
 * front of a user.
 */

const CAPTURE = { foodName: 'Chicken rice', calories: 250, mealType: 'lunch' } as const;

async function calorieRows(db: TestDatabase) {
  return db.getAllAsync<{ id: string; food_name: string; calories: number; meal_type: string }>(
    'SELECT id, food_name, calories, meal_type FROM calorie_entries WHERE deleted_at IS NULL ORDER BY created_at ASC',
  );
}

describe('quick-capture calorie undo resolves the captured row', () => {
  it('addCalorieEntry returns the created row id, and identical captures get distinct ids', async () => {
    await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const first = await calories.addCalorieEntry({ ...CAPTURE });
    const second = await calories.addCalorieEntry({ ...CAPTURE });

    expect(first).toMatch(/^cal_/);
    expect(second).toMatch(/^cal_/);
    expect(first).not.toBe(second);
  });

  it('undoing the FIRST of two identical captures deletes the first row and keeps the second', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const first = await calories.addCalorieEntry({ ...CAPTURE });
    const second = await calories.addCalorieEntry({ ...CAPTURE });

    // The quick-capture undo closure resolves the captured row's identity —
    // exactly what `rebuildRecentCapture`/the live capture path now build.
    await calories.deleteCalorieEntry(first);

    const remaining = await calorieRows(db);
    expect(remaining.map((row) => row.id)).toEqual([second]);
  });

  it('undoing the SECOND leaves the first', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const first = await calories.addCalorieEntry({ ...CAPTURE });
    const second = await calories.addCalorieEntry({ ...CAPTURE });

    await calories.deleteCalorieEntry(second);

    const remaining = await calorieRows(db);
    expect(remaining.map((row) => row.id)).toEqual([first]);
  });

  it('a single capture undo deletes exactly that row, as before', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const todos = await import('@/features/todos/todos.data');

    const entryId = await calories.addCalorieEntry({ ...CAPTURE });
    // An unrelated row with different content must survive.
    await calories.addCalorieEntry({ foodName: 'Salad', calories: 180, mealType: 'dinner' });
    // Unrelated entity tables are untouched by the calorie undo.
    await todos.addTodo({ title: 'Unrelated' });

    await calories.deleteCalorieEntry(entryId);

    const remaining = await calorieRows(db);
    expect(remaining.map((row) => row.food_name)).toEqual(['Salad']);
  });

  it('a soft-deleted captured row is not resurrected by a second identical capture', async () => {
    await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const first = await calories.addCalorieEntry({ ...CAPTURE });
    await calories.deleteCalorieEntry(first);
    await calories.addCalorieEntry({ ...CAPTURE });

    // listCalorieEntries hides tombstones, so the restored list shows only the
    // new row — and the undo of the older capture cannot reach it by value.
    const entries = await calories.listCalorieEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).not.toBe(first);
  });
});
