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

  it('publishes settings before the manifest and certifies their integrity', async () => {
    const { supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });

    await checkpoint.runBackupMaintenance();

    const settingsIndex = supabaseMock.upserted.findIndex(
      (call) => call.entity === 'user_backup_settings',
    );
    const manifestIndex = supabaseMock.upserted.findIndex(
      (call) => call.entity === 'backup_manifest',
    );
    expect(settingsIndex).toBeGreaterThanOrEqual(0);
    expect(manifestIndex).toBeGreaterThan(settingsIndex); // settings-G before manifest-G

    const manifest = supabaseMock.upserted[manifestIndex].rows[0];
    const settings = supabaseMock.upserted[settingsIndex].rows[0];
    const metadata = manifest.settings_metadata as { version: number; checksum: string };
    expect(metadata.version).toBe(5); // BACKUP_SETTINGS_VERSION (Gym V2 wave)
    expect(metadata.checksum).toMatch(/^[0-9a-f]{64}$/);
    // The uploaded settings payload must hash to the certified checksum.
    const { canonicalizeSettingsPayload } = await import('@/core/backup/backupSettings');
    expect(canonicalizeSettingsPayload(settings.payload)).toBe(metadata.checksum);
  });

  it('defers publication when a real mutation commits at the old final-check gap', async () => {
    const { db, supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });

    let injected = false;
    await checkpoint.runBackupMaintenance({
      hooks: {
        beforeCapture: async () => {
          if (injected) return;
          injected = true;
          // A REAL mutation commits between the cycle's final queue check and
          // the manifest publication transaction (the old race window).
          await addTodo({ title: 'raced' });
        },
      },
    });

    // Stale publication is impossible: the mutation's durable outbox record
    // is re-checked INSIDE the capture transaction and defers publication.
    const manifests = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifests).toHaveLength(0);
    expect(await outboxCount(db)).toBe(1);
    const dirty = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('1');

    // The next cycle publishes a complete manifest covering BOTH rows.
    await checkpoint.runBackupMaintenance();
    const after = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(after).toHaveLength(1);
    const todosMeta = (after[0].rows[0].entity_metadata as Record<string, { count: number }>).todos;
    expect(todosMeta.count).toBe(2);
    expect(await outboxCount(db)).toBe(0);
  });

  it('defers publication when a mutation lands inside the capture transaction after the snapshot', async () => {
    const { db, supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });

    let injected = false;
    await checkpoint.runBackupMaintenance({
      hooks: {
        afterSnapshot: async (transactionDb) => {
          if (injected) return;
          injected = true;
          // Simulate the durable effects of a mutation interleaving INSIDE the
          // coherence boundary after the snapshot was computed: row + outbox
          // record + dirty flag, all on the transaction connection.
          const { nowIso } = await import('@/lib/time');
          const { syncEngine: engine } = await import('@/core/sync/sync.engine');
          const { upsertSyncOutboxRecord } = await import('@/core/sync/syncPersistence');
          await transactionDb.runAsync(
            `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
             VALUES ('todo_raced', 'raced', NULL, 0, ?, ?, NULL)`,
            [nowIso(), nowIso()],
          );
          const prepared = engine.prepare({
            entity: 'todos',
            id: 'todo_raced',
            updatedAt: nowIso(),
            operation: 'create',
            ownerUserId: 'user_a',
          });
          await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
          await transactionDb.runAsync(
            "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('backup.dirty', '1')",
          );
          engine.enqueuePrepared(prepared, { durablyPersisted: true });
        },
      },
    });

    // The post-snapshot in-transaction recheck caught the interleaved record:
    // no manifest is published, the dirty flag is never cleared over the newer
    // mutation, and the mutation's durable effects committed intact.
    const manifests = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifests).toHaveLength(0);
    expect(await outboxCount(db)).toBe(1);
    const dirty = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('1');

    // The next cycle flushes the raced row and publishes a manifest covering it.
    await checkpoint.runBackupMaintenance();
    const after = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(after).toHaveLength(1);
    const todosMeta = (after[0].rows[0].entity_metadata as Record<string, { count: number }>).todos;
    expect(todosMeta.count).toBe(2);
    expect(await outboxCount(db)).toBe(0);
  });

  it('drops a stale manifest intent when settings change after capture and recovers without looping', async () => {
    let injected = false;
    let armed = false;
    const { db, supabaseMock, checkpoint } = await load({
      onUpsert: async (entity) => {
        // A real settings save lands DURING a manifest flush, between the
        // capture transaction and the manifest push.
        if (entity === 'user_backup_settings' && armed && !injected) {
          injected = true;
          const calories = await import('@/features/calories/calories.data');
          await calories.setCalorieGoal({ calories: 2100, protein: 160, carbs: 210, fats: 75 });
        }
      },
    });
    const { addTodo } = await import('@/features/todos/todos.data');
    const { canonicalizeSettingsPayload } = await import('@/core/backup/backupSettings');
    await addTodo({ title: 'one' });
    await checkpoint.runBackupMaintenance();
    expect(supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest')).toHaveLength(
      1,
    );
    armed = true;

    // New data → cycle 2 captures generation 2 certifying the OLD settings,
    // then the settings save during the flush makes that intent stale.
    await addTodo({ title: 'two' });
    await checkpoint.runBackupMaintenance();
    const afterStale = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(afterStale).toHaveLength(1); // generation 2 was never published
    expect(await outboxCount(db)).toBeGreaterThan(0);
    const dirtyAfterStale = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirtyAfterStale?.value).toBe('1');

    // Cycle 3 recaptures: a fresh generation certifies the NEW settings and
    // publishes; no infinite manifest loop. The dropped generation 2 was
    // never published, so the recapture safely reuses it.
    await checkpoint.runBackupMaintenance();
    const afterRecovery = supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(afterRecovery).toHaveLength(2);
    const lastManifest = afterRecovery[1].rows[0];
    expect(lastManifest.generation).toBe(2);
    const settingsCalls = supabaseMock.upserted.filter(
      (call) => call.entity === 'user_backup_settings',
    );
    const lastSettings = settingsCalls[settingsCalls.length - 1].rows[0];
    expect(
      (lastSettings.payload as { calorieGoal: { calories: number } }).calorieGoal.calories,
    ).toBe(2100);
    expect(canonicalizeSettingsPayload(lastSettings.payload)).toBe(
      (lastManifest.settings_metadata as { checksum: string }).checksum,
    );
    expect(await outboxCount(db)).toBe(0);

    // Idle cycles stay quiet: the loop ended.
    await checkpoint.runBackupMaintenance();
    await checkpoint.runBackupMaintenance();
    expect(supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest')).toHaveLength(
      2,
    );
  });

  it('reconciles the last complete generation after a crash between remote push and the local marker', async () => {
    const { db, supabaseMock, checkpoint } = await load();
    const { addTodo } = await import('@/features/todos/todos.data');
    await addTodo({ title: 'one' });
    await checkpoint.runBackupMaintenance();
    const generationAfterPush = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.last_complete_generation'",
    );
    expect(generationAfterPush?.value).toBe('1');

    // Simulate the crash window: the manifest was pushed but the local marker
    // write never landed.
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('backup.last_complete_generation', '0')",
    );
    await checkpoint.runBackupMaintenance();

    const generation = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.last_complete_generation'",
    );
    expect(generation?.value).toBe('1');
    // The already-pushed manifest is not re-published and nothing is queued.
    expect(supabaseMock.upserted.filter((call) => call.entity === 'backup_manifest')).toHaveLength(
      1,
    );
    expect(await outboxCount(db)).toBe(0);
  });
});
