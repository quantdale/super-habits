import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { seedMature } from './fixtures';
import { freshDatabase } from './helpers/db';

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

// CG-9: seeding ~9k rows plus a file round-trip is not a timing contract.
describe('corpus restart over the same file', { timeout: 120_000 }, () => {
  it('survives close/reopen with manifest, edge state, outbox, and writability intact', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-corpus-restart-'));
    const file = path.join(dir, 'restart.db');
    try {
      const db = await seedMature();
      db.raw.exec(`VACUUM INTO '${file.replace(/\\/g, '/').replace(/'/g, "''")}'`);
      await db.closeAsync();

      // Reopen the same file: migrations must be idempotent no-ops here.
      const reopened: CorpusDb = await freshDatabase(file);
      expect(await metaValue(reopened, 'db_schema_version')).toBe('24');

      // Full manifest re-verified after restart.
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM todos')).toBe(612);
      expect(
        await count(reopened, 'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL'),
      ).toBe(609);
      expect(
        await count(reopened, 'SELECT COUNT(*) AS n FROM habits WHERE deleted_at IS NULL'),
      ).toBe(20);
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM habit_completions')).toBe(3361);
      expect(
        await count(reopened, 'SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL'),
      ).toBe(630);
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM saved_meals')).toBe(16);
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM workout_logs')).toBe(70);
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM pomodoro_sessions')).toBe(105);
      expect(
        await count(reopened, 'SELECT COUNT(*) AS n FROM projects WHERE deleted_at IS NULL'),
      ).toBe(4);
      expect(
        await count(reopened, 'SELECT COUNT(*) AS n FROM goals WHERE deleted_at IS NULL'),
      ).toBe(12);
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM sync_outbox')).toBe(4933);

      // Durable edge state survives the restart.
      expect(await metaValue(reopened, 'backup.scope_version')).toBe('6');
      expect(await metaValue(reopened, 'pomodoro.active_timer')).not.toBeNull();
      expect(await metaValue(reopened, 'workout.active_session_draft')).not.toBeNull();
      const pendingLogs = await metaValue(reopened, 'pomodoro.pending_logs');
      expect(JSON.parse(pendingLogs ?? '[]')).toHaveLength(1);

      // The reopened corpus stays writable through the real data layers.
      const { listPendingTodos, toggleTodo, addTodo } = await import('@/features/todos/todos.data');
      const pending = await listPendingTodos();
      expect(pending.length).toBeGreaterThan(0);
      await toggleTodo(pending[0]);
      const flipped = await reopened.getFirstAsync<{ completed: number }>(
        'SELECT completed FROM todos WHERE id = ?',
        [pending[0].id],
      );
      expect(flipped?.completed).toBe(1);
      await addTodo({ title: 'Restart probe todo', priority: 'normal' });
      expect(await count(reopened, 'SELECT COUNT(*) AS n FROM todos')).toBe(613);

      const { incrementHabit } = await import('@/features/habits/habits.data');
      // An active habit's pair: paused/archived habits correctly reject
      // writes at the lifecycle gate, which would prove nothing here.
      const pair = await reopened.getFirstAsync<{
        habit_id: string;
        date_key: string;
        count: number;
      }>(
        `SELECT c.habit_id, c.date_key, c.count FROM habit_completions AS c
         INNER JOIN habits AS h ON h.id = c.habit_id
         WHERE c.date_key = ? AND h.status = 'active' LIMIT 1`,
        ['2026-07-01'],
      );
      expect(pair).not.toBeNull();
      await incrementHabit(pair!.habit_id, pair!.date_key);
      const grown = await reopened.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE habit_id = ? AND date_key = ?',
        [pair!.habit_id, pair!.date_key],
      );
      expect(grown?.count).toBe((pair?.count ?? 0) + 1);

      await reopened.closeAsync();
    } finally {
      // Best-effort temp cleanup: Windows scanners can hold a freshly
      // written .db briefly after close (EBUSY). The tmpdir is OS-managed;
      // a failed sweep must never fail the certification itself.
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Leave OS temp reclamation to handle it.
      }
    }
  });
});
