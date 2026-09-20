import { beforeEach, describe, expect, it } from 'vitest';
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
