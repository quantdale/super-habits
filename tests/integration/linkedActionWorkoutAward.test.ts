import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Linked-action workout XP evidence.
 *
 * `logWorkoutFromLinkedAction` never calls `recordAction` /
 * `awardGamificationAction` — reconcile-only by design (the data layer must
 * not import gamification; all six `*FromLinkedAction` writers behave the
 * same). This suite pins the correctness half of that contract: the effect
 * writes a real `workout_logs` row whose id IS the produced entity id, and
 * reconcile awards exactly that log — no id-less fallback, no second award.
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

describe('linked-action workout award attribution', () => {
  it('a linked-action workout earns XP via reconcile with its exact produced log id', async () => {
    const { workout, gamification, time } = await loadModules();
    const today = time.toDateKey();

    await workout.addRoutine('Linked Push', '');
    const [routine] = await workout.listRoutines();
    const logId = `wrk_linked_${Date.now()}`;
    const result = await workout.logWorkoutFromLinkedAction({
      id: logId,
      routineId: routine.id,
    });
    expect(result.status).toBe('applied');
    expect(result.producedEntityId).toBe(logId);

    // The effect reports no award itself: id-less fast path is a miss.
    expect(await gamification.awardGamificationAction({ kind: 'workout' })).toBeNull();
    expect(await countWorkoutEvents()).toBe(0);

    // Reconcile backfills the exact produced log — nothing lost, nothing extra.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'workout'`,
    );
    expect(keys.map((row) => row.source_key)).toEqual([logId]);

    // Second pass is a no-op: the ledger's unique (kind, source key) index
    // is the single source of truth for "already paid".
    const again = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(again.awarded).toBe(0);
    expect(await countWorkoutEvents()).toBe(1);
  });

  it('a skipped linked-action workout (missing routine) earns nothing via reconcile', async () => {
    const { workout, gamification, time } = await loadModules();
    const today = time.toDateKey();

    const result = await workout.logWorkoutFromLinkedAction({
      id: 'wrk_linked_missing',
      routineId: 'wrk_missing_routine',
    });
    expect(result.status).toBe('skipped');

    // No row was written, so there is nothing to award even via reconcile.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(0);
    expect(await countWorkoutEvents()).toBe(0);
  });
});
