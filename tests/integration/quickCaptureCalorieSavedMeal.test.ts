import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Quick-capture calorie log vs the saved-meal catalog, against a REAL
 * better-sqlite3 database.
 *
 * Quick Capture is a "one-off quick log" (see the `maintainSavedMeal` contract
 * in `features/calories/calories.data.ts`): the diary entry counts, but the
 * entry must not be treated as a "use" of a saved meal. The pre-change call
 * site omitted the opt-out, so `addCalorieEntry` ran the default catalog
 * maintenance: logging a food whose name already existed as a saved meal
 * OVERWROTE that meal's macros with the capture's numbers, bumped its
 * `use_count`, and refreshed `last_used_at`. Undo then only removed the
 * diary row, leaving the catalog damage in place.
 */

type SavedMealRow = {
  food_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  meal_type: string;
  use_count: number;
  last_used_at: string;
};

async function savedMeals(db: TestDatabase, foodName: string): Promise<SavedMealRow[]> {
  return db.getAllAsync<SavedMealRow>(
    `SELECT food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at
     FROM saved_meals WHERE food_name = ? COLLATE NOCASE`,
    [foodName],
  );
}

async function diaryRows(db: TestDatabase) {
  return db.getAllAsync<{
    id: string;
    food_name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    fiber: number;
    meal_type: string;
  }>(
    `SELECT id, food_name, calories, protein, carbs, fats, fiber, meal_type
     FROM calorie_entries WHERE deleted_at IS NULL ORDER BY created_at ASC`,
  );
}

/** The exact Quick Capture calorie write, resolved through the production call site. */
async function quickCaptureCalorie(body: {
  foodName: string;
  calories: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}): Promise<string> {
  const { submitQuickCaptureCalorie } =
    await import('@/features/quick-capture/quickCaptureCalorie.submit');
  return submitQuickCaptureCalorie(body);
}

describe('quick-capture calorie log leaves the saved-meal catalog alone', () => {
  it('logging "Oatmeal" from Quick Capture keeps the existing saved meal unchanged', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    // The user's real saved meal: macros the capture does not know about.
    await calories.upsertSavedMeal({
      foodName: 'Oatmeal',
      calories: 250,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 6,
      mealType: 'breakfast',
    });
    const before = await savedMeals(db, 'Oatmeal');
    expect(before).toHaveLength(1);
    expect(before[0]).toMatchObject({
      calories: 250,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 6,
      use_count: 1,
    });

    // A one-off quick log: kcal only, different from the saved meal.
    const entryId = await quickCaptureCalorie({
      foodName: 'Oatmeal',
      calories: 320,
      mealType: 'snack',
    });
    expect(entryId).toMatch(/^cal_/);

    const after = await savedMeals(db, 'Oatmeal');
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      calories: 250,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 6,
      meal_type: 'breakfast',
      use_count: 1,
      last_used_at: before[0].last_used_at,
    });

    // The diary row is the only thing the capture added.
    const diary = await diaryRows(db);
    expect(diary).toHaveLength(1);
    expect(diary[0]).toMatchObject({
      id: entryId,
      food_name: 'Oatmeal',
      calories: 320,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      meal_type: 'snack',
    });
    await db.closeAsync();
  });

  it('undo removes only the diary row and never touches the saved meal', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');

    await calories.upsertSavedMeal({
      foodName: 'Oatmeal',
      calories: 250,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 6,
      mealType: 'breakfast',
    });
    const before = await savedMeals(db, 'Oatmeal');

    const entryId = await quickCaptureCalorie({
      foodName: 'Oatmeal',
      calories: 320,
      mealType: 'lunch',
    });
    // A second, unrelated diary row must survive the undo.
    const otherId = await quickCaptureCalorie({
      foodName: 'Apple',
      calories: 95,
      mealType: 'snack',
    });

    await calories.deleteCalorieEntry(entryId);

    const remaining = await diaryRows(db);
    expect(remaining.map((row) => row.id)).toEqual([otherId]);

    const after = await savedMeals(db, 'Oatmeal');
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      calories: 250,
      protein: 10,
      carbs: 40,
      fats: 5,
      fiber: 6,
      meal_type: 'breakfast',
      use_count: 1,
      last_used_at: before[0].last_used_at,
    });
    expect(await savedMeals(db, 'Apple')).toHaveLength(0);
    await db.closeAsync();
  });
});
