import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Backdated habit check-in attribution.
 *
 * Habit source keys are per-habit-per-day (`${dateKey}:${habitId}`), so the
 * fast path may only fire for confirmed TODAY writes
 * (`shouldAwardHabitFastPath` in `habits.domain.ts`, wired into
 * `HabitsScreen.handleIncrement`). A day-strip backfill for a past day must
 * degrade to reconcile backfill with the action-day key: a today-keyed award
 * for a past-day increment would double-pay once reconcile awards the
 * action-day key, and would mark today active with no today action.
 *
 * This suite pins the reconcile half of that contract at the data layer: a
 * yesterday increment is awarded exactly once, under yesterday's key, and
 * never under today's.
 */

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

/**
 * Feature data layers must be imported AFTER `freshDatabase()` resets the
 * module registry — a static import would bind the previous test's database.
 */
async function loadModules() {
  const habits = await import('@/features/habits/habits.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const time = await import('@/lib/time');
  const domain = await import('@/features/gamification/gamification.domain');
  return { habits, gamification, time, domain };
}

async function countHabitEvents(): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = 'habit'`,
  );
  return row?.value ?? 0;
}

/** A habit that already existed yesterday, so a backdated increment is actionable. */
async function addHabitExistingYesterday(
  habits: Awaited<ReturnType<typeof loadModules>>['habits'],
  yesterday: string,
): Promise<string> {
  const habitId = await habits.addHabit('Backfill read', 1);
  const row = await db.getFirstAsync<{ rule_history: string }>(
    `SELECT rule_history FROM habits WHERE id = ?`,
    [habitId],
  );
  const rules = JSON.parse(row!.rule_history) as Record<string, unknown>[];
  for (const rule of rules) rule.effective_from_date = yesterday;
  await db.runAsync(`UPDATE habits SET rule_history = ?, created_at = ? WHERE id = ?`, [
    JSON.stringify(rules),
    `${yesterday}T12:00:00.000Z`,
    habitId,
  ]);
  return habitId;
}

describe('backdated habit check-in attribution', () => {
  it('a yesterday increment is awarded once, under yesterday key, never today', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const yesterday = domain.shiftDateKey(today, -1);
    expect(yesterday).not.toBe(today);

    const habitId = await addHabitExistingYesterday(habits, yesterday);
    const incremented = await habits.incrementHabit(habitId, yesterday);
    expect(incremented.count).toBeGreaterThan(0);

    // Reconcile pays the action day exactly once with the action-day key.
    const reconciledYesterday = await gamification.reconcileGamificationActivity({
      todayKey: yesterday,
    });
    expect(reconciledYesterday.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'habit'`,
    );
    expect(keys.map((row) => row.source_key)).toEqual([`${yesterday}:${habitId}`]);

    // Today's pass finds nothing: the backfill must not mint today activity.
    const reconciledToday = await gamification.reconcileGamificationActivity({
      todayKey: today,
    });
    expect(reconciledToday.awarded).toBe(0);
    expect(await countHabitEvents()).toBe(1);
  });

  it('a refused increment (unscheduled date) writes nothing and reconciles to zero', async () => {
    const { habits, gamification, time, domain } = await loadModules();
    const today = time.toDateKey();
    const yesterday = domain.shiftDateKey(today, -1);

    // Created today with an every-day rule effective today: yesterday is
    // pre-effective, so the write gate refuses it with count 0 (not a throw).
    const habitId = await habits.addHabit('Fresh habit', 1);
    const refused = await habits.incrementHabit(habitId, yesterday);
    expect(refused.count).toBe(0);

    expect(await gamification.reconcileGamificationActivity({ todayKey: yesterday })).toMatchObject(
      { awarded: 0 },
    );
    expect(await gamification.reconcileGamificationActivity({ todayKey: today })).toMatchObject({
      awarded: 0,
    });
    expect(await countHabitEvents()).toBe(0);
  });
});
