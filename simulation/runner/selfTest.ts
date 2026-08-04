/**
 * Runner self-test model (`add-user-simulation-platform` task 3.5 / 4.4).
 *
 * A deterministic SMOKE scenario that exercises EVERY semantic step kind
 * end-to-end against the local `dist/` build, defined through the same
 * builders as library scenarios. It is the payload for:
 *   - 3.5: run twice in `deterministic` mode → identical action logs;
 *   - 4.4: emit reports (scenario / seeded / repro lanes) that pass the
 *     run-report validator.
 *
 * The smoke seeds the `SMALL` fixture first (2 todos incl. 1 soft-deleted +
 * 1 buildable habit + 1 pomodoro session), then walks every surface and
 * entity action. Every mutating step declares the oracle the model validator
 * requires (a persisted-row or second-surface check).
 *
 * Counts used by the oracle SQL are derived from the fixed fixture + this
 * scenario's own writes:
 *   - non-deleted todos: SMALL seeds 1 visible todo + UI create + apiLeg create = 3;
 *   - pomodoro_sessions: SMALL seeds 1 (a started-but-not-completed session
 *     writes nothing — that is what the startPomodoro oracle asserts).
 */

import { defineModel, definePersona, defineScenario, defineWorkflow } from '../model/builders';

/** The self-test persona: deterministic by default (no mistakes). */
const smokePersona = definePersona({
  id: 'smoke-driver',
  name: 'Smoke Driver',
  description: 'Automated persona for the runner self-test; fully deterministic.',
  goals: ['exercise every step kind', 'prove determinism'],
});

/** A trivial workflow referenced by the smoke (exercises workflow expansion). */
const smokeWarmup = defineWorkflow({
  id: 'smoke-warmup',
  description: 'Warm the runner up by landing on the Todos section.',
  steps: [{ kind: 'switchSection', tab: 'todos' }],
});

/** The smoke scenario: one step per semantic step kind (23 steps). */
const smokeScenario = defineScenario({
  id: 'smoke',
  personaId: 'smoke-driver',
  goal: 'exercise every step kind deterministically against the local build',
  fixture: 'SMALL',
  mode: 'deterministic',
  risks: ['R1', 'R2'],
  tags: ['@smoke', '@p0'],
  workflows: [{ workflowId: 'smoke-warmup' }],
  steps: [
    // ---- entity: create + verify on two surfaces ----
    {
      kind: 'createTodo',
      title: 'Pay rent',
      priority: 'urgent',
      note: 'add a todo via the FAB + modal',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT title, priority FROM todos WHERE title = 'Pay rent' AND deleted_at IS NULL`,
          expected: [{ title: 'Pay rent', priority: 'urgent' }],
        },
        {
          kind: 'across-surfaces',
          text: 'Pay rent',
          tabs: ['todos', 'overview'],
        },
      ],
    },
    // ---- entity: toggle + row-level oracle ----
    {
      kind: 'toggleTodo',
      title: 'Pay rent',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT completed FROM todos WHERE title = 'Pay rent' AND deleted_at IS NULL`,
          expected: [{ completed: 1 }],
        },
      ],
    },
    // ---- navigation (runner-owned + parent) ----
    { kind: 'switchSection', tab: 'habits', note: 'land on Habits for the habit steps' },
    // ---- entity: create habit (runner-owned form) ----
    {
      kind: 'createHabit',
      name: 'Drink water',
      targetPerDay: 3,
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT name, target_per_day FROM habits WHERE name = 'Drink water' AND deleted_at IS NULL`,
          expected: [{ name: 'Drink water', target_per_day: 3 }],
        },
      ],
    },
    // ---- entity: tick habit (runner-owned ring) ----
    {
      kind: 'tickHabit',
      name: 'Drink water',
      times: 1,
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT COUNT(*) AS n FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = 'Drink water'`,
          expected: [{ n: 1 }],
        },
      ],
    },
    // ---- api legs: real data-layer path through the harness ----
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Hydrate from api' },
      description: 'create a habit headlessly through the data layer',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT name FROM habits WHERE name = 'Hydrate from api' AND deleted_at IS NULL`,
          expected: [{ name: 'Hydrate from api' }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createTodo',
      args: { title: 'API task' },
      description: 'create a todo headlessly through the data layer',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT title FROM todos WHERE title = 'API task' AND deleted_at IS NULL`,
          expected: [{ title: 'API task' }],
        },
      ],
    },
    // ---- verification: standalone outbox oracle ----
    {
      kind: 'expectOracle',
      oracle: { kind: 'outbox' },
      note: 'UI writes populate the outbox; parse + length check',
    },
    // ---- entity: calories ----
    {
      kind: 'logCalories',
      food: 'Oatmeal',
      calories: 320,
      mealType: 'breakfast',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT food_name, calories, meal_type FROM calorie_entries WHERE food_name = 'Oatmeal' AND calories = 320 AND deleted_at IS NULL`,
          expected: [{ food_name: 'Oatmeal', calories: 320, meal_type: 'breakfast' }],
        },
      ],
    },
    // ---- entity: workout routine ----
    {
      kind: 'buildRoutine',
      name: 'Push day',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT name FROM workout_routines WHERE name = 'Push day' AND deleted_at IS NULL`,
          expected: [{ name: 'Push day' }],
        },
      ],
    },
    // ---- entity: pomodoro start (nothing persisted until completion) ----
    {
      kind: 'startPomodoro',
      mode: 'focus',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions',
          expected: [{ n: 1 }],
        },
      ],
    },
    // ---- navigation: settings + command overlays ----
    { kind: 'openSettings', note: 'open and close the Settings drawer' },
    { kind: 'openCommand', note: 'open and close the Command Center overlay' },
    // ---- realism steps (deterministic: fixed wait, zero injections) ----
    { kind: 'waitThinkTime', ms: 50 },
    { kind: 'maybeMakeMistake', note: 'deterministic mode injects nothing' },
    {
      kind: 'abandonForm',
      note: 'nothing may be written; unchanged oracle across the no-op',
      oracles: [
        {
          kind: 'unchanged',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
        },
      ],
    },
    // ---- environment: connectivity pair ----
    { kind: 'goOffline', note: 'context goes offline; OPFS writes still work' },
    { kind: 'goOnline', note: 'restore connectivity' },
    // ---- environment: day rollover ----
    { kind: 'advanceClockToNextDay', days: 1, note: 'fake-browser rollover past midnight' },
    // ---- verification: same fact across surfaces after the rollover ----
    {
      kind: 'expectAcrossSurfaces',
      text: 'API task',
      tabs: ['todos', 'overview'],
      note: 'an uncompleted apiLeg todo stays visible on both surfaces',
    },
    // ---- environment: injected server error (inert on local-only builds) ----
    {
      kind: 'injectFailure',
      failure: 'server-error',
      status: 503,
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 3 }],
        },
      ],
    },
    // ---- environment: reload survives (bootstrap + continuity) ----
    {
      kind: 'reloadApp',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          expected: [{ n: 3 }],
        },
      ],
    },
    // ---- navigation: home ----
    { kind: 'switchSection', tab: 'overview' },
  ],
});

/** Full self-test model (persona + workflow + smoke scenario). */
export const selfTestModel = defineModel({
  personas: [smokePersona],
  workflows: [smokeWarmup],
  scenarios: [smokeScenario],
});

/** Convenience accessors for tooling. */
export const smokePersonaDef = smokePersona;
export const smokeScenarioDef = smokeScenario;
export const smokeWarmupDef = smokeWarmup;
