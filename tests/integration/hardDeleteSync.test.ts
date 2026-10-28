import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';
import { seedVerifiedGenerationBaseHead } from './helpers/generationBaseline';
import { chainableQuery } from './helpers/supabaseQueryDouble';

/**
 * Audit C §4.7 #6 / C #8 — a local hard delete must reach the remote as a
 * remote DELETE and must drain, not strand.
 *
 * The product hard-deletes three synced shapes locally (saved meals, saved-meal
 * redo, and the workout session-log triple, which carries no `deleted_at`
 * column). Those tables are listed in `BACKUP_HARD_DELETE_ENTITIES`, so the
 * adapter's only legal handling of their queued `delete` intent is a remote
 * `DELETE ... WHERE id IN (...) AND user_id = ...`. Two failure modes are
 * invisible without driving the REAL adapter against a remote double:
 *
 * - the intent is forwarded as an upsert of a row that no longer exists locally,
 *   which the adapter rejects as `Missing local rows for <entity>` — classified
 *   `missing_local_row`, terminal, and stranded in the outbox forever;
 * - the delete is silently skipped, so the backup keeps a row the user deleted.
 *
 * The assertions therefore pair "a remote delete fired for exactly these ids"
 * with "the record drained" (not blocked, not pending, outbox empty), plus the
 * non-vacuity control that nothing was upserted for the deleted ids.
 */

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };
type DeleteCall = { entity: string; ids: string[]; userId: string };

const currentUser = vi.hoisted(() => ({ value: 'user_a' }));

function buildRecordingSupabase() {
  const upserted: UpsertCall[] = [];
  const deleted: DeleteCall[] = [];
  const stored = new Map<string, Map<string, Record<string, unknown>>>();

  const supabase = {
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
        const rowList = Array.isArray(rows) ? rows : [rows];
        upserted.push({ entity, rows: rowList });
        const table = stored.get(entity) ?? new Map<string, Record<string, unknown>>();
        for (const row of rowList) table.set(String(row.id), row);
        stored.set(entity, table);
        return { error: null };
      }),
      // Push verification read-back + the AUD-SH02-A generation-head probe.
      select: vi.fn((_columns: string) =>
        entity === 'backup_generation_head'
          ? {
              eq: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [{ snapshot_id: 'existing', sequence: 1 }],
                  error: null,
                })),
              })),
            }
          : {
              in: vi.fn((_column: string, ids: string[]) => ({
                eq: vi.fn((_eqColumn: string, value: string) =>
                  chainableQuery(
                    ids
                      .filter((id) => stored.get(entity)?.get(id)?.user_id === value)
                      .map((id) => ({ id })),
                  ),
                ),
              })),
            },
      ),
      delete: vi.fn(() => ({
        in: vi.fn((column: string, ids: string[]) => ({
          eq: vi.fn(async (_column: string, userId: string) => {
            if (column === 'id') {
              deleted.push({ entity, ids, userId });
              for (const id of ids) stored.get(entity)?.delete(id);
            }
            return { error: null };
          }),
        })),
      })),
    })),
    rpc: vi.fn(async () => ({
      data: {
        protocol_version: 2,
        publication_provenance_version: 1,
        content_verification_version: 1,
        sequence_reservation_version: 1,
        backup_schema_version: 2,
        scope_version: 7,
        settings_version: 5,
      },
      error: null,
    })),
  };

  return { supabase, upserted, deleted };
}

async function installOwner(owner: string): Promise<TestDatabase> {
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, owner);
  await seedVerifiedGenerationBaseHead(db, owner);
  return db;
}

/** Every queued intent must be gone: drained, not blocked, not retried. */
async function expectDrained(db: TestDatabase): Promise<void> {
  const { syncEngine } = await import('@/core/sync/sync.engine');
  expect(syncEngine.getBlockedKeys(), 'no record reached the terminal state').toEqual([]);
  expect(syncEngine.getPendingCount(), 'nothing is still waiting to push').toBe(0);
  const queued = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  expect(queued?.count ?? -1).toBe(0);
}

describe('hard-delete entities push a remote DELETE and drain (real adapter)', () => {
  it('saved meal: remote delete fires for the id, nothing is upserted for it, the intent drains', async () => {
    currentUser.value = 'user_a';
    const recording = buildRecordingSupabase();
    vi.doMock('@/lib/supabase', () => ({
      supabase: recording.supabase,
      isRemoteEnabled: vi.fn(() => true),
      getSupabaseAuthUserId: vi.fn().mockResolvedValue(currentUser.value),
      getSupabaseSessionUserId: vi.fn().mockResolvedValue(currentUser.value),
      setRemoteMode: vi.fn(),
      ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
    }));
    const db = await installOwner('user_a');
    const calories = await import('@/features/calories/calories.data');

    await calories.upsertSavedMeal({
      foodName: 'Protein oats',
      calories: 300,
      protein: 30,
      carbs: 10,
      fats: 8,
      fiber: 4,
      mealType: 'breakfast',
    });
    const mealId = (
      await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM saved_meals WHERE food_name = 'Protein oats'",
      )
    )?.id;
    expect(mealId).toBeTruthy();
    const rowBeforeDelete = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM saved_meals WHERE id = ?',
      [mealId],
    );
    expect(rowBeforeDelete).toEqual({ n: 1 });

    await calories.deleteSavedMeal(mealId as string);

    const { syncEngine } = await import('@/core/sync/sync.engine');
    await syncEngine.flush();

    const mealDeletes = recording.deleted.filter((call) => call.entity === 'saved_meals');
    expect(mealDeletes, 'a remote DELETE was issued for saved_meals').toHaveLength(1);
    expect(mealDeletes[0]?.ids).toEqual([mealId]);
    expect(mealDeletes[0]?.userId).toBe('user_a');
    // The deleted id is never re-upserted: the local row is gone, so an upsert
    // would fail the adapter's local-row check and strand the intent.
    const upsertedIds = recording.upserted
      .filter((call) => call.entity === 'saved_meals')
      .flatMap((call) => call.rows.map((row) => row.id));
    expect(upsertedIds).not.toContain(mealId);

    await expectDrained(db);
    await db.closeAsync();
  });

  it('workout log: the session-log triple deletes remotely per row and drains', async () => {
    currentUser.value = 'user_a';
    const recording = buildRecordingSupabase();
    vi.doMock('@/lib/supabase', () => ({
      supabase: recording.supabase,
      isRemoteEnabled: vi.fn(() => true),
      getSupabaseAuthUserId: vi.fn().mockResolvedValue(currentUser.value),
      getSupabaseSessionUserId: vi.fn().mockResolvedValue(currentUser.value),
      setRemoteMode: vi.fn(),
      ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
    }));
    const db = await installOwner('user_a');
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('OOPS Push', 'accidental');
    const routineId = (
      await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM workout_routines WHERE name = 'OOPS Push'`,
      )
    )?.id as string;
    await workout.addExercise({ routineId, name: 'Bench Press' });
    await workout.completeRoutine(routineId);
    const logId = (
      await db.getFirstAsync<{ id: string }>('SELECT id FROM workout_logs WHERE routine_id = ?', [
        routineId,
      ])
    )?.id as string;
    // A guided session persists the nested snapshot rows as well.
    await db.runAsync(
      `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
       VALUES ('wsex_sync1', ?, 'Bench Press', 3, datetime('now'))`,
      [logId],
    );
    await db.runAsync(
      `INSERT INTO workout_session_sets
         (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
       VALUES ('wset_sync1', 'wsex_sync1', 1, 80, 8, 'kg', 1, datetime('now'))`,
    );

    expect(await workout.deleteWorkoutLog(logId)).toBe(true);

    const { syncEngine } = await import('@/core/sync/sync.engine');
    await syncEngine.flush();

    const deletedIds = (entity: string) =>
      recording.deleted.filter((call) => call.entity === entity).flatMap((call) => call.ids);
    expect(deletedIds('workout_logs')).toEqual([logId]);
    expect(deletedIds('workout_session_exercises')).toEqual(['wsex_sync1']);
    expect(deletedIds('workout_session_sets')).toEqual(['wset_sync1']);
    for (const call of recording.deleted) {
      expect(call.userId, `${call.entity} delete is owner-scoped`).toBe('user_a');
    }
    // Nothing in the triple is upserted after the local rows are gone.
    const upsertedTriple = recording.upserted
      .filter((call) => call.entity.startsWith('workout_'))
      .flatMap((call) => call.rows.map((row) => row.id));
    expect(upsertedTriple).not.toContain(logId);

    await expectDrained(db);
    await db.closeAsync();
  });

  it('routine delete: the soft-deleted parent and its children are pushed as tombstones and drain', async () => {
    currentUser.value = 'user_a';
    const recording = buildRecordingSupabase();
    vi.doMock('@/lib/supabase', () => ({
      supabase: recording.supabase,
      isRemoteEnabled: vi.fn(() => true),
      getSupabaseAuthUserId: vi.fn().mockResolvedValue(currentUser.value),
      getSupabaseSessionUserId: vi.fn().mockResolvedValue(currentUser.value),
      setRemoteMode: vi.fn(),
      ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
    }));
    const db = await installOwner('user_a');
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Old split', 'retired');
    const routineId = (
      await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM workout_routines WHERE name = 'Old split'`,
      )
    )?.id as string;
    await workout.addExercise({ routineId, name: 'Squat' });

    await workout.deleteRoutine(routineId);

    const { syncEngine } = await import('@/core/sync/sync.engine');
    await syncEngine.flush();

    const routineRows = recording.upserted
      .filter((call) => call.entity === 'workout_routines')
      .flatMap((call) => call.rows);
    const tombstone = routineRows.filter((row) => row.id === routineId).at(-1);
    expect(tombstone, 'the routine was pushed').toBeTruthy();
    expect(tombstone?.deleted_at, 'pushed as a tombstone, not a live row').toBeTruthy();
    // Routine deletes are soft, so no physical remote DELETE is legal here.
    expect(recording.deleted.filter((call) => call.entity === 'workout_routines')).toEqual([]);

    await expectDrained(db);
    await db.closeAsync();
  });
});
