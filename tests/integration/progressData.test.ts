import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Wave 7 (Functional Completion V1): Progress Insights' SQL surface
 * (`progress.data.ts`) previously executed only against `vi.mock`ed databases.
 * These contracts run its real aggregate queries against real SQLite rows
 * written through the unmodified feature data layers, proving:
 *
 *   - current/prior window arithmetic (half-open UTC bounds, local day keys);
 *   - soft-delete exclusion for todos/calories/weekly reviews vs the F3
 *     canonical history rule for habit completions (counted unjoined);
 *   - focus-minute aggregation restricted to `session_type = 'focus'`;
 *   - DISTINCT calorie day counting, goal-average scoping, and the app_meta
 *     calorie-goal pass-through.
 */

function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

describe('progress.data (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('aggregates every current/previous window metric from real persisted rows', async () => {
    db = await freshDatabase();
    const { buildProgressDateRange } = await import('@/features/progress/progress.domain');
    const range = buildProgressDateRange(new Date(), 7);
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const workout = await import('@/features/workout/workout.data');
    const calories = await import('@/features/calories/calories.data');
    const weekly = await import('@/features/weekly-review/weeklyReview.data');
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const progress = await import('@/features/progress/progress.data');

    const prevInstant = new Date(Date.parse(range.previousStartUtcIso) + 3_600_000).toISOString();

    // Todos: completed now (current), backdated into previous, completed but
    // soft-deleted (excluded), and still open (excluded).
    const doneNow = await todos.addTodo({ title: 'Done today' });
    await todos.completeTodo(doneNow);
    const donePrev = await todos.addTodo({ title: 'Done last week' });
    await todos.completeTodo(donePrev);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [prevInstant, donePrev]);
    const doneGone = await todos.addTodo({ title: 'Done then deleted' });
    await todos.completeTodo(doneGone);
    await todos.removeTodo(doneGone);
    await todos.addTodo({ title: 'Still open' });

    // Habits: one row in each window (date_key), plus a completion whose habit
    // was later deleted — F3 keeps counting it. Increments are gated at the
    // habit's creation date, so the previous-window seed backdates creation.
    const stretch = await habits.addHabit('Stretch', 1);
    await habits.incrementHabit(stretch, range.currentEnd);
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      new Date(`${shiftKey(range.currentEnd, -10)}T12:00:00`).toISOString(),
      '[]',
      stretch,
    ]);
    await habits.incrementHabit(stretch, range.previousEnd);
    const gone = await habits.addHabit('Gone habit', 1);
    await habits.incrementHabit(gone, range.currentEnd);
    await habits.deleteHabit(gone);

    // Pomodoro: 25 min focus now + a break (must never enter focus stats) +
    // one 10-min focus inside the previous window.
    const nowMs = Date.now();
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
    await pomodoro.logPomodoroSession(
      prevInstant,
      new Date(Date.parse(prevInstant) + 600_000).toISOString(),
      600,
      'focus',
    );

    // Workouts: one completed now, one backdated into the previous window.
    await workout.addRoutine('Progress Push', 'contract seed');
    const pushId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Progress Push'`,
    ))!.id;
    await workout.completeRoutine(pushId);
    await workout.addRoutine('Old Push', 'contract seed');
    const oldId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Old Push'`,
    ))!.id;
    await workout.completeRoutine(oldId);
    await db.runAsync('UPDATE workout_logs SET completed_at = ? WHERE routine_id = ?', [
      prevInstant,
      oldId,
    ]);

    // Calories: two entries on the same current day (1 tracked day), one day
    // in the previous window, and a deleted third current day (must vanish).
    await calories.addCalorieEntry({
      foodName: 'Oats',
      calories: 300,
      mealType: 'breakfast',
      consumedOn: range.currentEnd,
    });
    await calories.addCalorieEntry(
      { foodName: 'Tea', calories: 50, mealType: 'snack', consumedOn: range.currentEnd },
      { maintainSavedMeal: false },
    );
    await calories.addCalorieEntry(
      { foodName: 'Soup', calories: 200, mealType: 'lunch', consumedOn: range.previousEnd },
      { maintainSavedMeal: false },
    );
    await calories.addCalorieEntry(
      {
        foodName: 'Gone smoothie',
        calories: 400,
        mealType: 'snack',
        consumedOn: range.currentStart,
      },
      { maintainSavedMeal: false },
    );
    const goneCal = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM calorie_entries WHERE food_name = 'Gone smoothie'`,
    ))!.id;
    await calories.deleteCalorieEntry(goneCal);

    // Weekly reviews: one completed now, one backdated, one completed then
    // deleted (soft delete must remove it from the count).
    await weekly.saveWeeklyReview({
      weekKey: range.currentEnd,
      weekStartDate: range.currentStart,
      weekEndDate: range.currentEnd,
      nextWeekStartDate: shiftKey(range.currentEnd, 1),
      summaryPayload: '{}',
      planPayload: '{}',
      reflection: 'current',
    });
    const prevReviewId = await weekly.saveWeeklyReview({
      weekKey: range.previousEnd,
      weekStartDate: shiftKey(range.previousEnd, -6),
      weekEndDate: range.previousEnd,
      nextWeekStartDate: range.currentStart,
      summaryPayload: '{}',
      planPayload: '{}',
      reflection: 'previous',
    });
    await db.runAsync('UPDATE weekly_reviews SET completed_at = ? WHERE id = ?', [
      prevInstant,
      prevReviewId,
    ]);
    const doomedReviewId = await weekly.saveWeeklyReview({
      weekKey: '1999-W01',
      weekStartDate: '1999-12-27',
      weekEndDate: '2000-01-02',
      nextWeekStartDate: '2000-01-03',
      summaryPayload: '{}',
      planPayload: '{}',
      reflection: 'doomed',
    });
    await weekly.deleteWeeklyReview(doomedReviewId);

    // Projects/goals: one active project; goals average excludes the
    // completed goal (40 + 80 → 60; a 100% completed goal must not lift it).
    await projects.addProject({ name: 'Active project' });
    await goals.addGoal({ title: 'Goal A', progressPercent: 40 });
    await goals.addGoal({ title: 'Goal B', progressPercent: 80 });
    const finishedGoal = await goals.addGoal({ title: 'Finished goal', progressPercent: 100 });
    await goals.setGoalStatus(finishedGoal, 'completed');

    await calories.setCalorieGoal({ calories: 2500, protein: 150, carbs: 250, fats: 80 });

    const data = await progress.getProgressRawData(7);

    expect(data.range).toEqual({
      currentStart: range.currentStart,
      currentEnd: range.currentEnd,
      previousStart: range.previousStart,
      previousEnd: range.previousEnd,
    });
    expect(data.todoCurrent).toBe(1);
    expect(data.todoPrevious).toBe(1);
    expect(data.habitCurrent).toBe(2);
    expect(data.habitPrevious).toBe(1);
    expect(data.focusMinutesCurrent).toBe(25);
    expect(data.focusSessionsCurrent).toBe(1);
    expect(data.focusMinutesPrevious).toBe(10);
    expect(data.focusSessionsPrevious).toBe(1);
    expect(data.workoutCurrent).toBe(1);
    expect(data.workoutPrevious).toBe(1);
    expect(data.calorieDaysCurrent).toBe(1);
    expect(data.calorieDaysPrevious).toBe(1);
    expect(data.weeklyCurrent).toBe(1);
    expect(data.weeklyPrevious).toBe(1);
    expect(data.activeProjects).toBe(1);
    expect(data.activeGoals).toBe(2);
    expect(data.goalsProgress).toBe(60);
    expect(data.calorieGoal).toBe(2500);
  });

  it('honours half-open UTC window bounds at the exact boundary instants', async () => {
    db = await freshDatabase();
    const { buildProgressDateRange } = await import('@/features/progress/progress.domain');
    const range = buildProgressDateRange(new Date(), 7);
    const todos = await import('@/features/todos/todos.data');
    const progress = await import('@/features/progress/progress.data');

    const atStart = await todos.addTodo({ title: 'Exactly at window start' });
    await todos.completeTodo(atStart);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      range.currentStartUtcIso,
      atStart,
    ]);

    // The exclusive end instant belongs to the NEXT window: counted nowhere.
    const atEnd = await todos.addTodo({ title: 'Exactly at exclusive end' });
    await todos.completeTodo(atEnd);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      range.currentEndUtcExclusiveIso,
      atEnd,
    ]);

    const atPrevStart = await todos.addTodo({ title: 'Exactly at previous start' });
    await todos.completeTodo(atPrevStart);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      range.previousStartUtcIso,
      atPrevStart,
    ]);

    const data = await progress.getProgressRawData(7);
    expect(data.todoCurrent).toBe(1);
    expect(data.todoPrevious).toBe(1);
  });

  it('countTodosCompletedBetween scopes to one local day and skips deleted/pending rows', async () => {
    db = await freshDatabase();
    const { getUtcIsoRangeForLocalDateKeys, toDateKey } = await import('@/lib/time');
    const todos = await import('@/features/todos/todos.data');
    const progress = await import('@/features/progress/progress.data');

    const todayKey = toDateKey();
    const yesterdayKey = shiftKey(todayKey, -1);

    const todayDone = await todos.addTodo({ title: 'Done today' });
    await todos.completeTodo(todayDone);
    const yesterdayDone = await todos.addTodo({ title: 'Done yesterday' });
    await todos.completeTodo(yesterdayDone);
    await db.runAsync('UPDATE todos SET completed_at = ? WHERE id = ?', [
      new Date(`${yesterdayKey}T12:00:00`).toISOString(),
      yesterdayDone,
    ]);
    const pending = await todos.addTodo({ title: 'Pending' });
    expect(pending).toBeTruthy();
    const deletedDone = await todos.addTodo({ title: 'Deleted after done' });
    await todos.completeTodo(deletedDone);
    await todos.removeTodo(deletedDone);

    const window = getUtcIsoRangeForLocalDateKeys(todayKey, todayKey);
    expect(
      await progress.countTodosCompletedBetween(window.startUtcIso, window.endUtcExclusiveIso),
    ).toBe(1);
    const yesterdayWindow = getUtcIsoRangeForLocalDateKeys(yesterdayKey, yesterdayKey);
    expect(
      await progress.countTodosCompletedBetween(
        yesterdayWindow.startUtcIso,
        yesterdayWindow.endUtcExclusiveIso,
      ),
    ).toBe(1);
  });
});
