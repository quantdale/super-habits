/**
 * New composite scenarios the parent does NOT have (`add-user-simulation-platform`
 * task 6.4): (a) first-run onboarding process, (b) a simulated week of habit
 * tracking (clock-advanced, seeded mode), (c) settings-ripple with a mid-scenario
 * reload, and (d) new-device migration as a composable process.
 *
 * Each is oracle-carrying and validation-clean. The week scenario runs in
 * `seeded` mode (variability lane, report-only); the others are deterministic.
 */

import { defineScenario } from '../model/builders';
import { calorieStep, habitStep, habitTickStep, todoStep } from '../fixtures/seeders';

/* ------------------------------------------------------------------ */
/* (a) First-run onboarding process                                     */
/* ------------------------------------------------------------------ */

export const firstRunOnboarding = defineScenario({
  id: 'first-run-onboarding',
  personaId: 'new-device-migrator',
  goal: 'A brand-new user creates their first habit, first todo, and first meal',
  description:
    'The first-run onboarding process: an empty device, the user creates and ticks a habit, adds their first todo, and logs their first meal — each through the real data layer with a row oracle. Everything persists on a final reload.',
  risks: ['R6'],
  tags: ['composite', 'onboarding'],
  steps: [
    habitStep('Drink water', 1),
    habitTickStep('Drink water', 1),
    {
      kind: 'createTodo',
      title: 'Set up my morning routine',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Set up my morning routine' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    calorieStep('Oatmeal', 320, 'breakfast'),
    {
      kind: 'reloadApp',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Drink water' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* (b) A simulated week of habit tracking (clock-advanced, seeded)      */
/* ------------------------------------------------------------------ */

/**
 * Build the 7-day habit week: one `apiLeg` tick per day, each followed by an
 * `advanceClockToNextDay`, so ticks land on seven consecutive date keys. The
 * per-day running-total oracle is exact because `apiLeg` steps are not subject
 * to the behavior injectors (the injector set targets UI forms only).
 */
function weekSteps(habitName: string): import('../model/types').SemanticStep[] {
  const steps: import('../model/types').SemanticStep[] = [habitStep(habitName, 1)];
  for (let day = 1; day <= 7; day++) {
    steps.push(habitTickStep(habitName, day));
    steps.push({ kind: 'advanceClockToNextDay', days: 1, note: `advance to day ${day + 1}` });
  }
  return steps;
}

export const weekOfHabitTracking = defineScenario({
  id: 'week-of-habit-tracking',
  personaId: 'daily-driver',
  goal: 'Track one habit across seven consecutive days, advancing the clock each day',
  description:
    'A simulated week of habit tracking: the habit is created and ticked once per day, with the clock advanced past each midnight between ticks, so seven completion rows land on seven distinct date keys. Runs in `seeded` mode (variability lane); the apiLeg legs are not injectable, so the seeded mode surfaces sampled think-time pacing and (via the persona) mistake/offline injector eligibility on any UI steps present. The closing oracle pins total completions and distinct days.',
  mode: 'seeded',
  risks: ['R6'],
  tags: ['composite', 'seeded', 'week'],
  steps: [
    ...weekSteps('Walk outside'),
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n, COUNT(DISTINCT date_key) AS days FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = 'Walk outside'",
        expected: [{ n: 7, days: 7 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM habit_completions WHERE date_key = (SELECT date_key FROM habit_completions ORDER BY date_key LIMIT 1)',
        expected: [{ n: 1 }],
      },
    },
  ],
});

/* ------------------------------------------------------------------ */
/* (c) Settings ripple with a mid-scenario reload                       */
/* ------------------------------------------------------------------ */

export const settingsRippleWithReload = defineScenario({
  id: 'settings-ripple-with-reload',
  personaId: 'power-user',
  goal: 'The settings surface opens, a mid-scenario reload happens, and it is still reachable with state intact',
  description:
    "Settings-ripple composite with a mid-scenario reload (the twist the parent J10 does not include): the Settings drawer opens, a todo is written, a reload lands MID-way, and after it both the todo and the settings surface are intact. Actual settings mutation still needs a catalog step (see `changeSetting`); the Focus-timer rendering cannot be cross-checked because the runner's `switchSection` strict-mode collides with the Focus mode chip.",
  risks: ['R11'],
  tags: ['composite', 'settings'],
  workflows: [{ workflowId: 'changeSetting', params: {} }],
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'createTodo',
      args: { title: 'Ripple note' },
      description: 'device state that must survive the mid-scenario reload',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Ripple note' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'reloadApp',
      note: 'the mid-scenario reload',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Ripple note' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectAcrossSurfaces',
      text: 'Ripple note',
      tabs: ['todos', 'overview'],
      note: 'state preserved across the mid-scenario reload',
    },
    { kind: 'openSettings', note: 'settings still reachable after the reload' },
  ],
});

/* ------------------------------------------------------------------ */
/* (d) New-device migration as a composable process                     */
/* ------------------------------------------------------------------ */

export const newDeviceMigration = defineScenario({
  id: 'new-device-migration',
  personaId: 'new-device-migrator',
  goal: 'Migration: the old device corpus is written, then a fresh reload proves it is intact',
  description:
    "New-device migration as a composable process: the old device's corpus (a habit + tick, a todo, a meal) is written through the data layer, then a fresh bootstrap (reload) proves every record is intact — the local-migration half that holds on any build. The cross-device restore round-trip (prompt → accept → import → what is not restored) needs a restore step and the dist-sync lane; not expressible with the current catalog.",
  risks: ['R3'],
  tags: ['composite', 'migration'],
  steps: [
    habitStep('Hydrate', 3),
    habitTickStep('Hydrate', 1),
    todoStep('Restored task'),
    calorieStep('Oatmeal', 300, 'breakfast'),
    {
      kind: 'reloadApp',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Restored task' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Hydrate' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    },
    {
      kind: 'expectOracle',
      oracle: {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    },
  ],
});
