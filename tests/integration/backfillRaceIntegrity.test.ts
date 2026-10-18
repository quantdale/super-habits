/**
 * AUD-SH07-A / AUD-SH07-B — the backfill must not manufacture stale intents.
 *
 * Audited defect (SH-07, Medium): the backfill read candidate rows, THEN opened
 * its enqueue transaction. A real SQLite barrier deleted `smeal_1` after the
 * read and committed delete revision 1; the stale backfill then committed a
 * `create` at revision 2. Final state: the local row was gone while the durable
 * intent said "create", so the remote never deleted it and the missing-row
 * intent stalled the completeness checkpoint. Keyset pagination protected page
 * boundaries but not this within-batch race.
 *
 * These cases use real SQLite and a deterministic barrier (never a sleep) at the
 * exact hazard seam, and cover every hard-delete family plus the soft-delete and
 * edit controls that must keep working.
 */

import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

const NOW = '2026-01-01T00:00:00.000Z';

type OutboxRow = { entity: string; id: string; operation: string; revision: number };

async function readOutbox(db: TestDatabase): Promise<OutboxRow[]> {
  return db.getAllAsync<OutboxRow>(
    'SELECT entity, id, operation, revision FROM sync_outbox ORDER BY entity, id',
  );
}

/**
 * Install a one-shot barrier that runs `during` immediately after the backfill
 * reads the first page of `table`, and before its enqueue transaction opens.
 * This is the audited race, made deterministic.
 */
function barrierAfterFirstReadOf(
  db: TestDatabase,
  table: string,
  during: () => void,
): () => number {
  const original = db.getAllAsync.bind(db);
  let fired = 0;
  const patched = async (sql: string, params?: readonly unknown[]): Promise<unknown> => {
    const rows = await original(sql, params);
    if (fired === 0 && new RegExp(`FROM ${table}\\b`).test(sql)) {
      fired += 1;
      during();
    }
    return rows;
  };
  (db as unknown as { getAllAsync: typeof patched }).getAllAsync = patched;
  return () => fired;
}

async function seedSavedMeal(db: TestDatabase, id: string, name = 'Saved meal'): Promise<void> {
  await db.runAsync(
    `INSERT INTO saved_meals (id, food_name, calories, meal_type, use_count, last_used_at, created_at)
     VALUES (?, ?, 100, 'lunch', 1, ?, ?)`,
    [id, name, NOW, NOW],
  );
}

async function bindOwner(db: TestDatabase, owner = 'user_a'): Promise<void> {
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, owner);
}

describe('AUD-SH07-A: a within-batch hard delete keeps the durable delete truth', () => {
  it('saved meals: a delete committed after the read does not become a stale create', async () => {
    const db = await freshDatabase();
    await seedSavedMeal(db, 'smeal_a');
    await bindOwner(db);
    const fired = barrierAfterFirstReadOf(db, 'saved_meals', () => {
      // The product hard-deletes saved meals by design; the delete path commits
      // its own durable delete intent in the same transaction.
      db.raw.prepare(`DELETE FROM saved_meals WHERE id = 'smeal_a'`).run();
      db.raw
        .prepare(
          `INSERT INTO sync_outbox (entity, id, updated_at, operation, owner_user_id, revision)
           VALUES ('saved_meals', 'smeal_a', ?, 'delete', 'user_a', 1)`,
        )
        .run(NOW);
    });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(fired()).toBe(1);

    const outbox = await readOutbox(db);
    const meal = outbox.filter((row) => row.entity === 'saved_meals');
    // Exactly the committed delete intent — no stale create, no duplicate.
    expect(meal).toHaveLength(1);
    expect(meal[0].operation).toBe('delete');
    // And the local row really is gone, so the intent matches local truth.
    const count = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM saved_meals WHERE id = 'smeal_a'",
    );
    expect(Number(count?.n ?? -1)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('habit completions: a count-to-zero delete does not leave a stale create', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
       VALUES ('habit_1', 'Drink water', 1, 'anytime', 'water-drop', '#64748b', '[]', ?, ?, NULL)`,
      [NOW, NOW],
    );
    await db.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ('hcmp_a', 'habit_1', '2026-01-01', 1, ?, ?)`,
      [NOW, NOW],
    );
    await bindOwner(db);
    const fired = barrierAfterFirstReadOf(db, 'habit_completions', () => {
      // Decrementing from count 1 to 0 is the documented hard-delete exception.
      db.raw.prepare(`DELETE FROM habit_completions WHERE id = 'hcmp_a'`).run();
    });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(fired()).toBe(1);

    const outbox = await readOutbox(db);
    expect(outbox.filter((row) => row.entity === 'habit_completions')).toHaveLength(0);
    await db.closeAsync();
  }, 60000);

  it('workout log family: a deleted nested row family leaves no stale creates', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
       VALUES ('wrk_1', 'Push day', NULL, ?, ?, NULL)`,
      [NOW, NOW],
    );
    await db.runAsync(
      `INSERT INTO routine_exercises (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
       VALUES ('ex_1', 'wrk_1', 'Bench press', 1, ?, ?, NULL)`,
      [NOW, NOW],
    );
    await db.runAsync(
      `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at)
       VALUES ('wrklog_a', 'wrk_1', NULL, ?, ?)`,
      [NOW, NOW],
    );
    await db.runAsync(
      `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
       VALUES ('wsex_a', 'wrklog_a', 'Bench press', 1, ?)`,
      [NOW],
    );
    await bindOwner(db);
    const fired = barrierAfterFirstReadOf(db, 'workout_logs', () => {
      // The session-log triple hard-deletes together by design.
      db.raw.prepare(`DELETE FROM workout_session_exercises WHERE log_id = 'wrklog_a'`).run();
      db.raw.prepare(`DELETE FROM workout_logs WHERE id = 'wrklog_a'`).run();
    });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(fired()).toBe(1);

    const outbox = await readOutbox(db);
    expect(outbox.filter((row) => row.entity === 'workout_logs')).toHaveLength(0);
    expect(outbox.filter((row) => row.entity === 'workout_session_exercises')).toHaveLength(0);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH07-B: control cases keep their intended behavior', () => {
  it('a soft delete after the read is enqueued truthfully as a tombstone', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_a', 'Existing', NULL, 0, ?, ?, NULL)`,
      [NOW, NOW],
    );
    await bindOwner(db);
    const fired = barrierAfterFirstReadOf(db, 'todos', () => {
      // A soft delete keeps the row; the backfill must record the tombstone
      // with the row's CURRENT deleted_at, not the stale NULL it read.
      db.raw
        .prepare(`UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = 'todo_a'`)
        .run('2026-02-02T00:00:00.000Z', '2026-02-02T00:00:00.000Z');
    });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(fired()).toBe(1);

    const outbox = await readOutbox(db);
    const todo = outbox.filter((row) => row.entity === 'todos' && row.id === 'todo_a');
    expect(todo).toHaveLength(1);
    expect(todo[0].operation).toBe('delete');
    await db.closeAsync();
  }, 60000);

  it('a newer edit committed after the read is not rewritten by the backfill', async () => {
    const db = await freshDatabase();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
       VALUES ('todo_b', 'Existing', NULL, 0, ?, ?, NULL)`,
      [NOW, NOW],
    );
    await bindOwner(db);
    const newerUpdatedAt = '2026-03-03T00:00:00.000Z';
    const fired = barrierAfterFirstReadOf(db, 'todos', () => {
      db.raw
        .prepare(`UPDATE todos SET title = 'Edited later', updated_at = ? WHERE id = 'todo_b'`)
        .run(newerUpdatedAt);
      // The write path enqueued its own (newer) intent in the same transaction.
      db.raw
        .prepare(
          `INSERT INTO sync_outbox (entity, id, updated_at, operation, owner_user_id, revision)
           VALUES ('todos', 'todo_b', ?, 'update', 'user_a', 99)`,
        )
        .run(newerUpdatedAt);
    });

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    expect(fired()).toBe(1);

    const outbox = await readOutbox(db);
    const todo = outbox.filter((row) => row.entity === 'todos' && row.id === 'todo_b');
    // The newer intent survives with its own revision; the backfill did not
    // overwrite it with a re-derivation of the older row state.
    expect(todo).toHaveLength(1);
    expect(todo[0].revision).toBe(99);
    await db.closeAsync();
  }, 60000);

  it('ordinary rows still drain completely with no deletion racing', async () => {
    const db = await freshDatabase();
    // Distinct food names: saved_meals has a unique food_name constraint.
    await seedSavedMeal(db, 'smeal_keep_1', 'Meal one');
    await seedSavedMeal(db, 'smeal_keep_2', 'Meal two');
    await bindOwner(db);
    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    const outbox = await readOutbox(db);
    const meals = outbox.filter((row) => row.entity === 'saved_meals').map((row) => row.id);
    expect(meals.sort()).toEqual(['smeal_keep_1', 'smeal_keep_2']);
    for (const row of outbox.filter((entry) => entry.entity === 'saved_meals')) {
      expect(row.operation).toBe('create');
      expect(row.revision).toBeGreaterThan(0);
    }
    await db.closeAsync();
  }, 60000);
});
