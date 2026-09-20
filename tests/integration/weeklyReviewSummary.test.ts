import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import { listWeekDateKeys } from '@/features/weekly-review/weeklyReview.domain';

/**
 * Weekly-review F6: `buildWeeklyReviewSummary` must count only scheduled
 * habit days (M/W/F habits contribute 3, not 7) through the real data layer.
 *
 * Seed habits are backdated before the reviewed week so the
 * `isHabitActionableOn` write gate treats the week dates as actionable
 * (same pattern as `tests/integration/dateKeys.test.ts`).
 */

const WEEK_REF = '2026-08-19'; // Wednesday → review week Mon 2026-08-17 – Sun 2026-08-23

async function backdateHabit(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  habitId: string,
  createdAt: string,
  ruleHistory: string,
): Promise<void> {
  await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
    createdAt,
    ruleHistory,
    habitId,
  ]);
}

describe('buildWeeklyReviewSummary schedule-aware habit counts (F6)', () => {
  it('counts 3 scheduled days for an M/W/F habit alongside a daily habit', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { createHabitRule } = await import('@/features/habits/habits.domain');

    const mwfId = await habits.addHabit(
      'Gym',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [1, 3, 5],
    );
    const dailyId = await habits.addHabit('Read', 1);
    await backdateHabit(
      db,
      mwfId,
      '2026-08-01T12:00:00.000Z',
      JSON.stringify([createHabitRule('2026-08-01', [1, 3, 5], 1)]),
    );
    await backdateHabit(
      db,
      dailyId,
      '2026-08-01T12:00:00.000Z',
      JSON.stringify([createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1)]),
    );

    // M/W/F: complete Mon + Wed (2 of 3 scheduled).
    await habits.incrementHabit(mwfId, '2026-08-17');
    await habits.incrementHabit(mwfId, '2026-08-19');
    // Daily: complete all 7 local week days.
    for (const dateKey of listWeekDateKeys('2026-08-17', 7)) {
      await habits.incrementHabit(dailyId, dateKey);
    }

    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const summary = await buildWeeklyReviewSummary(WEEK_REF);

    expect(summary.week.startDateKey).toBe('2026-08-17');
    expect(summary.week.endDateKey).toBe('2026-08-23');
    // Old blind-7 logic reported 14 scheduled / 9 completed / 64% here.
    expect(summary.habits.scheduledOccurrences).toBe(10);
    expect(summary.habits.completedOccurrences).toBe(9);
    expect(summary.habits.consistencyPercent).toBe(90);
    expect(summary.habits.attention).toEqual([]);
    await db.closeAsync();
  });

  it('flags no_completions only for scheduled habits; zero-scheduled habits stay silent', async () => {
    const db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const { createHabitRule } = await import('@/features/habits/habits.domain');

    const mwfId = await habits.addHabit(
      'Gym',
      1,
      'anytime',
      'fitness-center',
      '#10b981',
      [1, 3, 5],
    );
    const futureId = await habits.addHabit('Future', 1);
    await backdateHabit(
      db,
      mwfId,
      '2026-08-01T12:00:00.000Z',
      JSON.stringify([createHabitRule('2026-08-01', [1, 3, 5], 1)]),
    );
    // Effective after the reviewed week: zero scheduled days inside it.
    await backdateHabit(
      db,
      futureId,
      '2026-08-24T12:00:00.000Z',
      JSON.stringify([createHabitRule('2026-08-24', [1, 2, 3, 4, 5, 6, 7], 1)]),
    );

    const { buildWeeklyReviewSummary } =
      await import('@/features/weekly-review/weeklyReview.summary');
    const summary = await buildWeeklyReviewSummary(WEEK_REF);

    expect(summary.habits.scheduledOccurrences).toBe(3);
    expect(summary.habits.completedOccurrences).toBe(0);
    expect(summary.habits.consistencyPercent).toBe(0);
    expect(summary.habits.attention).toEqual([
      expect.objectContaining({ habitId: mwfId, kind: 'no_completions' }),
    ]);
    await db.closeAsync();
  });
});
