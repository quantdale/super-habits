import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

describe('real SQLite account ownership evidence', () => {
  it('inspects every user-owned table, including tombstones and local-only history', async () => {
    const db = await freshDatabase();
    const { inspectLocalAccountDataState, bindLocalDatasetOwner } =
      await import('@/core/auth/account.data');

    await db.runAsync(
      `INSERT INTO todos (id, title, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, NULL)`,
      ['todo_active', 'Active', '2026-08-14T10:00:00.000Z', '2026-08-14T10:00:00.000Z'],
    );
    await db.runAsync(
      `INSERT INTO todos (id, title, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        'todo_deleted',
        'Deleted',
        '2026-08-14T09:00:00.000Z',
        '2026-08-14T09:00:00.000Z',
        '2026-08-14T11:00:00.000Z',
      ],
    );
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'hcmp_1',
        'habit_1',
        '2026-08-14',
        1,
        '2026-08-14T10:00:00.000Z',
        '2026-08-14T10:00:00.000Z',
      ],
    );
    await db.runAsync(
      `INSERT INTO pomodoro_sessions
       (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'pom_1',
        '2026-08-14T10:00:00.000Z',
        '2026-08-14T10:25:00.000Z',
        1500,
        'focus',
        '2026-08-14T10:25:00.000Z',
      ],
    );
    await db.runAsync(
      `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['todos', 'todo_active', '2026-08-14T10:00:00.000Z', 'create', 1, 'user_a'],
    );
    await bindLocalDatasetOwner(db as never, 'user_a');

    const inspected = await inspectLocalAccountDataState(db as never);
    expect(inspected.hasUserData).toBe(true);
    expect(inspected.counts.todos).toEqual({ total: 2, active: 1, deleted: 1 });
    expect(inspected.counts.habit_completions).toEqual({ total: 1, active: 1, deleted: 0 });
    expect(inspected.counts.pomodoro_sessions).toEqual({ total: 1, active: 1, deleted: 0 });
    expect(inspected.pendingOutboxCount).toBe(1);
    expect(inspected.outboxOwnerIds).toEqual(['user_a']);
    expect(inspected.ownerBinding).toBe('user_a');
  });

  it('persists the owner binding and outbox owner across a real restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-account-owner-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      const first = await freshDatabase(file);
      const { bindLocalDatasetOwner } = await import('@/core/auth/account.data');
      await bindLocalDatasetOwner(first as never, 'user_a');
      await first.runAsync(
        `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision, owner_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['todos', 'todo_restart', '2026-08-14T10:00:00.000Z', 'update', 1, 'user_a'],
      );
      await first.closeAsync();

      const restarted = await freshDatabase(file);
      const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
      const inspected = await inspectLocalAccountDataState(restarted as never);
      expect(inspected.ownerBinding).toBe('user_a');
      expect(inspected.outboxOwnerIds).toEqual(['user_a']);
      expect(inspected.pendingOutboxCount).toBe(1);
      await restarted.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
