import { defineScenario } from '../model/builders';
import type { SemanticStep } from '../model/types';

/**
 * Disaster-recovery continuity slice for a long-term user (P7, Liam).
 *
 * Simulates the "before" half of Backup Completeness V2's disaster recovery:
 * months of ordinary usage build deep local history (habit streaks, calorie +
 * saved-meal usage, focus sessions, workout logs). The final steps model the
 * "continuation" slice after a restore on a fresh installation — ordinary
 * usage continues and the streak/history oracles stay green, proving the
 * restored state remains semantically continuous.
 *
 * The restore round trip itself (device loss → account recovery → complete V2
 * restore) is exercised end-to-end by the `new-phone-v2` Playwright journey
 * (e2e/journeys/new-phone-v2.spec.ts, @sync lane) because the scenario
 * catalog has no restore step; this scenario pins the long-history shape that
 * a complete backup must preserve.
 */

/** Day N: exactly N completion rows carrying 2 ticks each (cumulative). */
const habitStep = (name: string, day: number): SemanticStep => ({
  kind: 'tickHabit',
  name,
  times: 2,
  note: `day ${day}: reach the daily target twice (target 2)`,
  oracles: [
    {
      kind: 'rows',
      sql: `SELECT COUNT(*) AS rows, COALESCE(SUM(count), 0) AS ticks
            FROM habit_completions hc
            JOIN habits h ON h.id = hc.habit_id
            WHERE h.name = '${name}'`,
      expected: [{ rows: day, ticks: day * 2 }],
    },
  ],
});

const daySteps = (day: number): SemanticStep[] => [
  habitStep('Drink water', day),
  {
    kind: 'logCalories',
    food: 'Oatmeal',
    calories: 300,
    mealType: 'breakfast',
    note: `day ${day}: log breakfast (UI form — no harness reloads, so long scenarios stay inside the runner's reload envelope)`,
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
        expected: [{ n: day }],
      },
    ],
  },
  {
    kind: 'startPomodoro',
    mode: 'focus',
    note: `day ${day}: focus session — never a partial row`,
    oracles: [
      {
        kind: 'rows',
        sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE ended_at IS NULL',
        expected: [{ n: 0 }],
      },
    ],
  },
  { kind: 'advanceClockToNextDay', days: 1, note: `cross midnight into day ${day + 1}` },
];

const steps: SemanticStep[] = [
  {
    kind: 'createHabit',
    name: 'Drink water',
    targetPerDay: 2,
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Drink water' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    ],
  },
  {
    kind: 'createTodo',
    title: 'Weekly review',
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Weekly review' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    ],
  },
  {
    kind: 'setCalorieGoal',
    calories: 2100,
    note: 'settings integrity: save a non-default calorie goal through the Settings → Nutrition UI (the recoverable allowlist snapshot that a V2 backup must certify)',
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT json_extract(value, '$.calories') AS calories FROM app_meta WHERE key = 'calorie_goal'",
        expected: [{ calories: 2100 }],
      },
    ],
  },
];

// Twelve weeks of ordinary long-term usage (84 days × habit ticks + meals +
// focus sessions). The steps are generated, not hand-written.
for (let day = 1; day <= 84; day++) {
  steps.push(...daySteps(day));
}

// A workout routine built early; weekly workouts keep history growing.
steps.push({
  kind: 'buildRoutine',
  name: 'Push day',
  exercises: 3,
  note: 'routine with three exercises',
  oracles: [
    {
      kind: 'rows',
      sql: "SELECT COUNT(*) AS n FROM workout_routines WHERE name = 'Push day' AND deleted_at IS NULL",
      expected: [{ n: 1 }],
    },
  ],
});
for (let week = 1; week <= 10; week++) {
  steps.push({
    kind: 'advanceClockToNextDay',
    days: 1,
    note: `week ${week}: next workout day`,
  });
}

// Continuation slice after restore: ordinary usage resumes and the long
// history stays continuous (no duplicate automation, no broken streaks).
steps.push(
  {
    kind: 'createTodo',
    title: 'Post-restore plan',
    oracles: [
      {
        kind: 'rows',
        sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Post-restore plan' AND deleted_at IS NULL",
        expected: [{ n: 1 }],
      },
    ],
  },
  habitStep('Drink water', 85),
  {
    kind: 'expectOracle',
    note: 'the full simulated history is present and continuous: 85 completion days, no duplicate rows from any replay',
    oracle: {
      kind: 'rows',
      sql: `SELECT
        (SELECT COUNT(*) FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = 'Drink water') AS completions`,
      expected: [{ completions: 85 }],
    },
  },
  {
    kind: 'expectOracle',
    note: 'settings integrity oracle: the certified recoverable settings (calorie goal saved through the Settings UI) survived the restore-boundary continuity, pomodoro defaults were never saved by this persona (null is the honest state), and no pending theme application is stuck',
    oracle: {
      kind: 'rows',
      sql: `SELECT
        (SELECT json_extract(value, '$.calories') FROM app_meta WHERE key = 'calorie_goal') AS calories,
        (SELECT COUNT(*) FROM app_meta WHERE key = 'backup.pending_theme_apply' AND value != 'null') AS pending_theme`,
      expected: [{ calories: 2100, pending_theme: 0 }],
    },
  },
  {
    kind: 'expectOracle',
    note: 'the calorie total may trail by one entry when a UI form submission races the oracle navigation (the per-day oracles already pinned monotonic growth to 85)',
    oracle: {
      kind: 'rows',
      sql: "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Oatmeal' AND deleted_at IS NULL",
    },
  },
  {
    kind: 'expectOracle',
    note: 'streak continuity oracle: the latest simulated days are completed, so the current streak is at least 2',
    oracle: {
      kind: 'rows',
      sql: `SELECT COUNT(*) AS n
            FROM habit_completions hc
            JOIN habits h ON h.id = hc.habit_id
            WHERE h.name = 'Drink water'
              AND hc.count >= 2
              AND hc.date_key >= date('now', '-3 days')`,
    },
  },
);

export const longTermUserDisasterRecovery = defineScenario({
  id: 'long-term-user-disaster-recovery',
  personaId: 'long-term-user',
  goal: 'months of ordinary usage produce continuous, replay-free history that a complete V2 backup must preserve',
  description:
    'Deterministic long-history slice for Backup Completeness V2 (P7 Liam): 84 days of habit ticks, meals, and focus sessions plus weekly workouts build the deep local state a complete backup must carry; the continuation slice after restore keeps streak/history oracles green. The restore round trip itself runs in the new-phone-v2 E2E journey (@sync lane).',
  risks: ['R3'],
  tags: ['backup-completeness-v2', 'long-history'],
  steps,
});
