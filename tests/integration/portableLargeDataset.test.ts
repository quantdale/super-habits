import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Portable Data Export & Import V1 — large long-term dataset.
 *
 * A synthetic multi-year dataset (tens of thousands of history rows) is
 * exported and re-imported; serialization, file size, checksum/validation,
 * and import-transaction timings are measured, correctness is asserted
 * (row-level equality), and generous time bounds guard against pathological
 * UI blocking. Bounds are intentionally loose (seconds-scale) so the test
 * never flakes on slow CI machines.
 */

const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  return {
    state,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: async (key: string) => {
        state.delete(key);
      },
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: asyncStorageMock.impl.getItem,
    setItem: asyncStorageMock.impl.setItem,
    removeItem: asyncStorageMock.impl.removeItem,
  },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const DAY_KEYS: string[] = [];
{
  const start = new Date(Date.UTC(2024, 0, 1));
  for (let i = 0; i < 900; i += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    DAY_KEYS.push(date.toISOString().slice(0, 10));
  }
}

const ISO_BASE = '2024-01-01T08:00:00.000Z';

function seedLongTermDataset(db: TestDatabase): Promise<void> {
  return db.withTransactionAsync(async () => {
    const run = db.runAsync.bind(db);

    // Todos: 600 (200 completed, some with notes).
    for (let i = 1; i <= 600; i += 1) {
      await run(
        `INSERT INTO todos (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
        [
          `todo_${i}`,
          `Long-term todo ${i}`,
          i % 3 === 0 ? `Notes for todo ${i}` : null,
          i % 3 === 0 ? 1 : 0,
          DAY_KEYS[i % DAY_KEYS.length] ?? null,
          i % 2 === 0 ? 'urgent' : 'normal',
          i,
          DAY_KEYS[i % DAY_KEYS.length],
          DAY_KEYS[i % DAY_KEYS.length],
        ],
      );
    }

    // Habits: 20 with rule history; completions: 20 habits × 450 days.
    for (let h = 1; h <= 20; h += 1) {
      await run(
        `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, 'anytime', 'check-circle', '#64748b', ?, ?, ?, NULL)`,
        [
          `habit_${h}`,
          `Habit ${h}`,
          (h % 3) + 1,
          JSON.stringify([
            {
              effective_from_date: DAY_KEYS[0],
              weekdays: [1, 2, 3, 4, 5, 6, 7],
              target_per_day: (h % 3) + 1,
            },
          ]),
          `${ISO_BASE}`,
          `${ISO_BASE}`,
        ],
      );
      let completion = 1;
      for (let d = 0; d < 450; d += 1) {
        await run(
          `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `hcmp_${h}_${completion}`,
            `habit_${h}`,
            DAY_KEYS[d],
            d % 4 === 0 ? 0 : (h % 3) + 1,
            `${ISO_BASE}`,
            `${ISO_BASE}`,
          ],
        );
        completion += 1;
      }
    }

    // Calories: 5,000 entries across 900 days; 60 saved meals.
    for (let i = 1; i <= 5000; i += 1) {
      await run(
        `INSERT INTO calorie_entries (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          `cal_${i}`,
          `Food item ${i}`,
          200 + (i % 600),
          10 + (i % 40),
          20 + (i % 60),
          5 + (i % 25),
          i % 5,
          ['breakfast', 'lunch', 'dinner', 'snack'][i % 4],
          DAY_KEYS[i % DAY_KEYS.length],
          `${ISO_BASE}`,
          `${ISO_BASE}`,
        ],
      );
    }
    for (let i = 1; i <= 60; i += 1) {
      await run(
        `INSERT INTO saved_meals (id, food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `smeal_${i}`,
          `Saved meal ${i}`,
          300 + i,
          15 + i,
          40 + i,
          10,
          4,
          'lunch',
          i * 3,
          `${ISO_BASE}`,
          `${ISO_BASE}`,
        ],
      );
    }

    // Pomodoro: 3,000 sessions (900 days × ~3).
    let pomodoro = 1;
    for (let i = 1; i <= 3000; i += 1) {
      await run(
        `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `pom_${pomodoro}`,
          `${DAY_KEYS[i % DAY_KEYS.length]}T09:00:00.000Z`,
          `${DAY_KEYS[i % DAY_KEYS.length]}T09:25:00.000Z`,
          1500,
          i % 7 === 0 ? 'break' : 'focus',
          `${DAY_KEYS[i % DAY_KEYS.length]}T09:00:00.000Z`,
        ],
      );
      pomodoro += 1;
    }

    // Workout: 30 routines, 90 exercises, 270 sets, 60 logs, 120 session exercises.
    let setCounter = 1;
    for (let r = 1; r <= 30; r += 1) {
      await run(
        `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, NULL)`,
        [`wrk_${r}`, `Routine ${r}`, `Description ${r}`, `${ISO_BASE}`, `${ISO_BASE}`],
      );
      for (let e = 1; e <= 3; e += 1) {
        const exerciseId = `ex_${r}_${e}`;
        await run(
          `INSERT INTO routine_exercises (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [exerciseId, `wrk_${r}`, `Exercise ${r}.${e}`, e, `${ISO_BASE}`, `${ISO_BASE}`],
        );
        for (let s = 1; s <= 3; s += 1) {
          await run(
            `INSERT INTO routine_exercise_sets (id, exercise_id, set_number, active_seconds, rest_seconds, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
            [`eset_${setCounter}`, exerciseId, s, 40, 20, `${ISO_BASE}`, `${ISO_BASE}`],
          );
          setCounter += 1;
        }
      }
      if (r % 2 === 0) {
        const logId = `wlog_${r}`;
        await run(
          `INSERT INTO workout_logs (id, routine_id, notes, completed_at, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [logId, `wrk_${r}`, `Log ${r}`, `${ISO_BASE}`, `${ISO_BASE}`],
        );
        for (let se = 1; se <= 2; se += 1) {
          await run(
            `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [`wsex_${r}_${se}`, logId, `Exercise ${r}.${se}`, 3, `${ISO_BASE}`],
          );
        }
      }
    }

    // Linked-action rules: 12.
    for (let i = 1; i <= 12; i += 1) {
      await run(
        `INSERT INTO linked_action_rules (id, status, direction_policy, bidirectional_group_id, source_feature, source_entity_type, source_entity_id, trigger_type, target_feature, target_entity_type, target_entity_id, effect_type, effect_payload, created_at, updated_at, deleted_at)
         VALUES (?, 'active', 'one_way', NULL, 'todos', 'todo', ?, 'todo.completed', 'habits', 'habit', ?, 'habit.increment', '{}', ?, ?, NULL)`,
        [`la_${i}`, `todo_${i}`, `habit_${(i % 20) + 1}`, `${ISO_BASE}`, `${ISO_BASE}`],
      );
    }
  });
}

describe('portable large long-term dataset', () => {
  it('exports and imports tens of thousands of rows with measured, bounded timings', async () => {
    asyncStorageMock.state.set('superhabits.theme.mode', 'system');
    const sourceDb = await freshDatabase();
    await seedLongTermDataset(sourceDb);

    const totalRows =
      (
        await sourceDb.getFirstAsync<{ count: number }>(
          `SELECT SUM(count) AS count FROM (
           SELECT COUNT(*) AS count FROM todos UNION ALL
           SELECT COUNT(*) FROM habits UNION ALL
           SELECT COUNT(*) FROM habit_completions UNION ALL
           SELECT COUNT(*) FROM calorie_entries UNION ALL
           SELECT COUNT(*) FROM saved_meals UNION ALL
           SELECT COUNT(*) FROM workout_routines UNION ALL
           SELECT COUNT(*) FROM routine_exercises UNION ALL
           SELECT COUNT(*) FROM routine_exercise_sets UNION ALL
           SELECT COUNT(*) FROM workout_logs UNION ALL
           SELECT COUNT(*) FROM workout_session_exercises UNION ALL
           SELECT COUNT(*) FROM pomodoro_sessions UNION ALL
           SELECT COUNT(*) FROM linked_action_rules
         )`,
        )
      )?.count ?? 0;
    expect(totalRows).toBeGreaterThan(10_000);

    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exportStarted = Date.now();
    const result = await exportPortableBackup();
    const exportMs = Date.now() - exportStarted;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.byteLength).toBeGreaterThan(1_000_000); // ≥ 1 MB portable file
    expect(exportMs).toBeLessThan(30_000);

    // Capture the source row sample BEFORE closing the source database.
    const sampleTables = [
      'todos',
      'habit_completions',
      'calorie_entries',
      'pomodoro_sessions',
    ] as const;
    const sourceSample = await Promise.all(
      sampleTables.map(async (table) => ({
        table,
        rows: await sourceDb.getAllAsync<Record<string, unknown>>(
          `SELECT * FROM ${table} ORDER BY id ASC`,
        ),
      })),
    );
    await sourceDb.closeAsync();

    // The destination is a FRESH empty database (fresh module registry).
    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepareStarted = Date.now();
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    const prepareMs = Date.now() - prepareStarted;
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preview.totalRows).toBe(totalRows);
    expect(outcome.preview.counts.habit_completions).toBe(20 * 450);
    expect(outcome.preview.counts.calorie_entries).toBe(5000);
    expect(prepareMs).toBeLessThan(30_000);

    const importStarted = Date.now();
    const imported = await confirmPortableImport({ file: outcome.file });
    const importMs = Date.now() - importStarted;
    expect(imported.status).toBe('restored');
    if (imported.status !== 'restored') return;
    expect(importMs).toBeLessThan(60_000);

    // Row-level equivalence for a sample of the largest tables.
    for (const { table, rows: source } of sourceSample) {
      const target = await targetDb.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${table} ORDER BY id ASC`,
      );
      expect(target).toEqual(source);
    }
    expect(
      (
        await targetDb.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM workout_routines',
        )
      )?.count,
    ).toBe(30);
    expect(
      (
        await targetDb.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) AS count FROM routine_exercise_sets',
        )
      )?.count,
    ).toBe(270);

    // eslint-disable-next-line no-console
    console.log(
      `[portable-large] rows=${totalRows} fileBytes=${result.byteLength} exportMs=${exportMs} prepareMs=${prepareMs} importMs=${importMs}`,
    );

    await targetDb.closeAsync();
  }, 120_000);
});
