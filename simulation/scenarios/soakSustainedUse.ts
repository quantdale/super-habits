import { defineScenario } from '../model/builders';
import type { SemanticStep } from '../model/types';

/**
 * Long-session resource soak (campaign: harden-whole-system-resilience-v1,
 * Workstream B).
 *
 * Drives a bounded but realistic sustained session against the deep HEAVY
 * history: repeated full section tours (Overview refresh pressure), Todo/
 * Habit/Calories CRUD every cycle, periodic Focus starts, periodic hard
 * reloads (fresh bootstrap through real migrations), and a local-midnight
 * crossing per cycle so every day-scoped surface must follow the new day.
 * Deterministic mode keeps the sequence replayable; every mutating step
 * carries persisted-row oracles and closing oracles pin final data-integrity
 * invariants (no duplicated or lost writes after churn).
 *
 * Todo completion-through-the-list is deliberately NOT driven here: manual-
 * order items land below HEAVY's virtualized window, and the parent's
 * deterministic journeys (j8-three-months-in, j3-the-commute) already gate
 * real checkbox completion flows. This lane owns sustained-churn coverage.
 *
 * Resource evidence: the run report records per-step durationMs and the total
 * durationMs; acceptance requires two clean fresh-state runs with all
 * oracles green and stable late-sequence latencies rather than invented
 * absolute memory ceilings (documented rationale in the campaign ExecPlan).
 */

const CYCLES = 12;
const steps: SemanticStep[] = [];

steps.push(
  {
    kind: 'createHabit',
    name: 'Soak hydration',
    targetPerDay: 2,
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Soak hydration' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    ],
  },
  {
    kind: 'buildRoutine',
    name: 'Soak push day',
    exercises: 2,
    note: 'one routine early; later cycles only re-read Workout surfaces on the deep seeded history',
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM workout_routines WHERE name = 'Soak push day' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    ],
  },
);

for (let cycle = 1; cycle <= CYCLES; cycle++) {
  // Full section tour: six transitions per cycle exercise the single-page
  // shell's mount/activate paths and Overview refresh under deep history.
  for (const tab of ['overview', 'todos', 'habits', 'pomodoro', 'workout', 'calories'] as const) {
    steps.push({ kind: 'switchSection', tab, note: `cycle ${cycle}: tour ${tab}` });
  }

  steps.push(
    {
      kind: 'createTodo',
      title: `Soak task ${cycle}`,
      note: `cycle ${cycle}: creation pressure on the manual-order list`,
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT COUNT(*) AS n FROM todos WHERE title = 'Soak task ${cycle}' AND deleted_at IS NULL`,
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'tickHabit',
      name: 'Soak hydration',
      times: 1,
      note: `cycle ${cycle}: one tick on today's completion row`,
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT COUNT(*) AS n FROM habit_completions hc
                JOIN habits h ON h.id = hc.habit_id
                WHERE h.name = 'Soak hydration'`,
          expected: [{ n: cycle }],
        },
      ],
    },
    {
      kind: 'logCalories',
      food: `Soak snack ${cycle}`,
      calories: 180,
      mealType: 'snack',
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Soak snack ${cycle}' AND deleted_at IS NULL`,
          expected: [{ n: 1 }],
        },
      ],
    },
  );

  if (cycle % 3 === 0) {
    steps.push({
      kind: 'startPomodoro',
      mode: 'focus',
      note: `cycle ${cycle}: focus start — sessions log only on completion, never a partial row`,
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE ended_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    });
  }

  if (cycle % 4 === 0) {
    steps.push({
      kind: 'reloadApp',
      note: `cycle ${cycle}: hard reload — fresh bootstrap must preserve everything written so far`,
      oracles: [
        {
          kind: 'rows',
          sql: `SELECT COUNT(*) AS n FROM todos WHERE title LIKE 'Soak task %' AND deleted_at IS NULL`,
          expected: [{ n: cycle }],
        },
      ],
    });
  }

  steps.push({
    kind: 'advanceClockToNextDay',
    days: 1,
    note: `cycle ${cycle}: cross local midnight into the next soak day`,
  });
}

steps.push(
  {
    kind: 'expectOracle',
    note: 'final integrity: every soak todo was created exactly once and survived the churn/reloads as pending (completion itself is gated by the parent journeys)',
    oracle: {
      kind: 'rows',
      sql: `SELECT
        (SELECT COUNT(*) FROM todos WHERE title LIKE 'Soak task %' AND deleted_at IS NULL) AS created,
        (SELECT COUNT(*) FROM todos WHERE title LIKE 'Soak task %' AND deleted_at IS NULL AND completed = 0) AS pending`,
      expected: [{ created: CYCLES, pending: CYCLES }],
    },
  },
  {
    kind: 'expectOracle',
    note: 'final integrity: one completion row per soak day (rollovers never duplicated or lost ticks)',
    oracle: {
      kind: 'rows',
      sql: `SELECT COUNT(*) AS n FROM habit_completions hc
            JOIN habits h ON h.id = hc.habit_id
            WHERE h.name = 'Soak hydration'`,
      expected: [{ n: CYCLES }],
    },
  },
  {
    kind: 'expectOracle',
    note: 'final integrity: every soak meal landed exactly once across day boundaries',
    oracle: {
      kind: 'rows',
      sql: `SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name LIKE 'Soak snack %' AND deleted_at IS NULL`,
      expected: [{ n: CYCLES }],
    },
  },
);

export const soakSustainedUse = defineScenario({
  id: 'soak-sustained-use',
  personaId: 'power-user',
  goal: 'a bounded sustained session over deep history stays correct, replay-free, and stable late into the sequence',
  description:
    'Long-session soak: twelve day-long cycles of full section tours, todo/habit/calorie CRUD, periodic focus starts and hard reloads over the HEAVY fixture, ending with strict data-integrity oracles.',
  fixture: 'HEAVY',
  mode: 'deterministic',
  risks: ['R5'],
  tags: ['@soak'],
  steps,
});
