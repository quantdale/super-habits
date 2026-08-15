import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Backup Completeness V2 — checkpoint publication against real SQLite with a
 * recording Supabase stub.
 *
 * Covers: the coherent full cycle (backfill → flush → snapshot → manifest
 * upsert), the mutation-during-flush deferral (no manifest published while
 * newer rows are unflushed), previous-good survival when a newer publication
 * fails, and the no-infinite-loop property (an idle cycle publishes nothing).
 */

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };

function buildSupabaseMock(
  options: {
    onUpsert?: (entity: string, rows: Record<string, unknown>[]) => Promise<void> | void;
  } = {},
) {
  const upserted: UpsertCall[] = [];
  let failUpserts = false;
  const from = vi.fn((entity: string) => ({
    upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
      if (failUpserts) return { error: { message: 'simulated remote failure' } };
      const rowList = Array.isArray(rows) ? rows : [rows];
      upserted.push({ entity, rows: rowList });
      await options.onUpsert?.(entity, rowList);
      return { error: null };
    }),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  }));
  return {
    supabase: { from },
    upserted,
    setFailUpserts: (value: boolean) => {
      failUpserts = value;
    },
  };
}

async function load(
  options: {
    onUpsert?: (entity: string, rows: Record<string, unknown>[]) => Promise<void> | void;
  } = {},
) {
  const supabaseMock = buildSupabaseMock(options);
  vi.doMock('@/lib/supabase', () => ({
    supabase: supabaseMock.supabase,
    isRemoteEnabled: vi.fn(() => true),
    getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
    getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
    setRemoteMode: vi.fn(),
    ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
  }));
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  const checkpoint = await import('@/core/backup/backupCheckpoint');
  return { db, supabaseMock, checkpoint };
}

async function outboxCount(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  return Number(row?.count ?? 0);
}

describe('backup completeness v2 checkpoint', () => {
  it('publishes a complete manifest after backfill and drain', async () => {
    const { db, supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });
    await addTodo({ title: 'two' });

    await checkpoint.runBackupMaintenance();

    const manifests = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifests).toHaveLength(1);
    const manifest = manifests[0].rows[0];
    expect(manifest.backup_schema_version).toBe(2);
    expect(manifest.generation).toBe(1);
    expect(manifest.user_id).toBe('user_a');
    const todosMeta = (
      manifest.entity_metadata as Record<string, { count: number; checksum: string }>
    ).todos;
    expect(todosMeta.count).toBe(2);
    expect(todosMeta.checksum).toMatch(/^[0-9a-f]{64}$/);
    // Every scope entity present, including empty ones.
    const entityMetadata = manifest.entity_metadata as Record<string, { count: number }>;
    for (const entity of [
      'todos',
      'habits',
      'habit_completions',
      'calorie_entries',
      'saved_meals',
      'workout_routines',
      'routine_exercises',
      'routine_exercise_sets',
      'workout_logs',
      'workout_session_exercises',
      'pomodoro_sessions',
      'linked_action_rules',
    ]) {
      expect(entityMetadata[entity], entity).toBeDefined();
    }

    // Todos themselves were pushed.
    const todosUpserts = supabaseMock.upserted.filter((call) => call.entity === 'todos');
    expect(todosUpserts.flatMap((call) => call.rows)).toHaveLength(2);
    // The queue drained and the dirty flag cleared.
    expect(await outboxCount(db)).toBe(0);
    const dirty = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('0');
    const generation = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.last_complete_generation'",
    );
    expect(generation?.value).toBe('1');
  });

  it('defers publication when a mutation lands during the flush', async () => {
    let injected = false;
    const { db, supabaseMock, checkpoint } = await load({
      onUpsert: async (entity) => {
        // Simulate a user mutation completing DURING the data push: a new
        // local row + durable outbox record appear before the flush resolves.
        if (entity === 'todos' && !injected) {
          injected = true;
          const { syncEngine } = await import('@/core/sync/sync.engine');
          const { nowIso } = await import('@/lib/time');
          await db.runAsync(
            `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
             VALUES ('todo_unflushed', 'pending', NULL, 0, ?, ?, NULL)`,
            [nowIso(), nowIso()],
          );
          syncEngine.enqueue({
            entity: 'todos',
            id: 'todo_unflushed',
            updatedAt: nowIso(),
            operation: 'create',
            ownerUserId: 'user_a',
          });
        }
      },
    });
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });

    await checkpoint.runBackupMaintenance();

    // The unflushed row blocks publication: no manifest claims completeness.
    const manifests = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifests).toHaveLength(0);
    expect(await outboxCount(db)).toBe(1);

    // The next cycle flushes the pending row and publishes a complete
    // manifest covering both rows.
    await checkpoint.runBackupMaintenance();
    const after = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(after).toHaveLength(1);
    const todosMeta = (after[0].rows[0].entity_metadata as Record<string, { count: number }>).todos;
    expect(todosMeta.count).toBe(2);
  });

  it('keeps the previous complete manifest when a newer publication fails', async () => {
    const { supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });
    await checkpoint.runBackupMaintenance();
    expect(supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest')).toHaveLength(
      1,
    );

    // New data + failing remote: the manifest record stays queued and the old
    // remote manifest row is never overwritten.
    supabaseMock.setFailUpserts(true);
    await addTodo({ title: 'two' });
    await checkpoint.runBackupMaintenance();
    const manifests = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifests).toHaveLength(1); // still the original generation

    // Remote recovers: the pending manifest pushes on the next cycle.
    supabaseMock.setFailUpserts(false);
    await checkpoint.runBackupMaintenance();
    const after = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(after).toHaveLength(2);
    expect(after[1].rows[0].generation).toBe(2);
  });

  it('does not loop: an idle cycle publishes nothing', async () => {
    const { db, supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });
    await checkpoint.runBackupMaintenance();
    const afterFirst = supabaseMock.upserted.filter(
      (call) => call.entity === 'backup_manifest',
    ).length;
    expect(afterFirst).toBe(1);

    await checkpoint.runBackupMaintenance();
    await checkpoint.runBackupMaintenance();
    const afterIdle = supabaseMock.upserted.filter(
      (call) => call.entity === 'backup_manifest',
    ).length;
    expect(afterIdle).toBe(1);
    expect(await outboxCount(db)).toBe(0);
  });
});
