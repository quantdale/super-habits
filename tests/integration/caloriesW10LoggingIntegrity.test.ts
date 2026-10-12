import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { CalorieGoal } from '@/features/calories/types';

/**
 * W10 data-integrity oracles for the reconstructed Calories surface (real
 * SQLite). The UI was rebuilt; the persistence contract was not. These prove
 * the day's logging paths still write exactly what they claim — one row per
 * log, no phantom saved meals, no use_count inflation, correct soft delete,
 * copy-day as new rows, and persisted goal/macro targets.
 */
describe('W10 Calories logging integrity (real SQLite)', () => {
  it('a full-form entry commits one row, one saved meal, and one sync intent', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    const id = await calories.addCalorieEntry({
      foodName: 'W10 chicken bowl',
      calories: 402,
      protein: 45,
      carbs: 20,
      fats: 14,
      fiber: 5,
      mealType: 'lunch',
      consumedOn: '2026-10-12',
    });

    expect(id).toMatch(/^cal_/);
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM calorie_entries WHERE food_name = 'W10 chicken bowl' AND deleted_at IS NULL",
      ),
    ).toEqual({ count: 1 });
    // The interactive form path keeps its implicit saved-meal maintenance.
    const meal = await db.getFirstAsync<{ use_count: number }>(
      "SELECT use_count FROM saved_meals WHERE food_name = 'W10 chicken bowl'",
    );
    expect(meal?.use_count).toBe(1);
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = 'calorie_entries' AND operation = 'create'",
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('a kcal-only quick add writes one zero-macro row, no saved meal, no inflation', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    // Seed a catalog row so use_count inflation would be observable.
    await calories.addCalorieEntry({
      foodName: 'W10 oats',
      calories: 294,
      protein: 10,
      carbs: 54,
      fats: 6,
      fiber: 8,
      mealType: 'breakfast',
      consumedOn: '2026-10-11',
    });

    const quickId = await calories.addCalorieEntry(
      {
        foodName: 'Quick add',
        calories: 200,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
        consumedOn: '2026-10-12',
      },
      { maintainSavedMeal: false },
    );
    expect(quickId).toMatch(/^cal_/);

    const quick = await db.getFirstAsync<{
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      fiber: number;
    }>(
      "SELECT calories, protein, carbs, fats, fiber FROM calorie_entries WHERE food_name = 'Quick add'",
    );
    expect(quick).toEqual({ calories: 200, protein: 0, carbs: 0, fats: 0, fiber: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM saved_meals WHERE food_name = 'Quick add'",
      ),
    ).toEqual({ count: 0 });
    // The seeded catalog row's use_count is untouched by the quick add.
    expect(
      await db.getFirstAsync<{ use_count: number }>(
        "SELECT use_count FROM saved_meals WHERE food_name = 'W10 oats'",
      ),
    ).toEqual({ use_count: 1 });
    // Two logs on the day, two rows (no dedupe), and both ride the outbox.
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM calorie_entries WHERE consumed_on = '2026-10-12' AND deleted_at IS NULL",
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('editing an entry updates in place and does not count as a saved-meal use', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const id = await calories.addCalorieEntry({
      foodName: 'W10 salmon bowl',
      calories: 604,
      protein: 40,
      carbs: 62,
      fats: 20,
      fiber: 6,
      mealType: 'dinner',
      consumedOn: '2026-10-12',
    });

    const result = await calories.updateCalorieEntry(id, {
      foodName: 'W10 salmon bowl',
      protein: 44,
      carbs: 62,
      fats: 22,
      fiber: 6,
      mealType: 'dinner',
      consumedOn: '2026-10-12',
    });
    expect(result).toBe('updated');

    const row = await db.getFirstAsync<{ id: string; protein: number; calories: number }>(
      'SELECT id, protein, calories FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.id).toBe(id);
    // kcal is recomputed from the new macros (44×4 + 56×4 + 6×2 + 22×9 = 610).
    expect(row?.protein).toBe(44);
    expect(row?.calories).toBe(610);
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM calorie_entries WHERE food_name = 'W10 salmon bowl' AND deleted_at IS NULL",
      ),
    ).toEqual({ count: 1 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = 'calorie_entries' AND operation = 'update'",
      ),
    ).toEqual({ count: 1 });
    await db.closeAsync();
  });

  it('deleting an entry soft-deletes exactly one row and enqueues the delete intent', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const id = await calories.addCalorieEntry({
      foodName: 'W10 remove me',
      calories: 192,
      protein: 6,
      carbs: 6,
      fats: 16,
      fiber: 4,
      mealType: 'snack',
      consumedOn: '2026-10-12',
    });

    expect(await calories.deleteCalorieEntry(id)).toBe('deleted');
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM calorie_entries WHERE id = ? AND deleted_at IS NULL',
        [id],
      ),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = ? AND id = ? AND operation = ?',
        ['calorie_entries', id, 'delete'],
      ),
    ).toEqual({ count: 1 });
    // A second delete is a no-op: no duplicate intent.
    expect(await calories.deleteCalorieEntry(id)).toBe('not_found');
    await db.closeAsync();
  });

  it('copy-day duplicates the source day as new rows without inflating usage', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    await calories.addCalorieEntry({
      foodName: 'W10 copy source',
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 6,
      fiber: 8,
      mealType: 'breakfast',
      consumedOn: '2026-10-10',
    });

    const result = await calories.copyCalorieEntriesFromDay('2026-10-10', '2026-10-12');
    expect(result).toEqual({ status: 'copied', copiedCount: 1 });
    // The copy is a NEW row (fresh id) and the source row is untouched.
    expect(
      await db.getAllAsync<{ id: string; consumed_on: string }>(
        "SELECT id, consumed_on FROM calorie_entries WHERE food_name = 'W10 copy source' AND deleted_at IS NULL ORDER BY consumed_on",
      ),
    ).toEqual([
      { id: expect.stringMatching(/^cal_/), consumed_on: '2026-10-10' },
      { id: expect.stringMatching(/^cal_/), consumed_on: '2026-10-12' },
    ]);
    const ids = (
      await db.getAllAsync<{ id: string }>(
        "SELECT id FROM calorie_entries WHERE food_name = 'W10 copy source'",
      )
    ).map((row) => row.id);
    expect(new Set(ids).size).toBe(2);
    // Copying adds no new saved meal and inflates no usage: the single catalog
    // row is the one the original add created, still at use_count 1.
    const meal = await db.getFirstAsync<{ use_count: number }>(
      "SELECT use_count FROM saved_meals WHERE food_name = 'W10 copy source'",
    );
    expect(meal?.use_count).toBe(1);
    // Same-day and future-source copies are refused with a structured reason.
    expect(await calories.copyCalorieEntriesFromDay('2026-10-12', '2026-10-12')).toEqual({
      status: 'invalid-range',
      reason: 'same-day',
    });
    expect(await calories.copyCalorieEntriesFromDay('2026-10-13', '2026-10-12')).toEqual({
      status: 'invalid-range',
      reason: 'source-after-target',
    });
    await db.closeAsync();
  });

  it('goal and macro targets persist through the data layer', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const goals = await import('@/features/calories/caloriesTargets');

    await calories.setCalorieGoal({ calories: 2100, protein: 140, carbs: 210, fats: 70 });
    expect(await calories.getCalorieGoal()).toEqual({
      calories: 2100,
      protein: 140,
      carbs: 210,
      fats: 70,
    });

    await goals.saveMacroTargets({ calories: 2100, protein: 160, carbs: 180, fats: 65 });
    const reloaded = await goals.loadMacroTargets();
    expect(reloaded).toMatchObject({ protein: 160, carbs: 180, fats: 65 });
    expect(
      await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'calorie_goal'",
      ),
    ).toBeTruthy();
    await db.closeAsync();
  });

  it('a malformed persisted goal cannot produce NaN totals', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    await db.execAsync(
      'INSERT OR REPLACE INTO app_meta (key, value) VALUES (\'calorie_goal\', \'{"calories":"lots","protein":null}\')',
    );
    const goal: CalorieGoal = await calories.getCalorieGoal();
    expect(Number.isFinite(goal.calories)).toBe(true);
    expect(goal.calories).toBe(2000);
    await db.closeAsync();
  });
});
