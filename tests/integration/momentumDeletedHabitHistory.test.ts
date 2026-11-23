import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * REVIEW FINDING (progress/activity/momentum slice): the three history
 * surfaces disagreed about a completion whose habit was later deleted.
 *
 * Progress (`countHabitCompletions`) deliberately does NOT join `habits`
 * (F3 canonical history rule), and the Activity Timeline keeps those rows
 * through a LEFT JOIN with a neutral `Logged "a deleted habit"` label. Both
 * state the same rule: "a completion happened on date X" survives deletion.
 * Momentum Garden instead dropped the whole day: `getMomentumGarden` selected
 * only `h.deleted_at IS NULL` habits, and `collectHabitDates` skipped any
 * completion whose habit row was absent from that list — so deleting a habit
 * silently erased a documented contribution from Today, the recent history,
 * the source explanations and the module's own `activeDays` count.
 *
 * Remove a habit the user *does* own (the Habits detail sheet Delete action)
 * and the Garden summary the user sees one surface away contradicted the
 * Progress number and the Timeline entry for the same event.
 */
describe('Momentum Garden habit history survives habit deletion', async () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('keeps a deleted habit completion as growth, matching Progress and the Timeline', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const habits = await import('@/features/habits/habits.data');
    const progress = await import('@/features/progress/progress.data');
    const { buildActivityTimeline } = await import('@/features/activity/activityTimeline.data');
    const { getMomentumGarden } = await import('@/features/momentum/momentum.data');

    const todayKey = toDateKey();
    const habitId = await habits.addHabit('Deleted probe', 1);
    await habits.incrementHabit(habitId, todayKey);
    await habits.deleteHabit(habitId);

    const raw = await progress.getProgressRawData(7);
    const timeline = await buildActivityTimeline({ days: 30 });
    const garden = await getMomentumGarden({ todayKey, days: 7 });

    // Progress and the Timeline are the F3 reference behaviour.
    expect(raw.habitCurrent).toBe(1);
    const habitItems = timeline.items.filter((item) => item.source === 'habit');
    expect(habitItems).toHaveLength(1);
    expect(habitItems[0].title).toBe('Logged "Deleted probe"');
    expect(habitItems[0].dateKey).toBe(todayKey);

    // The Garden must report the same event: one scheduled, completed habit
    // day, attributed to the Habits area with its real identity.
    expect(garden.today.contributions.habits.level).toBe(1);
    expect(garden.today.contributions.habits.count).toBe(1);
    expect(garden.today.activeSources).toContain('habits');
    expect(garden.today.hasGrowth).toBe(true);
    expect(garden.activeDays).toBe(1);
  });

  it('still reports a deleted habit that was never completed as neutral', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const habits = await import('@/features/habits/habits.data');
    const { getMomentumGarden } = await import('@/features/momentum/momentum.data');

    // Deleting an unfinished habit is not activity, and the Garden is not
    // "today's obligations": with no completion there is nothing to report.
    const todayKey = toDateKey();
    const never = await habits.addHabit('Never logged', 1);
    await habits.deleteHabit(never);

    const garden = await getMomentumGarden({ todayKey, days: 7 });
    expect(garden.today.contributions.habits.level).toBe(0);
    expect(garden.activeDays).toBe(0);
  });
});
