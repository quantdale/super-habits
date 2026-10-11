import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

// addDefaultSet loads the rest preference, whose store touches AsyncStorage
// during its one-time legacy import; keep that hermetic in integration runs.
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

/**
 * W9.5 workout save-integrity oracles (real SQLite).
 *
 * The live session may only report a workout as saved when a durable
 * `workout_logs` row was actually committed. These tests pin, against the
 * real engine: exactly one log + its set rows on an applied finish; zero
 * rows and an accurate `target_missing` reason on a skipped finish; draft
 * retention across a failed save; XP attribution to the exact committed
 * log; and exactly-once submission semantics for a rapid double finish.
 */

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

async function loadWorkout() {
  return import('@/features/workout/workout.data');
}

async function countRows(sql: string, params?: readonly unknown[]): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(sql, params);
  return Number(row?.n ?? 0);
}

async function createRoutineWithSets(): Promise<string> {
  const workout = await loadWorkout();
  await workout.addRoutine('Convergence Day', '');
  const [routine] = await workout.listRoutines();
  const exerciseId = await workout.addExercise({ routineId: routine.id, name: 'Press' });
  await workout.addSet({
    exerciseId,
    setNumber: 1,
    activeSeconds: 40,
    restSeconds: 20,
  });
  return routine.id;
}

const sampleSession = {
  exercises: [
    {
      exerciseName: 'Press',
      setsCompleted: 1,
      sets: [{ setNumber: 1, weight: 80, reps: 8, completed: true }],
    },
  ],
};

describe('workout finish save integrity (W9.5)', () => {
  it('A: an applied finish commits exactly one log with its set rows', async () => {
    const workout = await loadWorkout();
    const routineId = await createRoutineWithSets();

    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });

    expect(result.status).toBe('applied');
    expect(result.logId).toMatch(/^wrk_/);
    // Exactly one durable log row, and it is the reported id.
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_logs')).toBe(1);
    const log = await db.getFirstAsync<{ id: string; routine_name: string }>(
      'SELECT id, routine_name FROM workout_logs WHERE id = ?',
      [result.logId!],
    );
    expect(log).toMatchObject({ id: result.logId, routine_name: 'Convergence Day' });
    // The entered set persisted under that log's exercise row.
    const sets = await db.getAllAsync<{ set_number: number; weight: number; reps: number }>(
      `SELECT s.set_number, s.weight, s.reps FROM workout_session_sets s
         JOIN workout_session_exercises e ON e.id = s.session_exercise_id
        WHERE e.log_id = ?`,
      [result.logId!],
    );
    expect(sets).toEqual([{ set_number: 1, weight: 80, reps: 8 }]);
    // The durable outbox carries the create intents for backup.
    expect(
      await countRows('SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = ?', ['workout_logs']),
    ).toBe(1);
  });

  it('B: a skipped finish writes zero rows and names the cause', async () => {
    const workout = await loadWorkout();
    const routineId = await createRoutineWithSets();

    // The routine becomes unavailable mid-session (soft delete) before Finish.
    await db.runAsync('UPDATE workout_routines SET deleted_at = ? WHERE id = ?', [
      '2026-10-11T00:00:00.000Z',
      routineId,
    ]);
    const before = await countRows('SELECT COUNT(*) AS n FROM workout_logs');

    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });

    expect(result.status).toBe('skipped');
    expect(result.logId).toBeNull();
    expect(result.reason).toBe('target_missing');
    // No durable workout row, no exercise rows, no set rows, no outbox intent.
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_logs')).toBe(before);
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_session_exercises')).toBe(0);
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_session_sets')).toBe(0);
    expect(
      await countRows("SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'workout_logs'"),
    ).toBe(0);
  });

  it('B2: a skipped finish does not erase a durable draft', async () => {
    const workout = await loadWorkout();
    const routineId = await createRoutineWithSets();

    // A durable draft exists with entered sets, then the routine goes away.
    await workout.saveWorkoutSessionDraft({
      routineId,
      startedAtIso: '2026-10-11T09:00:00.000Z',
      phaseIndex: 0,
      enteredSets: { '0': { weight: '80', reps: '8' } },
    });
    await db.runAsync('UPDATE workout_routines SET deleted_at = ? WHERE id = ?', [
      '2026-10-11T00:00:00.000Z',
      routineId,
    ]);

    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });
    expect(result.status).toBe('skipped');

    // The failure path schedules no draft-clearing operation: the persisted
    // draft survives untouched.
    const draft = await workout.getWorkoutSessionDraft();
    expect(draft).toMatchObject({
      routineId,
      phaseIndex: 0,
      enteredSets: { '0': { weight: '80', reps: '8' } },
    });
  });

  it('A2: a successful finish permits draft cleanup and keeps the log', async () => {
    const workout = await loadWorkout();
    const routineId = await createRoutineWithSets();

    await workout.saveWorkoutSessionDraft({
      routineId,
      startedAtIso: '2026-10-11T09:00:00.000Z',
      phaseIndex: 0,
    });
    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });
    expect(result.status).toBe('applied');

    // Post-commit cleanup is exactly what the success branch requests.
    await workout.clearWorkoutSessionDraft();
    expect(await workout.getWorkoutSessionDraft()).toBeNull();
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_logs')).toBe(1);
  });

  it('E: rapid double submission commits exactly one session', async () => {
    const workout = await loadWorkout();
    const routineId = await createRoutineWithSets();
    const { createSubmitGuard } = await import('@/lib/submitGuard');

    // The synchronous guard drops the second press before any write begins;
    // the two calls here model two rapid Finish presses through it.
    const guard = createSubmitGuard();
    let committed = 0;
    const results: string[] = [];
    const finish = async () => {
      if (!guard.tryStart()) return;
      try {
        const result = await workout.logWorkoutSession({ routineId, ...sampleSession });
        if (result.status === 'applied') committed += 1;
        results.push(result.status);
      } finally {
        guard.finish();
      }
    };
    await Promise.all([finish(), finish()]);

    expect(results).toEqual(['applied']);
    expect(committed).toBe(1);
    expect(await countRows('SELECT COUNT(*) AS n FROM workout_logs')).toBe(1);
  });

  it('F: the committed log id is what a reward is attributed to', async () => {
    const workout = await loadWorkout();
    const gamification = await import('@/features/gamification/gamification.data');
    const routineId = await createRoutineWithSets();

    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });
    const outcome = await gamification.awardGamificationAction({
      kind: 'workout',
      entityId: result.logId!,
    });
    expect(outcome?.result.events[0]).toMatchObject({
      kind: 'workout',
      sourceKey: result.logId,
    });
    // Exactly one reward event, attributed to the committed row.
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'workout'`,
    );
    expect(keys).toEqual([{ source_key: result.logId }]);
  });

  it('F2: a skipped finish earns no reward event', async () => {
    const workout = await loadWorkout();
    const gamification = await import('@/features/gamification/gamification.data');
    const routineId = await createRoutineWithSets();
    await db.runAsync('UPDATE workout_routines SET deleted_at = ? WHERE id = ?', [
      '2026-10-11T00:00:00.000Z',
      routineId,
    ]);

    const result = await workout.logWorkoutSession({ routineId, ...sampleSession });
    expect(result.status).toBe('skipped');

    expect(await gamification.awardGamificationAction({ kind: 'workout' })).toBeNull();
    expect(
      await countRows("SELECT COUNT(*) AS n FROM gamification_events WHERE event_kind = 'workout'"),
    ).toBe(0);
  });
});
