import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Backup Completeness V2 — existing-data backfill against real SQLite.
 *
 * Seeds pre-existing local-only history (habit completions, pomodoro
 * sessions, workout structure/history, saved meals, linked-action rules,
 * plus tombstones in soft-delete tables), then runs `ensureBackupBackfill()`
 * and asserts every row (active and tombstoned) is durably enqueued
 * owner-scoped through the SQLite outbox. Also proves idempotency and
 * restart-resume via per-entity completion markers.
 */

async function seedExistingState(db: TestDatabase): Promise<void> {
  const now = '2026-01-01T00:00:00.000Z';
  await db.runAsync(
    `INSERT INTO todos (id, title, notes, completed, created_at, updated_at, deleted_at)
     VALUES ('todo_1', 'existing', NULL, 0, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES ('habit_1', 'Drink water', 2, 'anytime', 'water-drop', '#64748b', '[]', ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
     VALUES ('hcmp_1', 'habit_1', '2025-12-01', 2, ?, ?)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
     VALUES ('pom_1', '2026-01-01T08:00:00.000Z', '2026-01-01T08:25:00.000Z', 1500, 'focus', ?)`,
    [now],
  );
  await db.runAsync(
    `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
     VALUES ('wrk_1', 'Push day', NULL, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO routine_exercises (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
     VALUES ('ex_1', 'wrk_1', 'Bench press', 1, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO routine_exercise_sets (id, exercise_id, set_number, active_seconds, rest_seconds, created_at, updated_at, deleted_at)
     VALUES ('eset_1', 'ex_1', 1, 40, 20, ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at)
     VALUES ('wrk_log_1', 'wrk_1', NULL, ?, ?)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
     VALUES ('wsex_1', 'wrk_log_1', 'Bench press', 3, ?)`,
    [now],
  );
  await db.runAsync(
    `INSERT INTO calorie_entries (id, food_name, calories, meal_type, consumed_on, created_at, updated_at, deleted_at)
     VALUES ('cal_1', 'Oats', 300, 'breakfast', '2026-01-01', ?, ?, NULL)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO saved_meals (id, food_name, calories, meal_type, use_count, last_used_at, created_at)
     VALUES ('smeal_1', 'Oats', 300, 'breakfast', 5, ?, ?)`,
    [now, now],
  );
  await db.runAsync(
    `INSERT INTO linked_action_rules (
       id, status, direction_policy, source_feature, source_entity_type, source_entity_id,
       trigger_type, target_feature, target_entity_type, target_entity_id,
       effect_type, effect_payload, created_at, updated_at, deleted_at
     ) VALUES (
       'link_1', 'active', 'one_way', 'todos', 'todo', 'todo_1',
       'todo.completed', 'habits', 'habit', 'habit_1',
       'habit.increment', '{"amount":1}', ?, ?, NULL
     )`,
    [now, now],
  );
  // A tombstone: soft-deleted routine must be enqueued too.
  await db.runAsync(
    `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
     VALUES ('wrk_2', 'Deleted routine', NULL, ?, ?, ?)`,
    [now, now, '2026-01-02T00:00:00.000Z'],
  );
}

async function readOutbox(db: TestDatabase) {
  return db.getAllAsync<{
    entity: string;
    id: string;
    operation: string;
    owner_user_id: string | null;
  }>('SELECT entity, id, operation, owner_user_id FROM sync_outbox ORDER BY entity, id');
}

describe('backup completeness v2 backfill', () => {
  it('durably enqueues every existing row owner-scoped, including tombstones', async () => {
    const db = await freshDatabase();
    await seedExistingState(db);
    // Establish durable owner evidence (as the account coordinator would).
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');

    const outbox = await readOutbox(db);
    const byEntity = new Map<string, { id: string; operation: string }[]>();
    for (const row of outbox) {
      const list = byEntity.get(row.entity) ?? [];
      list.push({ id: row.id, operation: row.operation });
      byEntity.set(row.entity, list);
      expect(row.owner_user_id).toBe('user_a');
    }

    expect(byEntity.get('todos')?.map((r) => r.id)).toEqual(['todo_1']);
    expect(byEntity.get('habits')?.map((r) => r.id)).toEqual(['habit_1']);
    expect(byEntity.get('habit_completions')?.map((r) => r.id)).toEqual(['hcmp_1']);
    expect(byEntity.get('pomodoro_sessions')?.map((r) => r.id)).toEqual(['pom_1']);
    expect(byEntity.get('calorie_entries')?.map((r) => r.id)).toEqual(['cal_1']);
    expect(byEntity.get('saved_meals')?.map((r) => r.id)).toEqual(['smeal_1']);
    expect(byEntity.get('workout_logs')?.map((r) => r.id)).toEqual(['wrk_log_1']);
    expect(byEntity.get('workout_session_exercises')?.map((r) => r.id)).toEqual(['wsex_1']);
    expect(byEntity.get('routine_exercises')?.map((r) => r.id)).toEqual(['ex_1']);
    expect(byEntity.get('routine_exercise_sets')?.map((r) => r.id)).toEqual(['eset_1']);
    expect(byEntity.get('linked_action_rules')?.map((r) => r.id)).toEqual(['link_1']);

    // Both routines: active AND tombstoned.
    const routines = byEntity.get('workout_routines');
    expect(routines?.map((r) => r.id).sort()).toEqual(['wrk_1', 'wrk_2']);
    const tombstone = routines?.find((r) => r.id === 'wrk_2');
    expect(tombstone?.operation).toBe('delete');

    // Settings snapshot record enqueued at the end of backfill.
    expect(byEntity.get('user_backup_settings')?.map((r) => r.id)).toEqual(['settings']);
  });

  it('waits when no durable owner evidence exists', async () => {
    const db = await freshDatabase();
    await seedExistingState(db);
    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('waiting');
    const outbox = await readOutbox(db);
    expect(outbox.filter((row) => row.entity !== 'user_backup_settings')).toHaveLength(0);
  });

  it('is idempotent: a second run enqueues nothing new', async () => {
    const db = await freshDatabase();
    await seedExistingState(db);
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');

    expect(await ensureBackupBackfill()).toBe('running');
    const first = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox',
    );
    expect(Number(first?.count)).toBeGreaterThan(0);

    expect(await ensureBackupBackfill()).toBe('done');
    const second = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox',
    );
    expect(Number(second?.count)).toBe(first?.count);
  });

  it('resumes from per-entity markers after a restart mid-backfill', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-backfill-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      // First "process": seed + bind owner + run backfill, then simulate a
      // kill by leaving only 'todos' marked complete.
      const firstDb = await freshDatabase(file);
      await seedExistingState(firstDb);
      const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
      await setLocalDatasetOwner(firstDb as never, 'user_a');
      const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
      expect(await ensureBackupBackfill()).toBe('running');
      await firstDb.closeAsync();

      // Simulate a crash: the process died before the durable marker for the
      // remaining entities was written — drop them and keep only 'todos'.
      const betterSqlite3 = await import('better-sqlite3');
      const Database = betterSqlite3.default;
      const raw = new Database(file);
      raw
        .prepare(
          `UPDATE app_meta SET value = '["todos"]' WHERE key = 'backup.backfill_done_entities'`,
        )
        .run();
      raw
        .prepare(`UPDATE app_meta SET value = 'running' WHERE key = 'backup.backfill_status'`)
        .run();
      raw.close();

      // Second "process": fresh module graph reopens the same file.
      const restartedDb = await freshDatabase(file);
      const { ensureBackupBackfill: rerun } = await import('@/core/backup/backupBackfill');
      expect(await rerun()).toBe('done');

      const outbox = await readOutbox(restartedDb);
      const byEntity = new Map<string, number>();
      for (const row of outbox) {
        byEntity.set(row.entity, (byEntity.get(row.entity) ?? 0) + 1);
      }
      // All entities enqueued exactly once (idempotent upsert).
      expect(byEntity.get('todos')).toBe(1);
      expect(byEntity.get('habits')).toBe(1);
      expect(byEntity.get('habit_completions')).toBe(1);
      expect(byEntity.get('pomodoro_sessions')).toBe(1);
      expect(byEntity.get('workout_routines')).toBe(2);
      expect(byEntity.get('routine_exercises')).toBe(1);
      expect(byEntity.get('routine_exercise_sets')).toBe(1);
      expect(byEntity.get('workout_logs')).toBe(1);
      expect(byEntity.get('workout_session_exercises')).toBe(1);
      expect(byEntity.get('calorie_entries')).toBe(1);
      expect(byEntity.get('saved_meals')).toBe(1);
      expect(byEntity.get('linked_action_rules')).toBe(1);
      await restartedDb.closeAsync();
    } finally {
      // Windows can briefly hold the file handle after close; retry.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          rmSync(dir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
  });

  it('keyset paging: a hard delete between pages cannot skip the boundary row (32-review regression)', async () => {
    const db = await freshDatabase();
    await seedExistingState(db); // smeal_1 + every other entity
    const now = '2026-01-01T00:00:00.000Z';
    // 24 more saved_meals (a BACKUP_HARD_DELETE entity): 'smeal_pNN' sorts
    // AFTER 'smeal_1' ('1' < 'p'), giving 25 rows → pages of 10 are
    // [smeal_1, p01..p09], [p10..p19], [p20..p24].
    for (let i = 1; i <= 24; i++) {
      const id = `smeal_p${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO saved_meals (id, food_name, calories, meal_type, use_count, last_used_at, created_at)
         VALUES (?, ?, 100, 'lunch', 1, ?, ?)`,
        [id, `Meal ${i}`, now, now],
      );
    }
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');

    // Deterministic interleave at the exact hazard seam: hard-delete a
    // page-1 row immediately AFTER backfill reads page 1. OFFSET paging
    // would resume at the shifted index and silently skip smeal_p10 (the
    // entity still marked done → manifest certifies a row the remote never
    // receives → restore integrity_mismatch). Keyset (id > cursor) cannot
    // skip: rows before the cursor do not affect which rows come next.
    const original = db.getAllAsync.bind(db);
    let savedMealsPages = 0;
    const patched = async (sql: string, params?: readonly unknown[]): Promise<unknown> => {
      const rows = await original(sql, params);
      if (/FROM saved_meals/.test(sql)) {
        savedMealsPages += 1;
        if (savedMealsPages === 1) {
          expect((rows as { id: string }[]).length).toBe(10);
          db.raw.prepare(`DELETE FROM saved_meals WHERE id = 'smeal_p05'`).run();
        }
      }
      return rows;
    };
    (db as unknown as { getAllAsync: typeof patched }).getAllAsync = patched;

    const { ensureBackupBackfill } = await import('@/core/backup/backupBackfill');
    expect(await ensureBackupBackfill()).toBe('running');
    // The interleave really fired (otherwise this test would pass vacuously):
    expect(savedMealsPages).toBeGreaterThan(1);
    const remaining = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM saved_meals',
    );
    expect(Number(remaining?.count)).toBe(24); // page-1 delete really happened

    const outbox = await readOutbox(db);
    const ids = outbox.filter((r) => r.entity === 'saved_meals').map((r) => r.id);
    const expected = [
      'smeal_1',
      ...Array.from({ length: 24 }, (_, i) => `smeal_p${String(i + 1).padStart(2, '0')}`),
    ].sort();
    // All25 originally-read rows enqueued (page 1 was read pre-delete) and —
    // the regression itself — page 2 still starts at p10, which OFFSET paging
    // skipped after the shift.
    expect([...ids].sort()).toEqual(expected);
    expect(ids).toContain('smeal_p10');
  });
});
