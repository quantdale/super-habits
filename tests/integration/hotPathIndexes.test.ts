import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Migration 24 hot-path index coverage.
 *
 * The dashboard/overview refresh path issues date-range reads against the
 * unbounded history tables (pomodoro_sessions, workout_logs,
 * habit_completions) and the pending-todos list on every section activation.
 * Before migration 24 none of those had a usable index, so every read was a
 * full table scan that grew forever.
 *
 * These assertions pin the QUERY PLANNER behavior (EXPLAIN QUERY PLAN), not
 * just index existence: if a future edit changes a hot query's shape so the
 * index no longer applies, this fails loudly instead of silently degrading.
 */

type PlanRow = { detail: string };

async function explain(db: TestDatabase, sql: string, params: unknown[]): Promise<string[]> {
  const rows = await db.getAllAsync<PlanRow>(`EXPLAIN QUERY PLAN ${sql}`, params);
  return rows.map((row) => row.detail);
}

async function seedRows(
  db: TestDatabase,
  table: string,
  columns: string[],
  rowFactory: (index: number) => unknown[],
  count: number,
): Promise<void> {
  const values = Array.from({ length: count }, (_, i) => `(${columns.map(() => '?').join(', ')})`);
  const params = Array.from({ length: count }, (_, i) => rowFactory(i)).flat();
  await db.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values.join(', ')}`,
    params,
  );
}

describe('migration 24 hot-path indexes', () => {
  it('uses range indexes for pomodoro, workout-log, and completion day-range reads', async () => {
    const db = await freshDatabase();
    const baseIso = '2026-01-10T00:00:00.000Z';

    await seedRows(
      db,
      'pomodoro_sessions',
      ['id', 'started_at', 'ended_at', 'duration_seconds', 'session_type', 'created_at'],
      (i) => [`pom_${i}`, baseIso, baseIso, 1500, 'focus', baseIso],
      200,
    );
    await seedRows(
      db,
      'workout_logs',
      ['id', 'routine_id', 'completed_at', 'created_at'],
      (i) => [`wrk_${i}`, 'wrk_routine', baseIso, baseIso],
      200,
    );
    await seedRows(
      db,
      'habit_completions',
      ['id', 'habit_id', 'date_key', 'count', 'created_at', 'updated_at'],
      (i) => {
        // UNIQUE(habit_id, date_key): spread the seeded days so pairs stay unique.
        const dayOffset = Math.floor(i / 50);
        const dayKey = `2026-0${1 + dayOffset}-15`;
        return [`hcmp_${i}`, `habit_${i % 50}`, dayKey, 1, baseIso, baseIso];
      },
      200,
    );

    // Overview weekly focus read (listPomodoroSessionsForDateRange).
    const pomodoroPlan = await explain(
      db,
      `SELECT * FROM pomodoro_sessions
       WHERE started_at >= ? AND started_at < ?
       ORDER BY started_at DESC`,
      [baseIso, '2026-01-11T00:00:00.000Z'],
    );
    expect(pomodoroPlan.join(' ')).toContain('idx_pomodoro_sessions_started_at');

    // Overview weekly workout read (listWorkoutLogsForRange).
    const workoutPlan = await explain(
      db,
      `SELECT * FROM workout_logs
       WHERE completed_at >= ? AND completed_at < ?
       ORDER BY completed_at DESC`,
      [baseIso, '2026-01-11T00:00:00.000Z'],
    );
    expect(workoutPlan.join(' ')).toContain('idx_workout_logs_completed_at');

    // Overview/completion day-range read (getAllHabitCompletionsForRange).
    const completionsPlan = await explain(
      db,
      `SELECT habit_id, date_key, count
       FROM habit_completions
       WHERE date_key >= ? AND date_key <= ?
       ORDER BY date_key ASC`,
      ['2026-01-01', '2026-01-02'],
    );
    expect(completionsPlan.join(' ')).toContain('idx_habit_completions_date_key');

    await db.closeAsync();
  });

  it('uses the partial pending index for the pending-todos list and count', async () => {
    const db = await freshDatabase();
    const iso = '2026-01-10T00:00:00.000Z';

    await seedRows(
      db,
      'todos',
      [
        'id',
        'title',
        'completed',
        'sort_order',
        'priority',
        'created_at',
        'updated_at',
        'deleted_at',
      ],
      (i) => {
        // A mix of pending, completed, and tombstoned rows: only the pending
        // active subset may enter the partial index.
        const completed = i % 2 === 0 ? 0 : 1;
        const deleted = i % 7 === 0 ? iso : null;
        return [`todo_${i}`, `Todo ${i}`, completed, i, 'normal', iso, iso, deleted];
      },
      300,
    );

    const listPlan = await explain(
      db,
      `SELECT * FROM todos
       WHERE deleted_at IS NULL
         AND completed = 0
       ORDER BY sort_order ASC, created_at DESC`,
      [],
    );
    expect(listPlan.join(' ')).toContain('idx_todos_pending_sort');

    const countPlan = await explain(
      db,
      `SELECT COUNT(*) AS count FROM todos WHERE deleted_at IS NULL AND completed = 0`,
      [],
    );
    expect(countPlan.join(' ')).toContain('idx_todos_pending_sort');

    // The index must only cover the pending active subset — verify semantics
    // stayed intact after seeding mixed rows.
    const counted = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM todos WHERE deleted_at IS NULL AND completed = 0`,
    );
    const expectedPending = Array.from({ length: 300 }, (_, i) => i).filter(
      (i) => i % 2 === 0 && i % 7 !== 0,
    ).length;
    expect(Number(counted?.count ?? 0)).toBe(expectedPending);

    await db.closeAsync();
  });
});
