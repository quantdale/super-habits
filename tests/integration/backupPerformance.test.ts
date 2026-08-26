import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Backup V2 closure — checkpoint/restore performance recording.
 *
 * Records (via console.log) the wall time of the two phases that moved inside
 * the atomic coherence boundary: checkpoint capture (flush excluded) and the
 * restore validation/import path, at personal-data scale and at long-history
 * scale. The assertions are generous sanity ceilings, not benchmarks — the
 * recorded numbers are the deliverable (mission §50).
 */

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };

function buildRecordingSupabase() {
  const upserted: UpsertCall[] = [];
  const from = vi.fn((entity: string) => ({
    upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
      const rowList = Array.isArray(rows) ? rows : [rows];
      upserted.push({ entity, rows: rowList });
      return { error: null };
    }),
    delete: vi.fn(() => ({
      in: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  }));
  return { supabase: { from }, upserted };
}

function installSupabaseMock(supabase: { from: ReturnType<typeof vi.fn> }) {
  vi.doMock('@/lib/supabase', () => ({
    supabase,
    isRemoteEnabled: vi.fn(() => true),
    getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
    getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
    setRemoteMode: vi.fn(),
    ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
  }));
}

async function seedLongHistory(db: TestDatabase, completionRows: number): Promise<string> {
  const habitId = 'habit_1786000000000_abcdef12';
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES (?, 'Perf habit', 1, 'anytime', 'check-circle', '#0ea5e9', '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
    [habitId],
  );
  // Personal-data scale: thousands of history rows (the realistic upper end).
  // Each day maps to a real calendar date (2020-01-01 + day offset), so every
  // (habit_id, date_key) pair is unique and valid.
  const dateKeyForDay = (day: number): string => {
    const d = new Date(Date.UTC(2020, 0, 1) + (day - 1) * 86_400_000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
  };
  const chunk = 500;
  for (let offset = 0; offset < completionRows; offset += chunk) {
    const values: string[] = [];
    const params: unknown[] = [];
    for (let i = 0; i < chunk && offset + i < completionRows; i++) {
      const day = 1 + offset + i;
      const dateKey = dateKeyForDay(day);
      const iso = `${dateKey}T08:00:00.000Z`;
      values.push(`('hcmp_1786000000${String(day).padStart(4, '0')}_abcdef12', ?, ?, 1, ?, ?)`);
      params.push(habitId, dateKey, iso, iso);
    }
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ${values.join(', ')}`,
      params,
    );
  }
  return habitId;
}

function servingFrom(upserted: UpsertCall[]) {
  const remote = new Map<string, Record<string, unknown>[]>();
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
    'user_backup_settings',
    'backup_manifest',
  ]) {
    remote.set(
      entity,
      upserted.filter((call) => call.entity === entity).flatMap((call) => call.rows),
    );
  }
  const from = vi.fn((entity: string) => {
    const rows = (remote.get(entity) ?? []).map((row) => ({ ...row }));
    const query = {
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(() => Promise.resolve({ data: rows.slice(0, 1), error: null })),
      range: vi.fn((from: number, to: number) =>
        Promise.resolve({ data: rows.slice(from, to + 1), error: null }),
      ),
    };
    return { select: vi.fn(() => query) };
  });
  return { supabase: { from } };
}

async function measure<T>(label: string, work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await work();
  const elapsed = Date.now() - started;
  console.warn(`[perf] ${label}: ${elapsed}ms`);
  return result;
}

describe('backup v2 closure performance recording', () => {
  it('records checkpoint capture at small and long-history scale, and restore end-to-end', async () => {
    // --- Small dataset: checkpoint capture ---
    const recordingSmall = buildRecordingSupabase();
    installSupabaseMock(recordingSmall.supabase);
    const smallDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(smallDb as never, 'user_a');
    const todos = await import('@/features/todos/todos.data');
    for (let i = 0; i < 10; i++) {
      await todos.addTodo({ title: `Small todo ${i}` });
    }
    const checkpointSmall = await import('@/core/backup/backupCheckpoint');
    await measure('checkpoint capture (small: 10 todos)', () =>
      checkpointSmall.runBackupMaintenance(),
    );
    const smallManifests = recordingSmall.upserted.filter(
      (call) => call.entity === 'backup_manifest',
    );
    expect(smallManifests).toHaveLength(1);
    await smallDb.closeAsync();

    // --- Long history: checkpoint capture + restore round trip ---
    const recordingLong = buildRecordingSupabase();
    installSupabaseMock(recordingLong.supabase);
    const longDb = await freshDatabase();
    const { setLocalDatasetOwner: setOwner2 } = await import('@/core/auth/account.data');
    await setOwner2(longDb as never, 'user_a');
    const habitId = await seedLongHistory(longDb, 2_000);
    const todos2 = await import('@/features/todos/todos.data');
    await todos2.addTodo({ title: 'Long todo' });
    const checkpointLong = await import('@/core/backup/backupCheckpoint');
    await measure('checkpoint capture (long: 2000 completions + 1 todo)', () =>
      checkpointLong.runBackupMaintenance(),
    );
    const longManifests = recordingLong.upserted.filter(
      (call) => call.entity === 'backup_manifest',
    );
    expect(longManifests).toHaveLength(1);
    const longMeta = longManifests[0].rows[0].entity_metadata as Record<string, { count: number }>;
    expect(longMeta.habit_completions.count).toBe(2_000);
    await longDb.closeAsync();

    // Restore: serve the long backup to a pristine device and time the whole
    // restoreFromRemoteBackupV2 path (fetch + validate + integrity + import).
    const serving = servingFrom(recordingLong.upserted);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const restored = await measure('restore v2 (long: 2000 completions)', () =>
      restoreFromRemoteBackupV2(),
    );
    expect(restored.status).toBe('restored');
    if (restored.status === 'restored') {
      expect(restored.importedCounts.habit_completions).toBe(2_000);
    }
    const targetRow = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM habit_completions',
    );
    expect(Number(targetRow?.count)).toBe(2_000);
    const habitCheck = await targetDb.getFirstAsync<{ id: string }>(
      'SELECT id FROM habits WHERE id = ?',
      [habitId],
    );
    expect(habitCheck?.id).toBe(habitId);
    await targetDb.closeAsync();
  }, 60_000);
});
