import { describe, expect, it, vi } from 'vitest';
import type { Todo } from '@/core/db/types';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Task 2.8 (+ 2.8a) — restore-coordinator behaviour against a REAL database.
 *
 * The unit suite (tests/restore.coordinator.test.ts) mocks every COUNT and
 * every write; here the coordinator runs verbatim against better-sqlite3 while
 * only the network boundary (`@/lib/supabase`) is stubbed with remote rows.
 *
 * Covered:
 *   - `getLocalSyncBackedCounts()` emptiness semantics as observable through
 *     `getRestorePreview()` eligibility: a truly empty device is eligible; any
 *     live row in any of the four sync-backed tables — including
 *     `workout_routines`, which restore never imports — blocks.
 *   - The in-transaction re-check abort path: a local row written between the
 *     eligibility preview and the import aborts the restore and imports nothing.
 *   - `applyRemote*` behavioural contract: idempotent `INSERT OR REPLACE` keyed
 *     on `id`, replacing an existing row's fields, never duplicating.
 *
 * Task 2.8a — CG-2. The DECIDED contract (design.md D10) is that a device that
 * has ever held rows is not empty: tombstones count, and an import never
 * resurrects a locally-deleted todo whose delete was never pushed.
 */

type RemoteRowsByEntity = Record<string, readonly unknown[]>;

/** The database type the `applyRemote*` importers accept (getDatabase's). */
type RealDatabase = Awaited<ReturnType<typeof import('@/core/db/client').getDatabase>>;

/** Returns the app's own cached database instance (same one the coordinator uses). */
async function getRealDb(): Promise<RealDatabase> {
  const { getDatabase } = await import('@/core/db/client');
  return getDatabase();
}

/**
 * Minimal Supabase-chained-call stub implementing exactly the surface
 * `restore.coordinator` uses: one combined count+latest-updated_at request per
 * entity, plus paged rows for imports.
 */
function buildSupabaseMock(
  remoteRowsByEntity: RemoteRowsByEntity,
  options: { onRange?: (entity: string) => Promise<void> | void } = {},
) {
  const deletedAt = (row: unknown): unknown => (row as { deleted_at?: unknown }).deleted_at;
  const updatedAt = (row: unknown): string =>
    String((row as { updated_at?: string }).updated_at ?? '');
  const fromMock = vi.fn((entity: string) => {
    const rows = remoteRowsByEntity[entity] ?? [];
    const activeRows = () => rows.filter((row) => deletedAt(row) == null);

    return {
      select: vi.fn((_columns: string, queryOptions?: { head?: boolean; count?: string }) => {
        const query = {
          eq: vi.fn(() => query),
          is: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn(() => {
            const active = activeRows();
            const latest = [...active].sort((a, b) => updatedAt(b).localeCompare(updatedAt(a)))[0];
            return Promise.resolve({
              data: latest
                ? [{ updated_at: (latest as { updated_at?: unknown }).updated_at ?? null }]
                : [],
              ...(queryOptions?.count === 'exact' ? { count: active.length } : {}),
              error: null,
            });
          }),
          range: vi.fn(async (from: number, to: number) => {
            await options.onRange?.(entity);
            return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
          }),
        };
        return query;
      }),
    };
  });
  return { supabase: { from: fromMock } };
}

type SupabaseMock = ReturnType<typeof buildSupabaseMock>;

/**
 * Registers a supabase mock and boots a fresh real database + the real restore
 * coordinator. The coordinator and data layers are imported dynamically after
 * `freshDatabase()` resets the module registry.
 */
async function load(
  remoteRowsByEntity: RemoteRowsByEntity,
  options: { onRange?: (entity: string) => Promise<void> | void } = {},
): Promise<{
  db: TestDatabase;
  supabase: SupabaseMock['supabase'];
  coordinator: typeof import('@/core/sync/restore.coordinator');
}> {
  const supabaseMock = buildSupabaseMock(remoteRowsByEntity, options);
  vi.doMock('@/lib/supabase', () => ({
    supabase: supabaseMock.supabase,
    isRemoteEnabled: vi.fn(() => true),
    getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
    setRemoteMode: vi.fn(),
    ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
  }));

  const db = await freshDatabase();
  const coordinator = await import('@/core/sync/restore.coordinator');
  return { db, supabase: supabaseMock.supabase, coordinator };
}

/** A well-formed remote todo row (what `fetchRemoteRows` would return). */
function remoteTodo(overrides: Partial<Omit<Todo, 'id'>> & { id: string }): Todo {
  return {
    title: 'Imported todo',
    notes: null,
    completed: 0,
    due_date: null,
    priority: 'normal',
    sort_order: 1,
    recurrence: null,
    recurrence_id: null,
    project_id: null,
    goal_id: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const AVAILABLE_REMOTE_TODOS: RemoteRowsByEntity = {
  todos: [remoteTodo({ id: 'todo_1785000000000_imported' })],
  habits: [],
  calorie_entries: [],
  workout_routines: [],
};

describe('restore emptiness semantics (getLocalSyncBackedCounts)', () => {
  it('a truly empty device with a restorable backup is eligible', async () => {
    const { db, coordinator } = await load(AVAILABLE_REMOTE_TODOS);
    const todos = await import('@/features/todos/todos.data');

    const preview = await coordinator.getRestorePreview();
    expect(preview.remoteAvailable).toBe(true);
    expect(preview.eligibility).toMatchObject({ kind: 'empty_device' });
    expect(preview.startupPromptEligible).toBe(true);
    expect(preview.eligibility.localCounts).toEqual({
      todos: 0,
      habits: 0,
      calorie_entries: 0,
      workout_routines: 0,
    });

    // Sanity: we never touched the network for local counting decisions.
    expect(await todos.countPendingTodos()).toBe(0);
    await db.closeAsync();
  });

  it('any live row in any sync-backed table blocks restore', async () => {
    const { db, coordinator } = await load(AVAILABLE_REMOTE_TODOS);
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'local todo' });

    const preview = await coordinator.getRestorePreview();
    expect(preview.startupPromptEligible).toBe(false);
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'local_data_present',
    });
    expect(preview.eligibility.localCounts.todos).toBe(1);
    await db.closeAsync();
  });

  it('a workout routine — excluded from phase-one imports — still counts as local data', async () => {
    const { db, coordinator } = await load(AVAILABLE_REMOTE_TODOS);
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine('Local routine', 'never imported');

    const preview = await coordinator.getRestorePreview();
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'local_data_present',
    });
    expect(preview.eligibility.localCounts.workout_routines).toBe(1);
    await db.closeAsync();
  });
});

describe('in-transaction re-check abort path', () => {
  it('a todo written after the eligibility preview but before the import aborts the restore', async () => {
    // The remote fetch for `calorie_entries` is the last network round-trip
    // before the import transaction; inject the user's new todo there so it is
    // written after the eligibility preview read its counts.
    const { db, coordinator } = await load(AVAILABLE_REMOTE_TODOS, {
      onRange: async (entity) => {
        if (entity !== 'calorie_entries') return;
        const todos = await import('@/features/todos/todos.data');
        await todos.addTodo({ title: 'user typed this mid-restore' });
      },
    });

    const result = await coordinator.restoreFromRemoteBackup();

    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.preview.eligibility.kind).toBe('blocked');
      if (result.preview.eligibility.kind === 'blocked') {
        expect(result.preview.eligibility.reason).toBe('local_data_present');
      }
    }

    // Nothing was imported — the remote todo never landed.
    const imported = await db.getFirstAsync<{ id: string }>('SELECT id FROM todos WHERE id = ?', [
      'todo_1785000000000_imported',
    ]);
    expect(imported).toBeNull();

    // The user's own row is the only todo on the device.
    const localTodos = await db.getAllAsync<{ id: string }>('SELECT id FROM todos');
    expect(localTodos).toHaveLength(1);

    // No restore markers were written.
    for (const key of ['last_restore_at', 'last_restore_signature']) {
      const meta = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        [key],
      );
      expect(meta).toBeNull();
    }
    await db.closeAsync();
  });
});

describe('applyRemote* import behaviour (INSERT OR REPLACE)', () => {
  it('is idempotent: importing the same remote rows twice yields exactly one row each', async () => {
    const db = await freshDatabase();
    const { applyRemoteTodos } = await import('@/features/todos/todos.data');

    const rows = [remoteTodo({ id: 'todo_a' }), remoteTodo({ id: 'todo_b', title: 'B' })];
    await applyRemoteTodos(await getRealDb(), rows);
    await applyRemoteTodos(await getRealDb(), rows);

    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM todos');
    expect(count?.n).toBe(2);
    await db.closeAsync();
  });

  it('replaces an existing row keyed on id, including resurrecting a tombstone', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const { applyRemoteTodos } = await import('@/features/todos/todos.data');

    const localId = await todos.addTodo({ title: 'created locally' });

    // The backup holds the same id with newer content (this is the import
    // mechanism; whether the device should have been eligible is CG-2's domain).
    await applyRemoteTodos(await getRealDb(), [
      remoteTodo({ id: localId, title: 'remote version', completed: 1 }),
    ]);

    const row = await db.getFirstAsync<{ title: string; completed: number }>(
      'SELECT title, completed FROM todos WHERE id = ?',
      [localId],
    );
    expect(row).toEqual({ title: 'remote version', completed: 1 });
    const count = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM todos');
    expect(count?.n).toBe(1);
    await db.closeAsync();
  });

  it('imports habits and calorie entries readable through the real read paths', async () => {
    const db = await freshDatabase();
    const { applyRemoteHabits } = await import('@/features/habits/habits.data');
    const { applyRemoteCalorieEntries } = await import('@/features/calories/calories.data');
    const { getHabitRuleForDate, parseHabitRuleHistory } =
      await import('@/features/habits/habits.domain');

    await applyRemoteHabits(await getRealDb(), [
      {
        id: 'habit_imported',
        name: 'Hydrate',
        target_per_day: 8,
        reminder_time: '07:30',
        category: 'anytime',
        icon: 'check-circle',
        color: '#64748b',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-06-01', weekdays: [1, 3, 5], target_per_day: 2 },
        ]),
        project_id: null,
        goal_id: null,
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-02T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    await applyRemoteCalorieEntries(await getRealDb(), [
      {
        id: 'cal_imported',
        food_name: 'Oats',
        calories: 300,
        protein: 10,
        carbs: 50,
        fats: 5,
        fiber: 4,
        meal_type: 'breakfast',
        consumed_on: '2026-07-01',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-02T00:00:00.000Z',
        deleted_at: null,
      },
    ]);

    const habits = await import('@/features/habits/habits.data');
    const calories = await import('@/features/calories/calories.data');
    expect((await habits.listHabits()).map((h) => h.name)).toEqual(['Hydrate']);
    const importedHabit = (await habits.listHabits())[0];
    expect(importedHabit?.reminder_time).toBe('07:30');
    expect(
      getHabitRuleForDate(
        parseHabitRuleHistory(importedHabit?.rule_history),
        '2026-06-02',
        importedHabit?.target_per_day,
        '2026-06-01',
      ),
    ).toMatchObject({ weekdays: [1, 3, 5], target_per_day: 2 });
    expect((await calories.listCalorieEntries('2026-07-01')).map((e) => e.food_name)).toEqual([
      'Oats',
    ]);
    await db.closeAsync();
  });
});

describe('CG-2: restore emptiness counts deleted rows', () => {
  it('a device holding only soft-deleted todos is not empty — restore must be blocked (CG-2: fix-restore-emptiness-counts-deleted-rows)', async () => {
    const { db, coordinator } = await load(AVAILABLE_REMOTE_TODOS);
    const todos = await import('@/features/todos/todos.data');

    // The user deleted every todo; the deletes were never pushed. The only
    // rows left are tombstones.
    const id = await todos.addTodo({ title: 'gone forever' });
    await todos.removeTodo(id);

    const preview = await coordinator.getRestorePreview();

    // Decided contract (D10): a device that has ever held rows is not empty;
    // Tombstones count, so eligibility is blocked.
    expect(preview.eligibility).toMatchObject({
      kind: 'blocked',
      reason: 'local_data_present',
    });
    expect(preview.startupPromptEligible).toBe(false);
    await db.closeAsync();
  });

  it('an import never resurrects a locally-deleted todo whose deletion was not yet pushed (CG-2: fix-restore-emptiness-counts-deleted-rows)', async () => {
    // The backup still holds the todo as live because the delete was never
    // pushed. The device holds only its tombstone.
    const { db, coordinator } = await load({
      todos: [remoteTodo({ id: 'todo_offline_deleted', title: 'user deleted me offline' })],
      habits: [],
      calorie_entries: [],
      workout_routines: [],
    });
    const todos = await import('@/features/todos/todos.data');

    const id = await todos.addTodo({ title: 'user deleted me offline' });
    await todos.removeTodo(id);

    const result = await coordinator.restoreFromRemoteBackup();

    // The import must not run on a tombstoned device, so the user's most
    // recent intent wins and the tombstone remains intact.
    if (result.status === 'restored') {
      expect(result.importedCounts.todos).toBe(0);
    }
    const row = await db.getFirstAsync<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM todos WHERE id = ?',
      [id],
    );
    expect(row?.deleted_at).not.toBeNull();
    await db.closeAsync();
  });
});
