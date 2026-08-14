/**
 * Deterministic Command Center V2 persona arcs.
 *
 * These scenarios use semantic Command/Ask steps so the simulation runner
 * exercises the same overlay helpers as the hand-written journeys. Every
 * confirmed mutation carries a persisted-row oracle; preview-only and Ask
 * steps remain explicitly read-only.
 */

import { defineScenario } from '../model/builders';

/** Persona A — busy worker: morning check, focus block, then complete the report. */
export const commandBusyWorker = defineScenario({
  id: 'command-v2-busy-worker',
  personaId: 'daily-driver',
  goal: 'Use Command Center for a morning focus block and a later Todo completion',
  description:
    'A busy worker checks the read-only Ask surface, starts a confirmed focus session, and later completes one uniquely named Todo. No Command mutation is available before its preview confirmation.',
  risks: ['R4', 'R6', 'R8'],
  tags: ['command-v2', 'persona-a', 'journey'],
  steps: [
    {
      kind: 'askQuestion',
      question: 'What do I need to do today?',
      expectedOutcome: 'unavailable',
    },
    {
      kind: 'apiLeg',
      functionName: 'createTodo',
      args: { title: 'Submit report' },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM todos WHERE title = 'Submit report' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'commandConfirm',
      input: 'start a 25 minute focus session',
      previewRows: [{ label: 'Duration', contains: '25 minutes' }],
      successText: 'Focus session started.',
      oracles: [
        {
          kind: 'rows',
          sql: 'SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE ended_at IS NULL',
          expected: [{ n: 0 }],
        },
      ],
    },
    {
      kind: 'commandConfirm',
      input: 'complete Submit report',
      previewRows: [
        { label: 'Current state', contains: 'Incomplete' },
        { label: 'Result', contains: 'Complete' },
      ],
      successText: 'Todo completed.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT completed FROM todos WHERE title = 'Submit report' AND deleted_at IS NULL",
          expected: [{ completed: 1 }],
        },
      ],
    },
  ],
});

/** Persona B — fitness tracker: log a habit, supplied calories, and a routine. */
export const commandFitnessTracker = defineScenario({
  id: 'command-v2-fitness-tracker',
  personaId: 'power-user',
  goal: 'Record fitness progress across Habits, Calories, and Workout through Command Center',
  description:
    'A fitness-focused user confirms one habit increment, one nutrition entry with supplied values, and one existing workout routine. The Command layer never invents exercise or nutrition details.',
  risks: ['R4', 'R6'],
  tags: ['command-v2', 'persona-b', 'journey'],
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Exercise', targetPerDay: 1 },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Exercise' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'commandConfirm',
      input: 'add one to Exercise',
      previewRows: [
        { label: 'Current', contains: '0 / 1' },
        { label: 'After', contains: '1 / 1' },
      ],
      successText: 'Habit progress logged.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT count FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = 'Exercise'",
          expected: [{ count: 1 }],
        },
      ],
    },
    {
      kind: 'commandConfirm',
      input: 'add lunch: chicken meal, 600 calories, 50g protein',
      previewRows: [
        { label: 'Calories', contains: '600 kcal' },
        { label: 'Protein', contains: '50 g' },
      ],
      successText: 'Calorie entry logged.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT food_name, calories, protein FROM calorie_entries WHERE food_name = 'chicken meal' AND deleted_at IS NULL",
          expected: [{ food_name: 'chicken meal', calories: 600, protein: 50 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createWorkoutRoutine',
      args: { name: 'Gym' },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM workout_routines WHERE name = 'Gym' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'commandConfirm',
      input: 'log Gym workout',
      previewRows: [{ label: 'Routine', contains: 'Gym' }],
      successText: 'Workout logged.',
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM workout_logs wl JOIN workout_routines wr ON wr.id = wl.routine_id WHERE wr.name = 'Gym'",
          expected: [{ n: 1 }],
        },
      ],
    },
  ],
});

/** Persona C — heavy Habit user: duplicate names must remain needs-input. */
export const commandHabitEdgeCases = defineScenario({
  id: 'command-v2-habit-edge-cases',
  personaId: 'error-prone-user',
  goal: 'Refuse to choose between duplicate Habit names without an explicit choice',
  description:
    'A heavy Habit user has two active Habits with the same name. A progress command produces needs_input and proves the local rows remain unchanged; a destructive request is rejected as unsupported.',
  risks: ['R4', 'R6'],
  tags: ['command-v2', 'persona-c', 'journey'],
  steps: [
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Read', targetPerDay: 2 },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Read' AND deleted_at IS NULL",
          expected: [{ n: 1 }],
        },
      ],
    },
    {
      kind: 'apiLeg',
      functionName: 'createHabit',
      args: { name: 'Read', targetPerDay: 2 },
      oracles: [
        {
          kind: 'rows',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Read' AND deleted_at IS NULL",
          expected: [{ n: 2 }],
        },
      ],
    },
    {
      kind: 'commandPreview',
      input: 'add one to Read',
      expectedOutcome: 'needs_input',
      previewRows: [{ label: 'Habit', contains: 'Read' }],
      oracles: [
        {
          kind: 'unchanged',
          sql: "SELECT COUNT(*) AS n FROM habit_completions hc JOIN habits h ON h.id = hc.habit_id WHERE h.name = 'Read'",
        },
      ],
    },
    {
      kind: 'commandPreview',
      input: 'delete my habits',
      expectedOutcome: 'unsupported',
      oracles: [
        {
          kind: 'unchanged',
          sql: "SELECT COUNT(*) AS n FROM habits WHERE name = 'Read' AND deleted_at IS NULL",
        },
      ],
    },
  ],
});

/** Persona D — returning user: a cross-feature overview remains read-only. */
export const commandReturningUser = defineScenario({
  id: 'command-v2-returning-user',
  personaId: 'weekend-returner',
  goal: 'Ask for a daily overview without changing accumulated local history',
  description:
    'A returning user asks for a bounded daily overview after accumulated history. In the deterministic local lane the provider-unavailable state is expected and must explicitly state that nothing changed.',
  risks: ['R6', 'R8'],
  fixture: 'TYPICAL',
  tags: ['command-v2', 'persona-d', 'journey'],
  steps: [
    {
      kind: 'askQuestion',
      question: 'How am I doing today?',
      expectedOutcome: 'unavailable',
    },
  ],
});
