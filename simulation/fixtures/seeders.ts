/**
 * Fixture builders (`add-user-simulation-platform` task 6.5, design D9).
 *
 * These are small TypeScript builders that produce scenario PREAMBLES — ordered
 * sequences of `apiLeg` semantic steps (never raw SQL) — composing the parent's
 * SMALL/TYPICAL/HEAVY seed content (`e2e/helpers/seed.ts` /
 * `tests/integration/fixtures/seeders.ts`). Every `apiLeg` step is a real
 * data-layer write replayed through the DB harness (the runner's `apiLeg.ts`),
 * so the same row format the app writes flows through the same verification
 * surface as UI-driven data.
 *
 * Honest scope (the parent seeds with raw SQL and the integration seeders with
 * injected-clock data-layer calls; compare):
 * - The `apiLeg` registry exposes `createTodo`, `createHabit`, `tickHabit`,
 *   `logCalories`, `createWorkoutRoutine`, and a compact `seedGymTrainingState`
 *   fixture seam. It cannot express soft-deleted
 *   rows, saved meals, pomodoro sessions, or past-day history, so the fixture
 *   counts below are approximations of the parent's volumes at a scale that is
 *   practical to replay as browser steps.
 * - `tickHabit` writes the CURRENT (clock) day; past-day history is built by
 *   interleaving `advanceClockToNextDay` steps (see the `week-of-habit-tracking`
 *   composite scenario).
 *
 * Each fixture builder returns an array of `SemanticStep`s that a scenario
 * spreads into its `steps`, so the preamble is validated exactly like any other
 * step (every mutating `apiLeg` step carries its own row oracle).
 */

import type { Oracle, SemanticStep } from '../model/types';

const esc = (s: string): string => s.replace(/'/g, "''");

/** One `apiLeg` step with its row oracle (mutating steps must carry oracles). */
function apiStep(
  functionName: string,
  args: Record<string, unknown>,
  oracle: Oracle,
): SemanticStep {
  return { kind: 'apiLeg', functionName, args, oracles: [oracle] };
}

/** Create one todo via the data layer; oracle: exactly one row with title + priority. */
export function todoStep(
  title: string,
  priority: 'urgent' | 'normal' | 'low' = 'normal',
): SemanticStep {
  return apiStep(
    'createTodo',
    { title, priority },
    {
      kind: 'rows',
      sql: `SELECT title, priority FROM todos WHERE title = '${esc(title)}' AND deleted_at IS NULL`,
      expected: [{ title, priority }],
    },
  );
}

/** Create one habit via the data layer; oracle includes its effective schedule rule. */
export function habitStep(
  name: string,
  targetPerDay = 1,
  weekdays: readonly number[] = [1, 2, 3, 4, 5, 6, 7],
): SemanticStep {
  const normalizedWeekdays = [...new Set(weekdays)].sort((a, b) => a - b);
  return apiStep(
    'createHabit',
    { name, targetPerDay, weekdays: normalizedWeekdays },
    {
      kind: 'rows',
      sql: `SELECT name, target_per_day, json_extract(rule_history, '$[0].weekdays') AS scheduled_weekdays FROM habits WHERE name = '${esc(name)}' AND deleted_at IS NULL`,
      expected: [
        {
          name,
          target_per_day: targetPerDay,
          scheduled_weekdays: JSON.stringify(normalizedWeekdays),
        },
      ],
    },
  );
}

/**
 * The `k`-th tick of a habit for the current (clock) day. The oracle asserts the
 * running TOTAL (`COALESCE(SUM(count), 0) = k`) — correct whether the ticks land
 * on the same day (one row, count incremented) or across distinct days (one row
 * per day), because each tick goes through the data layer's SELECT→INSERT/UPDATE
 * path. The row COUNT is intentionally not asserted here (it differs between the
 * two cases).
 */
export function habitTickStep(name: string, k: number): SemanticStep {
  return apiStep(
    'tickHabit',
    { name },
    {
      kind: 'rows',
      sql: `SELECT COALESCE(SUM(count), 0) AS total FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = '${esc(name)}'`,
      expected: [{ total: k }],
    },
  );
}

/** Log one meal via the data layer (stored kcal is verbatim here, unlike the UI). */
export function calorieStep(food: string, calories: number, mealType = 'snack'): SemanticStep {
  return apiStep(
    'logCalories',
    { food, calories, mealType },
    {
      kind: 'rows',
      sql: `SELECT food_name, meal_type, calories FROM calorie_entries WHERE food_name = '${esc(food)}' AND calories = ${calories} AND deleted_at IS NULL`,
      expected: [{ food_name: food, meal_type: mealType, calories }],
    },
  );
}

/** Create one workout routine via the data layer; oracle: exactly one row. */
export function routineStep(name: string): SemanticStep {
  return apiStep(
    'createWorkoutRoutine',
    { name },
    {
      kind: 'rows',
      sql: `SELECT name FROM workout_routines WHERE name = '${esc(name)}' AND deleted_at IS NULL`,
      expected: [{ name }],
    },
  );
}

/** Seed a compact Gym V2 shape after a routine exists. */
export function gymTrainingStep(routineName: string): SemanticStep {
  return apiStep(
    'seedGymTrainingState',
    { routineName },
    {
      kind: 'rows',
      sql: `SELECT
        (SELECT COUNT(*) FROM custom_exercises WHERE name = 'Cable Y raise' AND deleted_at IS NULL) AS custom_exercises,
        (SELECT COUNT(*) FROM workout_weekly_plan wp JOIN workout_routines wr ON wr.id = wp.routine_id WHERE wr.name = '${esc(routineName)}' AND wp.deleted_at IS NULL) AS weekly_plan,
        (SELECT COUNT(*) FROM body_weight_entries WHERE note = 'Simulation morning' AND deleted_at IS NULL) AS body_weight_entries`,
      expected: [{ custom_exercises: 1, weekly_plan: 1, body_weight_entries: 1 }],
    },
  );
}

/* ------------------------------------------------------------------ */
/* Parent-seed compositions                                            */
/* ------------------------------------------------------------------ */

/**
 * SMALL approximation: 2 todos, 1 habit (+1 today tick), 2 meals.
 * (Parent SMALL also carries 1 soft-deleted todo + 1 seeded pomodoro session,
 * which the apiLeg registry cannot express.)
 */
export function smallPreamble(): SemanticStep[] {
  return [
    todoStep('Task 1'),
    todoStep('Task 2', 'low'),
    habitStep('Habit 1', 1),
    habitTickStep('Habit 1', 1),
    calorieStep('Oatmeal', 320, 'breakfast'),
    calorieStep('Café', 124, 'snack'),
  ];
}

/** TYPICAL approximation: 5 todos, 3 habits (each 1–3 today ticks), 10 meals, 2 routines. */
export function typicalPreamble(): SemanticStep[] {
  const steps: SemanticStep[] = [];
  for (let i = 1; i <= 5; i++) {
    steps.push(todoStep(`Task ${i}`, i % 3 === 0 ? 'low' : 'normal'));
  }
  for (const [name, ticks, weekdays] of [
    ['Drink water', 3, [1, 2, 3, 4, 5, 6, 7]],
    ['Walk outside', 1, [1, 2, 3, 4, 5]],
    ['Read 20 minutes', 2, [1, 3, 5]],
  ] as const) {
    steps.push(habitStep(name, ticks, weekdays)); // target = today's intended count
    for (let k = 1; k <= ticks; k++) steps.push(habitTickStep(name, k));
  }
  const meals: [string, number, 'breakfast' | 'lunch' | 'dinner' | 'snack'][] = [
    ['Oatmeal with berries', 320, 'breakfast'],
    ['Chicken salad', 480, 'lunch'],
    ['Salmon with rice', 540, 'dinner'],
    ['Greek yogurt', 140, 'snack'],
    ['Banana', 105, 'snack'],
    ['Scrambled eggs', 280, 'breakfast'],
    ['Protein shake', 220, 'snack'],
    ['Dark chocolate', 160, 'snack'],
    ['Coffee', 12, 'breakfast'],
    ['Rice bowl', 460, 'lunch'],
  ];
  for (const [food, kcal, mealType] of meals) steps.push(calorieStep(food, kcal, mealType));
  steps.push(routineStep('Routine 1 — Upper body'));
  steps.push(gymTrainingStep('Routine 1 — Upper body'));
  steps.push(routineStep('Routine 2 — Lower body'));
  return steps;
}

/**
 * HEAVY approximation at a replayable scale: 12 todos, 5 habits (1 tick each),
 * 24 meals, 4 routines. The parent's HEAVY is 200 todos / 600 meals / 120
 * sessions — impractical as individual browser-step legs, and the parent's own
 * `seedFixture('HEAVY')` carries a UNIQUE-collision defect (see J8's header
 * comment in `e2e/journeys/three-months-in.spec.ts`).
 */
export function heavyPreamble(): SemanticStep[] {
  const steps: SemanticStep[] = [];
  for (let i = 1; i <= 12; i++) {
    steps.push(todoStep(`Task ${i}`, i % 4 === 0 ? 'urgent' : 'normal'));
  }
  for (const [name, weekdays] of [
    ['Drink water', [1, 2, 3, 4, 5, 6, 7]],
    ['Morning stretch', [1, 2, 3, 4, 5]],
    ['Weekend reset', [6, 7]],
    ['Read 20 minutes', [1, 3, 5]],
    ['Plan tomorrow', [2, 6]],
  ] as const) {
    steps.push(habitStep(name, 1, weekdays));
    steps.push(habitTickStep(name, 1));
  }
  const foods = [
    'Oatmeal with berries',
    'Chicken salad',
    'Salmon with rice',
    'Greek yogurt',
    'Banana',
    'Scrambled eggs',
    'Protein shake',
    'Dark chocolate',
    'Coffee',
    'Rice bowl',
    'Almonds',
    'Sushi',
  ];
  const kcal = [320, 480, 540, 140, 105, 280, 220, 160, 12, 460, 180, 420];
  for (let i = 0; i < 24; i++) {
    steps.push(calorieStep(foods[i % foods.length], kcal[i % kcal.length], 'snack'));
  }
  for (let r = 1; r <= 4; r++)
    steps.push(routineStep(`Routine ${r} — ${r % 2 === 0 ? 'Lower' : 'Upper'} body`));
  return steps;
}
