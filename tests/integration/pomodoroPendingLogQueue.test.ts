import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * The durable pending-log queue survives a failed completion insert so the
 * focus is retried on the next foreground. Two writers touch it: the completion
 * path (`enqueuePendingPomodoroLog`) and the retry pass
 * (`retryPendingPomodoroLogs`).
 *
 * The retry pass reads the queue, does per-entry I/O, and WRITES the retained
 * queue back. An enqueue that lands inside that window used to be clobbered by
 * the retry's stale write: the just-failed completion vanished from the durable
 * queue and was never logged — no row, no focus minutes, no reward, and nothing
 * on screen told the user. Both writers must therefore run through ONE
 * serialized queue turn, and the enqueue must append to what is stored at its
 * own turn, not to what it read before the retry started.
 */
describe('pomodoro pending-log queue (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  /** Make every session insert fail so the retry takes its retain path. */
  async function blockSessionInserts(database: TestDatabase) {
    await database.runAsync(
      `CREATE TRIGGER block_pomodoro_insert BEFORE INSERT ON pomodoro_sessions
       BEGIN SELECT RAISE(ABORT, 'session insert blocked'); END;`,
    );
  }

  async function readQueue(database: TestDatabase) {
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'pomodoro.pending_logs'",
    );
    return row ? (JSON.parse(row.value) as { startedAtIso: string }[]) : [];
  }

  it('keeps a focus enqueued while a retry pass is running', async () => {
    db = await freshDatabase();
    await blockSessionInserts(db);
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    // An already-queued focus that keeps failing (the retry will retain it).
    await pomodoro.enqueuePendingPomodoroLog({
      startedAtIso: '2026-10-29T15:00:00.000Z',
      endedAtIso: '2026-10-29T15:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    // A second completed focus fails to insert while the retry runs: the
    // enqueue races the retry's read-modify-write of the same app_meta key.
    const retry = pomodoro.retryPendingPomodoroLogs();
    const enqueue = pomodoro.enqueuePendingPomodoroLog({
      startedAtIso: '2026-10-29T16:00:00.000Z',
      endedAtIso: '2026-10-29T16:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });
    await Promise.all([retry, enqueue]);

    // Both completions stay durable until they can be logged.
    expect((await readQueue(db)).map((entry) => entry.startedAtIso).sort()).toEqual([
      '2026-10-29T15:00:00.000Z',
      '2026-10-29T16:00:00.000Z',
    ]);
  });

  it('logs both queued focuses once the failure is cleared', async () => {
    db = await freshDatabase();
    await blockSessionInserts(db);
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    await pomodoro.enqueuePendingPomodoroLog({
      startedAtIso: '2026-10-29T15:00:00.000Z',
      endedAtIso: '2026-10-29T15:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });
    const retry = pomodoro.retryPendingPomodoroLogs();
    const enqueue = pomodoro.enqueuePendingPomodoroLog({
      startedAtIso: '2026-10-29T16:00:00.000Z',
      endedAtIso: '2026-10-29T16:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });
    await Promise.all([retry, enqueue]);

    await db.runAsync('DROP TRIGGER block_pomodoro_insert;');
    const result = await pomodoro.retryPendingPomodoroLogs();
    expect(result.succeeded).toBe(2);

    const rows = await db.getAllAsync<{ started_at: string }>(
      'SELECT started_at FROM pomodoro_sessions ORDER BY started_at ASC',
    );
    expect(rows.map((row) => row.started_at)).toEqual([
      '2026-10-29T15:00:00.000Z',
      '2026-10-29T16:00:00.000Z',
    ]);
    expect(await readQueue(db)).toEqual([]);
  });
});
