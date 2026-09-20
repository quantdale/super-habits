import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { DraftLogWorkoutRoutine } from '@/features/command/types';

/**
 * Command-center workout attribution.
 *
 * `executeLogWorkout` must hand out the `workout_logs` row id it just wrote as
 * the success `entityId` — never the routine id. The gamification ledger keys
 * workout awards verbatim by that id (`actionSourceKey`), so a routine id
 * would mint a foreign source key that reconcile can never match, paying the
 * same workout twice.
 */

function buildWorkoutDraft(): DraftLogWorkoutRoutine {
  return {
    kind: 'log_workout_routine',
    rawText: 'log Push Day workout',
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { routineName: 'Push Day', completedOn: null },
  };
}

async function countWorkoutEvents(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = 'workout'`,
  );
  return row?.value ?? 0;
}

describe('command-center workout logId attribution', () => {
  it('returns the exact workout_logs row id and awards that exact log once', async () => {
    const db: TestDatabase = await freshDatabase();
    try {
      const commandExecutor = await import('@/features/command/command.executor');
      const workout = await import('@/features/workout/workout.data');
      const gamification = await import('@/features/gamification/gamification.data');
      const time = await import('@/lib/time');
      const today = time.toDateKey();

      await workout.addRoutine('Push Day', '');
      const [routine] = await workout.listRoutines();

      const result = await commandExecutor.executeDraftAction(buildWorkoutDraft(), {
        resolvedEntityId: routine.id,
      });
      expect(result).toMatchObject({ outcome: 'success', kind: 'log_workout_routine' });
      if (result.outcome !== 'success') throw new Error('expected a successful workout command');

      const logRow = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM workout_logs WHERE routine_id = ?`,
        [routine.id],
      );
      expect(logRow?.id).toMatch(/^wrk_/);
      expect(result.entityId).toBe(logRow?.id);
      expect(result.entityId).not.toBe(routine.id);

      const outcome = await gamification.awardGamificationAction({
        kind: 'workout',
        entityId: result.entityId!,
        todayKey: today,
      });
      expect(outcome?.result.events[0]).toMatchObject({
        kind: 'workout',
        sourceKey: logRow?.id,
      });

      // Reconcile finds the exact log already paid — no second award.
      const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
      expect(reconciled.awarded).toBe(0);
      expect(await countWorkoutEvents(db)).toBe(1);
    } finally {
      await db.closeAsync();
    }
  });

  it('a routine id used as the workout entityId pays a foreign key the reconcile cannot match', async () => {
    const db: TestDatabase = await freshDatabase();
    try {
      const workout = await import('@/features/workout/workout.data');
      const gamification = await import('@/features/gamification/gamification.data');
      const time = await import('@/lib/time');
      const today = time.toDateKey();

      await workout.addRoutine('Push Day', '');
      const [routine] = await workout.listRoutines();
      const completed = await workout.completeRoutine(routine.id);
      expect(completed.status).toBe('applied');

      // The pre-fix shape: awarding with the routine id mints
      // `workout:<routineId>`, which names no real log.
      const bogus = await gamification.awardGamificationAction({
        kind: 'workout',
        entityId: routine.id,
        todayKey: today,
      });
      expect(bogus?.result.events[0]).toMatchObject({ sourceKey: routine.id });

      // Reconcile then pays the real log as well — two events for one workout.
      const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
      expect(reconciled.awarded).toBe(1);
      expect(await countWorkoutEvents(db)).toBe(2);
    } finally {
      await db.closeAsync();
    }
  });
});
