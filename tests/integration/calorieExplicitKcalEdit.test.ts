import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Explicit-kcal edit contract (real SQLite): a row may carry explicit calories
 * that its macros cannot derive (command path "500 calories ... 20g protein",
 * linked actions, saved-meal reuse). While an edit leaves the macros alone,
 * the stored kcal must survive; only an actual macro change recomputes kcal.
 */
describe('explicit kcal survives macro-preserving edits (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function addExplicitKcalEntry(): Promise<string> {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    await calories.addCalorieEntry({
      foodName: 'Chicken bowl',
      calories: 500,
      protein: 20,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'lunch',
    });
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Chicken bowl'`,
    );
    return row!.id;
  }

  it('keeps the explicit stored kcal when an edit does not change the macros', async () => {
    const id = await addExplicitKcalEntry();
    const calories = await import('@/features/calories/calories.data');

    // Same macros, edited name/meal only — the UI passes the stored kcal
    // through. The row must stay 500 kcal, not silently become
    // kcalFromMacros(20, 0, 0, 0) === 80.
    const result = await calories.updateCalorieEntry(id, {
      foodName: 'Chicken bowl (fixed)',
      protein: 20,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'dinner',
      calories: 500,
    });
    expect(result).toBe('updated');

    const row = await db.getFirstAsync<{ calories: number; protein: number; meal_type: string }>(
      'SELECT calories, protein, meal_type FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.calories).toBe(500);
    expect(row?.protein).toBe(20);
    expect(row?.meal_type).toBe('dinner');
  });

  it('recomputes kcal from macros when the edit actually changes a macro', async () => {
    const id = await addExplicitKcalEntry();
    const calories = await import('@/features/calories/calories.data');

    // The explicit value is a fallback, never an override: changed macros
    // recompute kcal as usual (pinned contract in tests/calories.data.test.ts).
    await calories.updateCalorieEntry(id, {
      foodName: 'Chicken bowl',
      protein: 25,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'lunch',
      calories: 500,
    });

    const row = await db.getFirstAsync<{ calories: number }>(
      'SELECT calories FROM calorie_entries WHERE id = ?',
      [id],
    );
    expect(row?.calories).toBe(100);
  });

  it('still keeps a kcal-only quick add on a macro-preserving edit', async () => {
    db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    await calories.addCalorieEntry(
      {
        foodName: 'Quick add',
        calories: 250,
        protein: 0,
        carbs: 0,
        fats: 0,
        fiber: 0,
        mealType: 'snack',
      },
      { maintainSavedMeal: false },
    );
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Quick add'`,
    );

    await calories.updateCalorieEntry(row!.id, {
      foodName: 'Quick add',
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      mealType: 'lunch',
      calories: 250,
    });

    const updated = await db.getFirstAsync<{ calories: number }>(
      'SELECT calories FROM calorie_entries WHERE id = ?',
      [row!.id],
    );
    expect(updated?.calories).toBe(250);
  });
});
