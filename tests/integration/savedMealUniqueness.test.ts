import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Backup V2 closure — saved-meal uniqueness contract at the client/sync
 * layer.
 *
 * The remote uniqueness is owner-scoped (`UNIQUE (user_id, lower(food_name))`,
 * enforced by Postgres; proven live). These tests pin the client-side
 * semantics that make that contract consistent: the local device coalesces
 * case variations into ONE row (the NOCASE upsert), hard-delete/recreate
 * produces a new id with a remote DELETE + create, and different owners push
 * the same food name as separate owner-scoped rows without client errors.
 */

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };
type DeleteCall = { entity: string; id: string };

/** The authenticated Supabase user the mock reports; tests flip it per owner. */
const currentUser = vi.hoisted(() => ({ value: 'user_a' }));

function buildRecordingSupabase() {
  const upserted: UpsertCall[] = [];
  const deleted: DeleteCall[] = [];
  const from = vi.fn((entity: string) => ({
    upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
      const rowList = Array.isArray(rows) ? rows : [rows];
      upserted.push({ entity, rows: rowList });
      return { error: null };
    }),
    delete: vi.fn(() => ({
      in: vi.fn((column: string, values: string[]) => ({
        eq: vi.fn(async (_column2: string, _value2: string) => {
          if (column === 'id') {
            for (const value of values) deleted.push({ entity, id: value });
          }
          return { error: null };
        }),
      })),
    })),
  }));
  return { supabase: { from }, upserted, deleted };
}

function installSupabaseMock(supabase: { from: ReturnType<typeof vi.fn> }) {
  vi.doMock('@/lib/supabase', () => ({
    supabase,
    isRemoteEnabled: vi.fn(() => true),
    getSupabaseAuthUserId: vi.fn().mockResolvedValue(currentUser.value),
    getSupabaseSessionUserId: vi.fn().mockResolvedValue(currentUser.value),
    setRemoteMode: vi.fn(),
    ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
  }));
}

async function installOwner(owner: string): Promise<TestDatabase> {
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, owner);
  return db;
}

async function saveMeal(
  db: TestDatabase,
  foodName: string,
): Promise<{ id: string; calories: number }> {
  const calories = await import('@/features/calories/calories.data');
  await calories.upsertSavedMeal({
    foodName,
    calories: 300,
    protein: 30,
    carbs: 0,
    fats: 20,
    fiber: 0,
    mealType: 'lunch',
  });
  const row = await db.getFirstAsync<{ id: string; calories: number }>(
    'SELECT id, calories FROM saved_meals WHERE food_name = ?',
    [foodName],
  );
  if (!row) throw new Error('saved meal row missing');
  return { id: row.id, calories: Number(row.calories) };
}

describe('saved-meal owner-scoped uniqueness — client contract', () => {
  it('coalesces same-owner case variations into one row and one remote id', async () => {
    currentUser.value = 'user_a';
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const db = await installOwner('user_a');
    const calories = await import('@/features/calories/calories.data');

    await saveMeal(db, 'Chicken Breast');
    const firstId = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM saved_meals WHERE food_name = 'Chicken Breast'",
    );
    expect(firstId).not.toBeNull();

    // Same logical food with different casing: the local NOCASE semantic keeps
    // ONE row (original casing preserved) and increments use_count.
    await calories.upsertSavedMeal({
      foodName: 'chicken breast',
      calories: 300,
      protein: 30,
      carbs: 0,
      fats: 20,
      fiber: 0,
      mealType: 'lunch',
    });
    const rows = await db.getAllAsync<{ id: string; food_name: string; use_count: number }>(
      'SELECT id, food_name, use_count FROM saved_meals',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(firstId?.id);
    expect(rows[0].food_name).toBe('Chicken Breast'); // original casing kept
    expect(Number(rows[0].use_count)).toBe(2);

    // The sync intent rides the same id: one remote row, not two.
    const { syncEngine } = await import('@/core/sync/sync.engine');
    await syncEngine.flush();
    const mealUpserts = recording.upserted.filter((call) => call.entity === 'saved_meals');
    const remoteIds = new Set(
      mealUpserts.flatMap((call) => call.rows.map((row) => row.id as string)),
    );
    expect(remoteIds.size).toBe(1);
    expect(remoteIds.has(firstId?.id ?? '')).toBe(true);
    await db.closeAsync();
  });

  it('hard-delete then recreate uses a new id with a remote delete followed by a create', async () => {
    currentUser.value = 'user_a';
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const db = await installOwner('user_a');
    const calories = await import('@/features/calories/calories.data');

    await saveMeal(db, 'Protein oats');
    const firstId = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM saved_meals WHERE food_name = 'Protein oats'",
    );
    await calories.deleteSavedMeal(firstId?.id ?? '');
    const second = await saveMeal(db, 'Protein oats');
    expect(second.id).not.toBe(firstId?.id);

    const { syncEngine } = await import('@/core/sync/sync.engine');
    await syncEngine.flush();
    const mealDeletes = recording.deleted.filter((call) => call.entity === 'saved_meals');
    expect(mealDeletes.map((call) => call.id)).toContain(firstId?.id ?? '');
    const mealUpserts = recording.upserted.filter((call) => call.entity === 'saved_meals');
    const remoteIds = new Set(
      mealUpserts.flatMap((call) => call.rows.map((row) => row.id as string)),
    );
    expect(remoteIds.has(firstId?.id ?? '')).toBe(false); // deleted, not upserted
    expect(remoteIds.has(second.id)).toBe(true);
    await db.closeAsync();
  });

  it('pushes the same food name as separate owner-scoped rows for different owners', async () => {
    const recording = buildRecordingSupabase();

    // Owner A backs up "Chicken Breast" under its own auth identity.
    currentUser.value = 'user_a';
    installSupabaseMock(recording.supabase);
    const dbA = await installOwner('user_a');
    const first = await saveMeal(dbA, 'Chicken Breast');
    const { syncEngine: engineA } = await import('@/core/sync/sync.engine');
    await engineA.flush();
    await dbA.closeAsync();

    // Owner B (fresh module registry, fresh database, fresh auth identity)
    // saves the same food name; the shared recording stub is re-installed.
    currentUser.value = 'user_b';
    const dbB = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(dbB as never, 'user_b');
    installSupabaseMock(recording.supabase);
    const second = await saveMeal(dbB, 'Chicken Breast');
    const { syncEngine: engineB } = await import('@/core/sync/sync.engine');
    await engineB.flush();

    const mealUpserts = recording.upserted.filter((call) => call.entity === 'saved_meals');
    const rows = mealUpserts.flatMap((call) => call.rows);
    const owners = new Set(rows.map((row) => row.user_id as string));
    const names = new Set(rows.map((row) => row.food_name as string));
    expect(owners.has('user_a')).toBe(true);
    expect(owners.has('user_b')).toBe(true);
    expect(names).toEqual(new Set(['Chicken Breast']));
    // Each owner pushes exactly its own row under its own id — the remote
    // upsert is owner-scoped by id, so owner-scoped uniqueness never
    // interferes across owners.
    const ids = new Set(rows.map((row) => row.id as string));
    expect(ids).toEqual(new Set([first.id, second.id]));
    await dbB.closeAsync();
  });
});
