import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Workout gamification attribution.
 *
 * Regression cover for the "award oldest unrewarded" trap: both workout
 * finish paths (`logWorkoutSession`, `completeRoutine`) must expose the log
 * id they just wrote, and the fast path (`awardGamificationAction` without an
 * explicit entityId) must NOT silently credit the oldest unrewarded log.
 * Missed fast-path reports degrade to reconcile backfill, which always
 * passes explicit ids.
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
  const workout = await import('@/features/workout/workout.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const time = await import('@/lib/time');
  return { workout, gamification, time };
}

async function countWorkoutEvents(): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = 'workout'`,
  );
  return row?.value ?? 0;
}

async function createRoutine(): Promise<string> {
  const { workout } = await loadModules();
  await workout.addRoutine('Push', '');
  const [routine] = await workout.listRoutines();
  return routine.id;
}

describe('workout gamification attribution', () => {
  it('completeRoutine exposes the log id and the award lands on that exact log', async () => {
    const { workout, gamification } = await loadModules();
    const routineId = await createRoutine();

    const result = await workout.completeRoutine(routineId);
    expect(result.status).toBe('applied');
    expect(result.logId).toMatch(/^wrk_/);

    const outcome = await gamification.awardGamificationAction({
      kind: 'workout',
      entityId: result.logId!,
    });
    expect(outcome?.result.events[0]).toMatchObject({
      kind: 'workout',
      sourceKey: result.logId,
    });

    // Re-awarding the same log is a no-op: the ledger's unique
    // (kind, source key) index is the single source of truth.
    expect(
      await gamification.awardGamificationAction({
        kind: 'workout',
        entityId: result.logId!,
      }),
    ).toBeNull();
    expect(await countWorkoutEvents()).toBe(1);
  });

  it('logWorkoutSession exposes the log id and the award lands on that exact log', async () => {
    const { workout, gamification } = await loadModules();
    const routineId = await createRoutine();

    const result = await workout.logWorkoutSession({
      routineId,
      exercises: [{ exerciseName: 'Squat', setsCompleted: 3 }],
    });
    expect(result.status).toBe('applied');
    expect(result.logId).toMatch(/^wrk_/);

    const row = await db.getFirstAsync<{ id: string }>(`SELECT id FROM workout_logs WHERE id = ?`, [
      result.logId!,
    ]);
    expect(row?.id).toBe(result.logId);

    const outcome = await gamification.awardGamificationAction({
      kind: 'workout',
      entityId: result.logId!,
    });
    expect(outcome?.result.events[0]).toMatchObject({ sourceKey: result.logId });
  });

  it('a workout award without entityId is a miss, not an award for the oldest unrewarded log', async () => {
    const { workout, gamification, time } = await loadModules();
    const routineId = await createRoutine();
    const today = time.toDateKey();

    // Two finished workouts, oldest first. On the old behavior this call
    // awarded the FIRST (oldest) log — crediting the wrong session.
    await workout.completeRoutine(routineId);
    await workout.completeRoutine(routineId);

    expect(await gamification.awardGamificationAction({ kind: 'workout' })).toBeNull();
    expect(await countWorkoutEvents()).toBe(0);

    // Reconcile backfills both with their correct ids — nothing is lost.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(2);
    expect(await countWorkoutEvents()).toBe(2);
  });

  it('awarding the newest log leaves the oldest for reconcile (no cross-attribution)', async () => {
    const { workout, gamification, time } = await loadModules();
    const routineId = await createRoutine();
    const today = time.toDateKey();

    const oldest = await workout.completeRoutine(routineId);
    const newest = await workout.completeRoutine(routineId);
    expect(oldest.logId).not.toBe(newest.logId);

    // The just-finished (newest) session reports its own id.
    const outcome = await gamification.awardGamificationAction({
      kind: 'workout',
      entityId: newest.logId!,
    });
    expect(outcome?.result.events[0]).toMatchObject({ sourceKey: newest.logId });

    // The oldest log is still unrewarded and reconcile credits exactly it.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'workout'`,
    );
    expect(keys.map((row) => row.source_key).sort()).toEqual([oldest.logId!, newest.logId!].sort());
  });

  it('a skipped quick-complete exposes no log id and earns no fast-path award', async () => {
    const { workout, gamification } = await loadModules();

    const result = await workout.completeRoutine('wrk_missing_routine');
    expect(result.status).toBe('skipped');
    expect(result.logId).toBeNull();

    // No row was written, so there is nothing to award even via reconcile.
    expect(await gamification.awardGamificationAction({ kind: 'workout' })).toBeNull();
    expect(await countWorkoutEvents()).toBe(0);
  });
});

describe('late workout rewards', () => {
  const finishDay = '2026-10-12';

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 23, 50));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await db.closeAsync();
  });

  async function prepareFinishedWorkout() {
    const { workout } = await loadModules();
    const routineId = await createRoutine();
    const input = {
      routineId,
      startedAt: new Date(2026, 9, 12, 23, 30).toISOString(),
      endedAt: new Date().toISOString(),
      exercises: [{ exerciseName: 'Squat', setsCompleted: 1 }],
    };
    return async (day: number) => {
      vi.setSystemTime(new Date(2026, 9, day, 0, 10));
      const result = await workout.logWorkoutSession(input);
      expect(result.status).toBe('applied');
      const { logId } = result;
      if (!logId) throw new Error('Workout was not saved');
      return logId;
    };
  }

  it('credits the finish day for XP, streak, quest and perfect day after midnight', async () => {
    const { gamification } = await loadModules();
    const habits = await import('@/features/habits/habits.data');
    const habitId = await habits.addHabit('Read', 1);
    await habits.incrementHabit(habitId);
    const save = await prepareFinishedWorkout();
    const logId = await save(13);

    const award = await gamification.awardGamificationAction({ kind: 'workout', entityId: logId });
    expect(award?.result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'workout', sourceKey: logId, dateKey: finishDay }),
        expect.objectContaining({
          kind: 'quest',
          sourceKey: `${finishDay}:move_body`,
          dateKey: finishDay,
        }),
        expect.objectContaining({ kind: 'perfect_day', dateKey: finishDay }),
      ]),
    );
    expect(award?.snapshot.streak).toMatchObject({ current: 1, activeToday: false });
    expect(award?.snapshot.week.slice(-2)).toMatchObject([
      { dateKey: finishDay, active: true },
      { dateKey: '2026-10-13', active: false },
    ]);
    expect(award?.snapshot.todayFacts).toMatchObject({ workouts: 0, xpEarned: 0 });

    expect(await save(13)).toBe(logId);
    expect(
      await gamification.awardGamificationAction({ kind: 'workout', entityId: logId }),
    ).toBeNull();
    await gamification.runGamificationHousekeeping();
    expect(await db.getAllAsync('SELECT id FROM workout_logs')).toEqual([{ id: logId }]);
    expect(await countWorkoutEvents()).toBe(1);
    expect(
      await db.getAllAsync("SELECT id FROM gamification_events WHERE date_key = '2026-10-13'"),
    ).toEqual([]);
  });

  it.each(['reported', 'reconciled'])(
    'credits the save day outside the window when %s',
    async (path) => {
      const { gamification } = await loadModules();
      const save = await prepareFinishedWorkout();
      const logId = await save(20);
      const saveDay = '2026-10-20';

      if (path === 'reported') {
        await gamification.awardGamificationAction({ kind: 'workout', entityId: logId });
      } else {
        // The app may reopen the next day before any reward was written.
        vi.setSystemTime(new Date(2026, 9, 21, 0, 10));
        await gamification.runGamificationHousekeeping();
        vi.setSystemTime(new Date(2026, 9, 20, 0, 10));
      }
      expect(
        await db.getAllAsync(
          "SELECT source_key, date_key FROM gamification_events WHERE event_kind = 'workout'",
        ),
      ).toEqual([{ source_key: logId, date_key: saveDay }]);
      expect(await db.getAllAsync('SELECT quest_id, date_key FROM gamification_quests')).toEqual([
        { quest_id: 'move_body', date_key: saveDay },
      ]);
      expect(await gamification.readGamificationSnapshot()).toMatchObject({
        streak: { current: 1, activeToday: true },
        todayFacts: { workouts: 1 },
      });
      expect(
        (await gamification.readGamificationSnapshot({ todayKey: finishDay })).todayFacts.workouts,
      ).toBe(0);

      vi.setSystemTime(new Date(2026, 9, 21, 0, 10));
      await gamification.runGamificationHousekeeping();
      expect(await countWorkoutEvents()).toBe(1);
    },
  );

  it.each([
    { savedOn: 18, rewardDay: finishDay },
    { savedOn: 19, rewardDay: '2026-10-19' },
  ])(
    'credits $rewardDay when saved on October $savedOn at the window boundary',
    async ({ savedOn, rewardDay }) => {
      const { gamification } = await loadModules();
      const save = await prepareFinishedWorkout();
      const logId = await save(savedOn);

      const award = await gamification.awardGamificationAction({
        kind: 'workout',
        entityId: logId,
      });
      expect(award?.result.events[0]).toMatchObject({ kind: 'workout', dateKey: rewardDay });
    },
  );
});
