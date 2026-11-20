import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * REVIEW FINDING (progress/activity/momentum slice): the Momentum Garden's
 * "bounded read" caps are applied to the WRONG end of the window.
 *
 * `momentum.data.ts` limits its timestamp sources with `ORDER BY … ASC LIMIT
 * 500` (§ "explicit limits for high-volume timestamp sources"). Ascending order
 * selects the OLDEST rows of the requested window, so on a heavy window the
 * newest days — the ones the Garden is actually about — are dropped while stale
 * days at the front of the window keep their growth. The Garden then reports a
 * Today with no contributions even though the user completed a workout minutes
 * ago, and it disagrees with Progress and the Activity Timeline, which both
 * count the same rows without that cap.
 */
describe('Momentum Garden bounded caps keep the newest facts', async () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  function localIso(daysAgo: number, hour = 12): string {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  }

  it('still reports today after a full window of older workouts', async () => {
    db = await freshDatabase();
    const { toDateKey } = await import('@/lib/time');
    const workout = await import('@/features/workout/workout.data');
    const { MOMENTUM_LIMITS } = await import('@/features/momentum/momentum.types');
    const { getMomentumGarden: readGarden } = await import('@/features/momentum/momentum.data');

    // A 28-day window's worth of older sessions exhausts the source cap.
    await workout.addRoutine('Cap probe', 'seed');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Cap probe'`,
    ))!.id;
    for (let i = 0; i < MOMENTUM_LIMITS.queryRowsPerTimestampSource; i += 1) {
      await workout.completeRoutine(routineId);
    }
    await db.runAsync(`UPDATE workout_logs SET completed_at = ?`, [localIso(27, 9)]);

    // …and the user's real, newest session of the day.
    await workout.completeRoutine(routineId);

    const garden = await readGarden({ todayKey: toDateKey(), days: 28 });
    expect(garden.today.contributions.workout.level).toBe(1);
    expect(garden.today.activeSources).toContain('workout');
  });
});
