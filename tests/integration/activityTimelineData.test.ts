import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Wave 7 (Functional Completion V1): the Activity Timeline read model
 * (`activityTimeline.data.ts`) previously executed only against a hand-rolled
 * `getAllAsync` stub. These contracts run its nine source queries against
 * real SQLite rows persisted through the unmodified feature data layers,
 * proving the documented semantics end-to-end:
 *
 *   - one correct item per source with real titles/date buckets;
 *   - F3 history preservation for completions of soft-deleted habits vs
 *     exclusion of soft-deleted todos/workout routines;
 *   - F5 authoritative `date_key` bucketing beating `updated_at` for habits;
 *   - F6 local-midnight-anchored window bounds;
 *   - per-day calorie aggregation and create+complete project/goal events.
 */

function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

describe('activityTimeline.data (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('derives one correct item per source from real persisted rows', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const workout = await import('@/features/workout/workout.data');
    const calories = await import('@/features/calories/calories.data');
    const weekly = await import('@/features/weekly-review/weeklyReview.data');
    const plans = await import('@/features/daily-plan/dailyPlan.data');
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const { buildActivityTimeline } = await import('@/features/activity/activityTimeline.data');

    const todayKey = toDateKey();
    const nowMs = Date.now();

    const ship = await todos.addTodo({ title: 'Ship report' });
    await todos.completeTodo(ship);
    const erased = await todos.addTodo({ title: 'Ghost task' });
    await todos.completeTodo(erased);
    await todos.removeTodo(erased);

    const meditate = await habits.addHabit('Meditate', 1);
    await habits.incrementHabit(meditate, todayKey);
    const old = await habits.addHabit('Old ritual', 1);
    await habits.incrementHabit(old, todayKey);
    await habits.deleteHabit(old);
    // A completion whose habits row is gone entirely (orphan/remote edge) is
    // the only case the neutral fallback label exists for; a soft-deleted
    // habit keeps resolving its real name through the LEFT JOIN.
    const nowStamp = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ('hcmp_orphan_seed', 'habit_missing_row', ?, 1, ?, ?)`,
      [todayKey, nowStamp, nowStamp],
    );

    await pomodoro.logPomodoroSession(
      new Date(nowMs).toISOString(),
      new Date(nowMs + 1500_000).toISOString(),
      1500,
      'focus',
    );
    await pomodoro.logPomodoroSession(
      new Date(nowMs).toISOString(),
      new Date(nowMs + 300_000).toISOString(),
      300,
      'short_break',
    );

    await workout.addRoutine('Timeline Legs', 'seed');
    const legsId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Timeline Legs'`,
    ))!.id;
    await workout.completeRoutine(legsId);
    await workout.addRoutine('Erased Routine', 'seed');
    const erasedRoutineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Erased Routine'`,
    ))!.id;
    await workout.completeRoutine(erasedRoutineId);
    await workout.deleteRoutine(erasedRoutineId);

    await calories.addCalorieEntry({
      foodName: 'Rice',
      calories: 300,
      mealType: 'lunch',
      consumedOn: todayKey,
    });
    await calories.addCalorieEntry(
      { foodName: 'Fish', calories: 200, mealType: 'dinner', consumedOn: todayKey },
      { maintainSavedMeal: false },
    );

    await weekly.saveWeeklyReview({
      weekKey: todayKey,
      weekStartDate: shiftKey(todayKey, -6),
      weekEndDate: todayKey,
      nextWeekStartDate: shiftKey(todayKey, 1),
      summaryPayload: '{}',
      planPayload: '{}',
      reflection: 'week done',
    });

    await plans.completeDailyPlan(todayKey, { energyScore: 4 });

    const launch = await projects.addProject({ name: 'Launch' });
    await projects.setProjectStatus(launch, 'completed');
    const run5k = await goals.addGoal({ title: 'Run 5k', progressPercent: 50 });
    await goals.setGoalStatus(run5k, 'completed');

    const items = await buildActivityTimeline({ days: 30, now: new Date() });
    const titles = new Set(items.map((i) => i.title));
    const byTitle = new Map(items.map((i) => [i.title, i]));

    expect(titles.has('Completed "Ship report"')).toBe(true);
    expect(titles.has('Completed "Ghost task"')).toBe(false);
    expect(titles.has('Completed "Meditate"')).toBe(true);
    // F3: a soft-deleted habit's completion survives with its real name;
    // a fully orphaned completion falls back to the neutral label.
    expect(titles.has('Completed "Old ritual"')).toBe(true);
    expect(titles.has('Completed "a deleted habit"')).toBe(true);
    expect(titles.has('Focus session · 25 min')).toBe(true);
    expect(titles.has('Break · 5 min')).toBe(true);
    expect(titles.has('Workout · Timeline Legs')).toBe(true);
    expect(titles.has('Workout · Erased Routine')).toBe(false);
    expect(titles.has('Logged 2 meals · 500 kcal')).toBe(true);
    expect(titles.has('Weekly review completed')).toBe(true);
    expect(titles.has('Daily plan completed')).toBe(true);
    expect(titles.has('Created project "Launch"')).toBe(true);
    expect(titles.has('Completed project "Launch"')).toBe(true);
    expect(titles.has('Created goal "Run 5k"')).toBe(true);
    expect(titles.has('Completed goal "Run 5k"')).toBe(true);

    expect(byTitle.get('Daily plan completed')?.subtitle).toBe(`Plan ${todayKey} · energy 4/5`);
    expect(byTitle.get('Weekly review completed')?.subtitle).toBe(todayKey);
    const calorieItem = byTitle.get('Logged 2 meals · 500 kcal');
    expect(calorieItem?.dateKey).toBe(todayKey);
    expect(calorieItem?.source).toBe('calories');
    const habitItem = byTitle.get('Completed "Meditate"');
    expect(habitItem?.dateKey).toBe(todayKey);
    expect(habitItem?.subtitle).toBe(`Habit · ${todayKey}`);
  });

  it('anchors the fetch window to local midnight, not time-of-day (F6)', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const todos = await import('@/features/todos/todos.data');
    const { buildActivityTimeline } = await import('@/features/activity/activityTimeline.data');

    const todayKey = toDateKey();

    const inWindow = await todos.addTodo({ title: 'Three days ago' });
    await todos.completeTodo(inWindow);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      new Date(`${shiftKey(todayKey, -3)}T12:00:00`).toISOString(),
      inWindow,
    ]);

    // Exactly the oldest included local day (window of 7 = today − 6 at
    // midnight): even the first minute of that day must be fetched.
    const edgeDay = await todos.addTodo({ title: 'Edge day start' });
    await todos.completeTodo(edgeDay);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      new Date(`${shiftKey(todayKey, -6)}T00:00:01`).toISOString(),
      edgeDay,
    ]);

    const outOfWindow = await todos.addTodo({ title: 'Seven days ago' });
    await todos.completeTodo(outOfWindow);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      new Date(`${shiftKey(todayKey, -7)}T23:59:00`).toISOString(),
      outOfWindow,
    ]);

    const titles = new Set(
      (await buildActivityTimeline({ days: 7, now: new Date() })).map((i) => i.title),
    );
    expect(titles.has('Completed "Three days ago"')).toBe(true);
    expect(titles.has('Completed "Edge day start"')).toBe(true);
    expect(titles.has('Completed "Seven days ago"')).toBe(false);
  });

  it('buckets habit items by the authoritative date_key, not updated_at (F5)', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const habits = await import('@/features/habits/habits.data');
    const { buildActivityTimeline } = await import('@/features/activity/activityTimeline.data');

    const todayKey = toDateKey();
    const backdatedKey = shiftKey(todayKey, -3);

    const habitId = await habits.addHabit('Journal', 1);
    // Backdate creation so the pre-creation write gate accepts the earlier
    // day, then write a backdated completion: updated_at = now but date_key =
    // the day it actually happened.
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      new Date(`${shiftKey(todayKey, -10)}T12:00:00`).toISOString(),
      '[]',
      habitId,
    ]);
    await habits.incrementHabit(habitId, backdatedKey);

    const items = await buildActivityTimeline({ days: 30, now: new Date() });
    const item = items.find((i) => i.title === 'Completed "Journal"');
    expect(item).toBeDefined();
    expect(item!.dateKey).toBe(backdatedKey);
    expect(item!.occurredAt >= new Date(`${backdatedKey}T00:00:00`).toISOString()).toBe(true);
  });
});
