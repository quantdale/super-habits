import { describe, expect, it } from 'vitest';
import { seedMature } from './fixtures';

/**
 * Heavy-state hot-path timings on the MATURE corpus (Wave 4).
 *
 * Scenario: 7-month user, ~9k rows, cold in-memory SQLite, this host.
 * Each claim below prints `scenario + rows + ms` for the campaign ledger.
 * The 5000ms ceilings are regression tripwires with ~50-100x headroom over
 * the expected millisecond scale — not product performance budgets (those
 * live with J8/CG-4/CG-5 on web and the native lanes). No query plan or
 * render changes are justified from these numbers alone.
 */

const START_KEY = '2025-12-04';
const END_KEY = '2026-07-01';
const CEILING_MS = 5000;

async function timed<T>(label: string, task: () => Promise<{ rows: T[] }>): Promise<T[]> {
  const start = performance.now();
  const { rows } = await task();
  const ms = performance.now() - start;
  console.warn(`[corpus-perf] ${label}: ${rows.length} rows in ${ms.toFixed(1)}ms`);
  expect(ms).toBeLessThan(CEILING_MS);
  return rows;
}

// CG-9: seeding ~9k rows plus full-table scans is not a timing contract;
// the per-query ceilings above are the actual performance tripwires.
describe('corpus heavy-state hot paths', { timeout: 120_000 }, () => {
  it('serves every hot path well within tripwire ceilings', async () => {
    await seedMature();
    const todosData = await import('@/features/todos/todos.data');
    const habitsData = await import('@/features/habits/habits.data');
    const caloriesData = await import('@/features/calories/calories.data');
    const workoutData = await import('@/features/workout/workout.data');
    const pomodoroData = await import('@/features/pomodoro/pomodoro.data');
    const projectsData = await import('@/features/projects/projects.data');

    const pending = await timed('todos pending list', async () => ({
      rows: await todosData.listPendingTodos(),
    }));
    expect(pending.length).toBeGreaterThan(0);

    const completions = await timed('habit year history', async () => ({
      rows: await habitsData.getAllHabitCompletionsForRange(START_KEY, END_KEY),
    }));
    expect(completions.length).toBeGreaterThan(3000);

    const diary = await timed('calorie diary range', async () => ({
      rows: await caloriesData.listCalorieEntriesInRange(START_KEY, END_KEY),
    }));
    expect(diary.length).toBeGreaterThan(600);

    const summary = await timed('calorie summary range', async () => ({
      rows: await caloriesData.getCalorieSummaryByRange(START_KEY, END_KEY),
    }));
    expect(summary.length).toBeGreaterThan(200);

    const search = await timed('saved-meal search', async () => ({
      rows: await caloriesData.searchSavedMeals('oat'),
    }));
    expect(search.length).toBeGreaterThanOrEqual(1);

    const routines = await timed('workout routines', async () => ({
      rows: await workoutData.listRoutines(),
    }));
    expect(routines.length).toBeGreaterThan(0);

    const logs = await timed('workout log range', async () => ({
      rows: await workoutData.listWorkoutLogsForRange(START_KEY, END_KEY),
    }));
    expect(logs.length).toBeGreaterThan(0);

    const rollups = await timed('project rollups', async () => ({
      rows: Object.values(await projectsData.listProjectRollups()),
    }));
    expect(rollups.length).toBeGreaterThan(0);

    const sessions = await timed('pomodoro range', async () => ({
      rows: await pomodoroData.listPomodoroSessionsForDateRange(START_KEY, END_KEY),
    }));
    expect(sessions.length).toBeGreaterThan(0);
  });
});
