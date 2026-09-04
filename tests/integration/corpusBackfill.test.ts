import { describe, expect, it } from 'vitest';
import { seedMature } from './fixtures';

type CorpusDb = Awaited<ReturnType<typeof seedMature>>;

async function count(db: CorpusDb, sql: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(sql);
  return row?.n ?? 0;
}

async function metaValue(db: CorpusDb, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

// CG-9: backfilling a ~9k-row corpus issues thousands of durable outbox
// writes; correctness is not a timing contract.
describe('corpus backfill from the edge marker', { timeout: 120_000 }, () => {
  it('runs the scope-6 MATURE corpus forward to scope 7 exactly once', async () => {
    const db = await seedMature();
    expect(await metaValue(db, 'backup.scope_version')).toBe('6');

    // Establish durable owner evidence the way the coordinator does on
    // protect/recovery: bind AND adopt the seeding run's unowned outbox
    // rows, otherwise backfill's owner-scoped re-enqueue correctly
    // refuses to rebind them (fail-closed ownership invariant).
    const { bindLocalDatasetOwner } = await import('@/core/auth/account.data');
    await bindLocalDatasetOwner(db as never, 'user_a', { adoptUnownedOutbox: true });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(await metaValue(db, 'backup.scope_version')).toBe('7');

    // The mature volume is covered: spot-check entity presence in the outbox.
    for (const entity of [
      'todos',
      'habits',
      'habit_completions',
      'calorie_entries',
      'workout_logs',
      'pomodoro_sessions',
      'projects',
      'goals',
    ]) {
      expect(
        await count(db, `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = '${entity}'`),
      ).toBeGreaterThan(0);
    }

    // Idempotent: a second run reports done without further writes.
    const before = await count(db, 'SELECT COUNT(*) AS n FROM sync_outbox');
    expect(await ensureBackupBackfill()).toBe('done');
    expect(await count(db, 'SELECT COUNT(*) AS n FROM sync_outbox')).toBe(before);
    await db.closeAsync();
  });
});
