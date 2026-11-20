import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * A `pomodoro.log` linked-action session is user-owned history that rides the
 * same recoverable contract as a screen-completed focus: the row is captured by
 * backup/portable export and validated again on restore, where
 * `duration_seconds` must be a WHOLE number of seconds.
 *
 * The effect decoder only requires a finite number, so a payload authored by
 * any client (or by a future migration) can carry a fractional second count.
 * Writing it verbatim produced a row restore rejects — and because restore
 * validates the whole payload, one such row throws away the device's entire
 * history instead of just itself.
 */
describe('pomodoro.log linked-action durations stay inside the recovery contract', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function logLinkedActionSession(durationSeconds: number) {
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    await pomodoro.logPomodoroSessionFromLinkedAction({
      id: 'pom_1761000000000_abcd1234',
      durationSeconds,
      type: 'focus',
    });
    const { BACKUP_ENTITY_COLUMNS } = await import('@/core/backup/backup.types');
    // A `createId('pom')`-shaped id, so the only thing under test is the
    // DURATION column (the id contract is covered elsewhere).
    return db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${BACKUP_ENTITY_COLUMNS.pomodoro_sessions.join(', ')}
       FROM pomodoro_sessions WHERE id = 'pom_1761000000000_abcd1234'`,
    );
  }

  it('stores a fractional authored length as whole seconds the validator accepts', async () => {
    db = await freshDatabase();
    // 1500.4 rounds down: no second of the authored length is lost.
    const row = await logLinkedActionSession(1500.4);
    const { validateBackupRow } = await import('@/core/backup/backupValidators');

    expect(row?.duration_seconds).toBe(1500);
    expect(validateBackupRow('pomodoro_sessions', row).ok).toBe(true);
    // The active-time contract still holds for the stored row.
    expect(
      new Date(row!.ended_at as string).getTime() - new Date(row!.started_at as string).getTime(),
    ).toBe(1500 * 1000);
  });

  it('keeps a whole-minute authored length unchanged', async () => {
    db = await freshDatabase();
    const row = await logLinkedActionSession(50 * 60);
    expect(row?.duration_seconds).toBe(3000);
  });
});
