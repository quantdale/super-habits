import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * The Weekly Review can be opened any day (Planning hub, not only the Sunday
 * reminder), and it always reviews the CURRENT Monday–Sunday week. Habit
 * consistency counted every scheduled day of that week, including days that
 * have not happened yet, so a Wednesday review of a perfectly kept daily habit
 * alongside a Friday-only habit read "38% habit consistency" and Friday was
 * flagged "No completions this week" before Friday arrived. The habit
 * scheduling spec requires future dates to be excluded from consistency
 * denominators (habit-scheduling-and-history-semantics).
 */
async function backdateHabit(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  habitId: string,
  ruleHistory: string,
): Promise<void> {
  await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
    '2026-08-01T12:00:00.000Z',
    ruleHistory,
    habitId,
  ]);
}

describe('weekly review habit consistency mid-week', () => {
  let db: TestDatabase | undefined;

  afterEach(async () => {
    await db?.closeAsync();
    db = undefined;
    vi.useRealTimers();
  });

  it.each([0, 23])('counts elapsed local days at %i:30, including today', async (hour) => {
    // Wednesday locally, even when the UTC date is Tuesday or Thursday.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 19, hour, 30));

    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { createHabitRule } = await import('@/features/habits/habits.domain');

    const dailyId = await habits.addHabit('Read', 1);
    const fridayId = await habits.addHabit(
      'Long run',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [5],
    );
    await backdateHabit(
      db,
      dailyId,
      JSON.stringify([createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1)]),
    );
    await backdateHabit(db, fridayId, JSON.stringify([createHabitRule('2026-08-01', [5], 1)]));

    for (const dateKey of ['2026-08-17', '2026-08-18', '2026-08-19']) {
      await habits.incrementHabit(dailyId, dateKey);
    }

    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const summary = await buildWeeklyReviewSummary();

    expect(summary.week.startDateKey).toBe('2026-08-17');
    expect(summary.habits).toMatchObject({
      scheduledOccurrences: 3,
      completedOccurrences: 3,
      consistencyPercent: 100,
      attention: [],
    });
    expect(summary.attention.map((item) => item.kind)).not.toContain('habit_consistency_low');
    expect(summary.attention.map((item) => item.kind)).not.toContain('habit_attention');
    expect(summary.wins.map((item) => item.kind)).toContain('habit_consistency_high');
  });

  it('keeps counting the whole week when reviewing a past week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 26, 10, 0, 0, 0));

    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { createHabitRule } = await import('@/features/habits/habits.domain');
    const dailyId = await habits.addHabit('Read', 1);
    await backdateHabit(
      db,
      dailyId,
      JSON.stringify([createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1)]),
    );
    await habits.incrementHabit(dailyId, '2026-08-17');

    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const summary = await buildWeeklyReviewSummary('2026-08-19');

    expect(summary.habits).toMatchObject({ scheduledOccurrences: 7, completedOccurrences: 1 });
  });

  it('does not report misses for a wholly future week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 19, 10));
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    await habits.addHabit('Read', 1);

    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const summary = await buildWeeklyReviewSummary('2026-08-26');

    expect(summary.habits).toEqual({
      scheduledOccurrences: 0,
      completedOccurrences: 0,
      consistencyPercent: null,
      attention: [],
    });
  });
});
