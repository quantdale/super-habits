import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * CORR-A-02/A-04 mandatory negative scenarios against REAL SQLite
 * (better-sqlite3 through the integration harness):
 *
 *   1. Quota exhaustion during a Todo write  → classified failure, NO row.
 *   2. Quota exhaustion during a workout-session save → no partial session.
 *   3. Interrupted backup creation (generation capture) → no partial capture.
 *   9. Retry after an interrupted write succeeds.
 *  10. Successful recovery produces exactly one record (no duplicates).
 *
 * Plus the Phase A3 atomicity proof: a failure between two writes that must
 * commit together leaves NEITHER, on the real engine (not a mock), and
 * concurrent transactional writers do not interleave.
 */

/** A real Chromium quota rejection shape. */
function quotaError(): Error {
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  return error;
}

type RunAsyncLike = TestDatabase['runAsync'];

/**
 * Wrap `db.runAsync` so statements matching `blocked` throw a quota error
 * while `armed` — simulating storage exhaustion at the exact write.
 */
function armQuota(
  db: TestDatabase,
  blocked: (sql: string, params?: readonly unknown[]) => boolean,
): { disarm: () => void } {
  const original: RunAsyncLike = db.runAsync.bind(db);
  let armed = true;
  (db as { runAsync: RunAsyncLike }).runAsync = async (
    sql: string,
    params?: readonly unknown[],
  ) => {
    if (armed && blocked(sql, params)) throw quotaError();
    return original(sql, params);
  };
  return {
    disarm: () => {
      armed = false;
    },
  };
}

function matchSql(pattern: RegExp): (sql: string) => boolean {
  return (sql: string) => pattern.test(sql);
}

describe('durable write failure integrity (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('1+9+10: a quota-failed Todo write leaves no row, and the retry creates exactly one', async () => {
    db = await freshDatabase();
    const { addTodo, listTodos } = await import('@/features/todos/todos.data');
    const { StorageWriteError } = await import('@/core/storage/storageSafety');

    const quota = armQuota(db, matchSql(/INSERT INTO todos/i));

    // The failure is DETECTED and CLASSIFIED — never a silent success.
    const failure = await addTodo({ title: 'Buy milk' }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(StorageWriteError);
    expect((failure as InstanceType<typeof StorageWriteError>).kind).toBe('quota');
    // ... and the message is the actionable storage copy, not a raw DOM string.
    expect((failure as Error).message).toMatch(/Storage is full/);

    // No partial row survived the failed attempt.
    expect(await listTodos()).toHaveLength(0);

    // Mandatory 9/10: retry after space is freed → exactly one record.
    quota.disarm();
    await addTodo({ title: 'Buy milk' });
    const todos = await listTodos();
    expect(todos).toHaveLength(1);
    expect(todos[0].title).toBe('Buy milk');
  });

  it('2: a quota-failed workout-session save commits no partial session', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const { StorageWriteError } = await import('@/core/storage/storageSafety');

    const routineId = await workout.addRoutine('Push day', 'strength').then(async () => {
      const row = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM workout_routines WHERE name = ? AND deleted_at IS NULL`,
        ['Push day'],
      );
      return row!.id;
    });

    const quota = armQuota(db, matchSql(/INSERT INTO workout_session_exercises/i));
    const input = {
      routineId,
      exercises: [
        {
          exerciseName: 'Bench press',
          setsCompleted: 1,
          sets: [{ setNumber: 1, reps: 5, weight: null, completed: true }],
        },
      ],
      startedAt: '2026-10-23T09:00:00.000Z',
      endedAt: '2026-10-23T09:45:00.000Z',
    };

    const failure = await workout.logWorkoutSession(input).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(StorageWriteError);

    // Atomic save: the log header AND its nested rows must all be absent.
    const logs = await db.getAllAsync(`SELECT id FROM workout_logs`);
    const exercises = await db.getAllAsync(`SELECT id FROM workout_session_exercises`);
    const sets = await db.getAllAsync(`SELECT id FROM workout_session_sets`);
    expect(logs).toHaveLength(0);
    expect(exercises).toHaveLength(0);
    expect(sets).toHaveLength(0);

    // Retry after recovery: exactly one complete session (no duplicates).
    quota.disarm();
    const result = await workout.logWorkoutSession(input);
    expect(await db.getAllAsync(`SELECT id FROM workout_logs`)).toHaveLength(1);
    expect(await db.getAllAsync(`SELECT id FROM workout_session_exercises`)).toHaveLength(1);
    // And the retry idempotence built into the save path still holds.
    const again = await workout.logWorkoutSession(input);
    expect(again.logId ?? (again as { logId?: string }).logId).toBeDefined();
    expect(await db.getAllAsync(`SELECT id FROM workout_logs`)).toHaveLength(1);
    expect(result).toBeDefined();
  });

  it('3: an interrupted generation capture leaves no partial capture state', async () => {
    db = await freshDatabase();
    const { captureCurrentGeneration, readGenerationCapture } =
      await import('@/core/backup/generations/capture');
    const { StorageWriteError } = await import('@/core/storage/storageSafety');

    // Seed one backed-up row so the capture has content to write, and prime
    // the durable owner evidence the capture refuses to run without.
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'Back me up' });
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_test_owner');

    // The capture transaction dies mid-write: the durable capture payload
    // (app_meta backup.generation_capture) cannot be written.
    const { appMetaKeys } = await import('@/core/db/appMeta');
    const captureKey = appMetaKeys.backupGenerationCapture.key;
    const quota = armQuota(
      db,
      (sql, params) => /INSERT OR REPLACE INTO app_meta/i.test(sql) && params?.[0] === captureKey,
    );
    const failure = await captureCurrentGeneration().then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(StorageWriteError);

    // Nothing half-written: no dangling capture metadata, and the user's rows
    // are untouched by the rolled-back capture attempt.
    expect(await readGenerationCapture(db as never)).toBeNull();
    expect(await db.getAllAsync(`SELECT id FROM todos WHERE deleted_at IS NULL`)).toHaveLength(1);

    // Recovery: the next capture succeeds and is complete.
    quota.disarm();
    const captured = await captureCurrentGeneration();
    expect(captured).toBeDefined();
    const restored = await readGenerationCapture(db as never);
    expect(restored).not.toBeNull();
  });

  it('A3: a failure between two atomic writes commits NEITHER (real engine rollback)', async () => {
    db = await freshDatabase();
    const { withSQLiteTransaction } = await import('@/core/db/transactions');

    await db.execAsync(`CREATE TABLE atomic_probe (id TEXT PRIMARY KEY, note TEXT)`);

    const boom = new Error('injected failure between writes');
    await expect(
      withSQLiteTransaction(db as never, async (tx) => {
        await tx.runAsync(`INSERT INTO atomic_probe (id, note) VALUES ('a', 'first')`);
        throw boom;
      }),
    ).rejects.toThrow('injected failure between writes');

    expect(await db.getAllAsync(`SELECT id FROM atomic_probe`)).toHaveLength(0);

    // The success path commits both writes together.
    await withSQLiteTransaction(db as never, async (tx) => {
      await tx.runAsync(`INSERT INTO atomic_probe (id, note) VALUES ('a', 'first')`);
      await tx.runAsync(`INSERT INTO atomic_probe (id, note) VALUES ('b', 'second')`);
    });
    expect(await db.getAllAsync(`SELECT id FROM atomic_probe`)).toHaveLength(2);
  });

  it('A3: concurrent transactional writers serialize instead of interleaving', async () => {
    db = await freshDatabase();
    const { withSQLiteTransaction } = await import('@/core/db/transactions');

    await db.execAsync(`CREATE TABLE serialize_probe (id INTEGER PRIMARY KEY, step TEXT)`);

    const observed: string[] = [];
    await Promise.all([
      withSQLiteTransaction(db as never, async (tx) => {
        observed.push('A:start');
        await tx.runAsync(`INSERT INTO serialize_probe (id, step) VALUES (1, 'a1')`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        await tx.runAsync(`INSERT INTO serialize_probe (id, step) VALUES (2, 'a2')`);
        observed.push('A:end');
      }),
      withSQLiteTransaction(db as never, async (tx) => {
        observed.push('B:start');
        await tx.runAsync(`INSERT INTO serialize_probe (id, step) VALUES (3, 'b1')`);
        await tx.runAsync(`INSERT INTO serialize_probe (id, step) VALUES (4, 'b2')`);
        observed.push('B:end');
      }),
    ]);

    // One writer at a time: no A/B interleaving inside the critical sections.
    expect(observed).toEqual(['A:start', 'A:end', 'B:start', 'B:end']);
    expect(await db.getAllAsync(`SELECT id FROM serialize_probe`)).toHaveLength(4);
  });
});
