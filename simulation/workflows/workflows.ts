/**
 * Reusable, parameterized workflow fragments (`add-user-simulation-platform`
 * task 6.2): `logMeal`, `completePomodoro`, `buildWorkoutRoutine`,
 * `tickHabitGroup`, `onboardFirstTodo`, `changeSetting`.
 *
 * Each fragment is defined with `defineWorkflow`, parameterized via the
 * `{{param}}` binding the runner expands (see `expandScenarioSteps`), and
 * oracle-carrying: every mutating step declares the row/second-surface oracle
 * the model rule requires. Where a fragment's honest scope is narrower than
 * its name (see `changeSetting` and the note on `completePomodoro`), the
 * description says so — nothing here pretends to something the semantic
 * catalog cannot perform.
 *
 * Numbers in the oracle expectations: the runner's `logCalories` action
 * derives kcal from macros with a carbs-only split (4 kcal/g), so a declared
 * `calories` must be a multiple of 4 for an exact stored-kcal match; the
 * fragments below avoid pinning stored kcal and assert food/meal instead.
 */

import { defineWorkflow } from '../model/builders';

/** Log one meal through the Calories form; asserts the row landed with food + meal type. */
export const logMeal = defineWorkflow({
  id: 'logMeal',
  description:
    'Log a meal in the Calories form. Parameters: food (string), calories (number, a multiple of 4 — the runner stores kcal via a carbs-only macro split), mealType (breakfast|lunch|dinner|snack). Oracle: the persisted row matches food + meal type.',
  parameters: ['food', 'calories', 'mealType'],
  steps: [
    {
      kind: 'logCalories',
      food: '{{food}}',
      calories: '{{calories}}' as unknown as number,
      mealType: '{{mealType}}' as 'breakfast' | 'lunch' | 'dinner' | 'snack',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT food_name, meal_type FROM calorie_entries WHERE food_name = '{{food}}' AND deleted_at IS NULL",
          expected: [{ food_name: '{{food}}', meal_type: '{{mealType}}' }],
        },
      ],
    },
  ],
});

/**
 * Start a 25-minute focus session and probe for completion.
 *
 * The semantic catalog's only clock step is `advanceClockToNextDay`; it uses
 * Playwright's `clock.setSystemTime`, which does NOT fire the app's pre-existing
 * countdown interval (observed: a completed session is not reliably logged this
 * way), so completion itself is not deterministically expressible yet. The
 * fragment pins the strong D11 invariant — a running session writes no partial
 * row (`ended_at IS NULL` count 0 at start) — and ends with a count-only probe
 * for a completed 1500s focus session. Exact counts are pinned by the consuming
 * scenario, never here, so the fragment is reusable and honest.
 */
export const completePomodoro = defineWorkflow({
  id: 'completePomodoro',
  description:
    'Start a 25-minute focus session and advance the clock. Oracle 1 (strong, D11): no partial session row is persisted at start. Oracle 2 (count-only probe): a completed focus session of 1500s exists after the clock jump — completion is not deterministically logged via setSystemTime (the catalog lacks a fast-forward step), so add scenario-level D11 invariants (ended_at IS NULL = 0) for the strong checks.',
  parameters: [],
  steps: [
    {
      kind: 'startPomodoro',
      mode: 'focus',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE ended_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    { kind: 'advanceClockToNextDay', days: 1, note: 'the only clock step in the catalog' },
    { kind: 'waitThinkTime', ms: 2500, note: 'let any live interval observe the elapsed delta' },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE ended_at IS NOT NULL AND session_type = 'focus' AND duration_seconds = 1500",
      },
    },
  ],
});

/** Create a workout routine through the Workout form; asserts the persisted name. */
export const buildWorkoutRoutine = defineWorkflow({
  id: 'buildWorkoutRoutine',
  description:
    'Create a workout routine (name + wizard). Parameter: name (string). Oracle: the routine row exists with that name.',
  parameters: ['name'],
  steps: [
    {
      kind: 'buildRoutine',
      name: '{{name}}',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT name FROM workout_routines WHERE name = '{{name}}' AND deleted_at IS NULL",
          expected: [{ name: '{{name}}' }],
        },
      ],
    },
  ],
});

/**
 * Tick one habit once (its daily "group" target), asserting exactly one
 * completion row with count 1. Parameter: habitName (string). Intended for a
 * habit that has no completion yet today; reusing it for the same habit on the
 * same day violates the exact-count oracle by design.
 */
export const tickHabitGroup = defineWorkflow({
  id: 'tickHabitGroup',
  description:
    'Tick one habit once for today. Parameter: habitName (string). Oracle: exactly one completion row with count 1 for that habit (fresh-habit contract).',
  parameters: ['habitName'],
  steps: [
    {
      kind: 'tickHabit',
      name: '{{habitName}}',
      times: 1,
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n, COALESCE(SUM(count), 0) AS total FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = '{{habitName}}'",
          expected: [{ n: 1, total: 1 }],
        },
      ],
    },
  ],
});

/** Add the first todo on a fresh device; asserts the persisted title + priority. */
export const onboardFirstTodo = defineWorkflow({
  id: 'onboardFirstTodo',
  description:
    'Create a todo through the FAB + modal (the classic first action on a fresh device). Parameters: title (string), priority (urgent|normal|low). Oracle: the row matches title + priority.',
  parameters: ['title', 'priority'],
  steps: [
    {
      kind: 'createTodo',
      title: '{{title}}',
      priority: '{{priority}}' as 'urgent' | 'normal' | 'low',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT title, priority FROM todos WHERE title = '{{title}}' AND deleted_at IS NULL",
          expected: [{ title: '{{title}}', priority: '{{priority}}' }],
        },
      ],
    },
  ],
});

/**
 * Settings-surface verification fragment.
 *
 * The semantic catalog today has NO settings-mutation step (its entity steps
 * cover todos/habits/calories/workout/pomodoro only), so this fragment cannot
 * change a value honestly. It verifies the two things that ARE expressible:
 * the Settings drawer opens/closes, and the settings persistence store
 * (`app_meta` keys `calorie_goal` / `pomodoro_settings`) is reachable. Once a
 * `changeCalorieGoal` / `changePomodoroDefault` step lands in the catalog, this
 * fragment upgrades to a real mutation; until then it is a verification
 * fragment that keeps its consumers honest in `deterministic` lanes.
 */
export const changeSetting = defineWorkflow({
  id: 'changeSetting',
  description:
    'Settings-surface verification fragment (catalog has no settings-mutation step yet): opens the Settings drawer and confirms the settings store is reachable. Upgrade to a real mutation when the catalog grows a settings step.',
  parameters: [],
  steps: [
    { kind: 'openSettings', note: 'open and close the Settings drawer' },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM app_meta WHERE key IN ('calorie_goal', 'pomodoro_settings')",
      },
    },
  ],
});
