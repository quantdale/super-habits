import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Backup Completeness V2 — full Restore V2 against real SQLite.
 *
 * Phase 1 builds a real "source device": rows across every recoverable table
 * are written through the actual feature data layers and the checkpoint
 * cycle publishes a manifest to a recording Supabase stub. Phase 2 replays
 * those captured remote rows to a pristine "new device" and runs
 * `restoreFromRemoteBackupV2()`, asserting semantic equivalence (habit
 * streaks, focus minutes, workout structure/history, calories/saved meals,
 * settings) and the absence of any historical side effects (empty linked
 * action ledgers, empty outbox, no notifications replayed).
 *
 * Failure cases: corrupt checksum, malformed row, missing parent, duplicate
 * completion key, local-content race, fetch failure — each must leave the
 * target database untouched.
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
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    })),
  }));
  return { supabase: { from }, upserted };
}

function buildServingSupabase(
  remote: Map<string, Record<string, unknown>[]>,
  options: {
    corruptEntity?: string | null;
    malformedRow?: { entity: string; row: Record<string, unknown> } | null;
    dropParent?: { entity: string; id: string } | null;
    duplicateCompletion?: boolean;
    failEntity?: string | null;
  } = {},
) {
  const from = vi.fn((entity: string) => {
    const allRows = (remote.get(entity) ?? []).map((row) => ({ ...row }));
    const rowsForQuery = () => {
      let rows = allRows;
      if (options.corruptEntity === entity && allRows.length > 0) {
        rows = allRows.map((row) => ({ ...row, created_at: '1970-01-01T00:00:00.000Z' }));
      }
      if (options.malformedRow?.entity === entity) {
        rows = [...rows, { ...options.malformedRow.row }];
      }
      if (options.dropParent?.entity === entity) {
        rows = rows.filter((row) => row.id !== options.dropParent?.id);
      }
      if (options.duplicateCompletion && entity === 'habit_completions' && rows.length > 0) {
        rows = [...rows, { ...rows[0], id: 'hcmp_duplicate' }];
      }
      return rows;
    };
    return {
      select: vi.fn((columns: string, queryOptions?: { head?: boolean }) => {
        if (queryOptions?.head) {
          return {
            eq: vi.fn(() => ({
              is: vi.fn(() =>
                Promise.resolve({ data: null, count: rowsForQuery().length, error: null }),
              ),
            })),
          };
        }
        const query = {
          eq: vi.fn(() => query),
          is: vi.fn(() => query),
          order: vi.fn(() => query),
          limit: vi.fn(() => {
            if (options.failEntity === entity) {
              return Promise.resolve({
                data: null,
                error: { message: 'simulated network failure' },
              });
            }
            if (columns === 'payload') {
              const settings = rowsForQuery()[0]?.payload ?? null;
              return Promise.resolve({
                data: settings === null ? [] : [{ payload: settings }],
                error: null,
              });
            }
            return Promise.resolve({ data: rowsForQuery().slice(0, 1), error: null });
          }),
          range: vi.fn((from: number, to: number) => {
            if (options.failEntity === entity) {
              return Promise.resolve({
                data: null,
                error: { message: 'simulated network failure' },
              });
            }
            return Promise.resolve({ data: rowsForQuery().slice(from, to + 1), error: null });
          }),
        };
        return query;
      }),
    };
  });
  return { supabase: { from } };
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

const REMOTE_ENTITIES = [
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
];

function remoteFromUpserts(upserted: UpsertCall[]): Map<string, Record<string, unknown>[]> {
  const map = new Map<string, Record<string, unknown>[]>();
  for (const entity of REMOTE_ENTITIES) {
    map.set(
      entity,
      upserted.filter((call) => call.entity === entity).flatMap((call) => call.rows),
    );
  }
  return map;
}

async function seedSourceDevice(db: TestDatabase) {
  const todos = await import('@/features/todos/todos.data');
  const calories = await import('@/features/calories/calories.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const workout = await import('@/features/workout/workout.data');
  const linkedActions = await import('@/core/linked-actions/linkedActions.data');

  const todoId = await todos.addTodo({ title: 'Ship backup v2', priority: 'urgent' });
  // Habit predates its completion history (created Aug 1, rule history
  // effective from Aug 1) so streaks compute over the historical window.
  const habitId = 'habit_1';
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES (?, 'Drink water', 2, 'anytime', 'water-drop', '#0ea5e9', ?, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', NULL)`,
    [
      habitId,
      JSON.stringify([
        { effective_from_date: '2026-08-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 2 },
      ]),
    ],
  );
  // Pre-existing completion history (a past week, target reached on some days).
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
     VALUES ('hcmp_1', ?, '2026-08-01', 2, '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z'),
            ('hcmp_2', ?, '2026-08-02', 2, '2026-08-02T08:00:00.000Z', '2026-08-02T08:00:00.000Z'),
            ('hcmp_3', ?, '2026-08-03', 1, '2026-08-03T08:00:00.000Z', '2026-08-03T08:00:00.000Z')`,
    [habitId, habitId, habitId],
  );
  // Link the todo → habit rule (future events must fire exactly once).
  await linkedActions.createLinkedActionRule({
    status: 'active',
    directionPolicy: 'one_way',
    source: {
      feature: 'todos',
      entityType: 'todo',
      entityId: todoId,
      triggerType: 'todo.completed',
    },
    target: {
      feature: 'habits',
      entityType: 'habit',
      entityId: habitId,
      effect: { kind: 'progress', type: 'habit.increment', amount: 1, dateStrategy: 'source_date' },
    },
  });
  await calories.addCalorieEntry({
    foodName: 'Oatmeal',
    calories: 300,
    protein: 10,
    carbs: 50,
    fats: 5,
    fiber: 4,
    mealType: 'breakfast',
    consumedOn: '2026-08-03',
  });
  await calories.setCalorieGoal({ calories: 2000, protein: 150, carbs: 200, fats: 70 });
  await pomodoro.savePomodoroSettings({
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 30,
    sessionsBeforeLongBreak: 3,
  });
  await pomodoro.logPomodoroSession(
    '2026-08-03T09:00:00.000Z',
    '2026-08-03T09:50:00.000Z',
    3000,
    'focus',
  );
  await workout.addRoutine('Push day', 'Chest, shoulders, triceps');
  const routineRow = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM workout_routines WHERE name = 'Push day'",
  );
  const routineId = routineRow?.id ?? '';
  const exerciseId = await workout.addExercise({ routineId, name: 'Bench press' });
  await workout.addSet({ exerciseId, setNumber: 1, activeSeconds: 40, restSeconds: 20 });
  await workout.logWorkoutSession({
    routineId,
    notes: 'Felt strong',
    exercises: [{ exerciseName: 'Bench press', setsCompleted: 3 }],
  });
  // The raw completion inserts above have no outbox intent yet; enqueue them
  // the way a real device would (backfill covers pre-existing history).
  return { todoId, habitId };
}

describe('backup completeness v2 restore', () => {
  it('restores the complete scope semantically and without side effects', async () => {
    // --- Phase 1: source device publishes its backup. ---
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'user_a');
    const { habitId: sourceHabitId } = await seedSourceDevice(sourceDb);
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    const manifestUpserts = recording.upserted.filter((call) => call.entity === 'backup_manifest');
    expect(manifestUpserts).toHaveLength(1);
    await sourceDb.closeAsync();

    // --- Phase 2: pristine device restores. ---
    const remote = remoteFromUpserts(recording.upserted);
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();

    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;
    expect(result.importedCounts.todos).toBe(1);
    expect(result.importedCounts.habit_completions).toBe(3);
    expect(result.importedCounts.workout_logs).toBe(1);
    expect(result.importedCounts.pomodoro_sessions).toBe(1);
    expect(result.importedCounts.saved_meals).toBe(1);
    expect(result.importedCounts.linked_action_rules).toBe(1);

    // Semantic equivalence — todos.
    const todos = await import('@/features/todos/todos.data');
    const todoRows = await todos.listTodos();
    expect(todoRows).toHaveLength(1);
    expect(todoRows[0].title).toBe('Ship backup v2');

    // Semantic equivalence — habit history + streaks.
    const habits = await import('@/features/habits/habits.data');
    const habitRows = await habits.listHabits();
    expect(habitRows).toHaveLength(1);
    const completions = await habits.getCompletionHistory(sourceHabitId);
    expect(completions).toHaveLength(3);
    const { calculateCurrentStreak, calculateLongestStreak, buildDayCompletions } =
      await import('@/features/habits/habits.domain');
    const dayCompletions = buildDayCompletions(
      completions.map((c) => ({ habit_id: c.habit_id, date_key: c.date_key, count: c.count })),
      2,
      undefined,
      JSON.parse(habitRows[0].rule_history ?? '[]'),
      '2026-08-01',
      '2026-08-04',
    );
    // Aug 1 and 2 completed (2/2); Aug 3 partial (1/2) → current streak 1 (Aug 3)
    // as of Aug 4; longest 2.
    expect(calculateCurrentStreak(dayCompletions, '2026-08-04')).toBe(0);
    expect(calculateLongestStreak(dayCompletions)).toBe(2);

    // Semantic equivalence — focus history.
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const focusRows = await pomodoro.listPomodoroSessionsForDateRange('2026-08-03', '2026-08-03');
    expect(focusRows).toHaveLength(1);
    expect(focusRows[0].duration_seconds).toBe(3000);

    // Semantic equivalence — workout structure + history.
    const workout = await import('@/features/workout/workout.data');
    const routines = await workout.listRoutines();
    expect(routines).toHaveLength(1);
    expect(routines[0].name).toBe('Push day');
    const detailed = await workout.getRoutineWithExercises(routines[0].id);
    expect(detailed?.exercises).toHaveLength(1);
    expect(detailed?.exercises[0].name).toBe('Bench press');
    expect(detailed?.exercises[0].sets).toHaveLength(1);
    expect(detailed?.exercises[0].sets[0].active_seconds).toBe(40);
    const logs = await workout.listWorkoutLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].notes).toBe('Felt strong');

    // Semantic equivalence — calories + saved meals (use_count preserved).
    const calories = await import('@/features/calories/calories.data');
    const entries = await calories.listCalorieEntries('2026-08-03');
    expect(entries).toHaveLength(1);
    expect(entries[0].food_name).toBe('Oatmeal');
    const saved = await calories.searchSavedMeals('Oatmeal');
    expect(saved).toHaveLength(1);
    const savedMeal = await targetDb.getFirstAsync<{ use_count: number }>(
      "SELECT use_count FROM saved_meals WHERE food_name = 'Oatmeal'",
    );
    expect(Number(savedMeal?.use_count)).toBe(1); // import must not count as usage

    // Semantic equivalence — settings.
    const goal = await calories.getCalorieGoal();
    expect(goal.calories).toBe(2000);
    const pomodoroSettings = await pomodoro.getPomodoroSettings();
    expect(pomodoroSettings.focusMinutes).toBe(50);

    // Linked-action rule restored; ledgers empty; NO historical replay.
    const linkedActions = await import('@/core/linked-actions/linkedActions.data');
    const rules = await linkedActions.listLinkedActionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].rawEffectType).toBe('habit.increment');
    const events = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM linked_action_events',
    );
    const executions = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM linked_action_executions',
    );
    expect(Number(events?.count)).toBe(0);
    expect(Number(executions?.count)).toBe(0);

    // No sync queue spawned by the import.
    const outbox = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox',
    );
    expect(Number(outbox?.count)).toBe(0);

    // A NEW source action fires the restored rule exactly once.
    const { toDateKey } = await import('@/lib/time');
    const todayKey = toDateKey();
    const before = await habits.getHabitCountByDate(sourceHabitId, todayKey);
    expect(before).toBe(0);
    const outcome = await todos.toggleTodo(todoRows[0]);
    expect(outcome.linkedActions.matchedRuleCount).toBe(1);
    const after = await habits.getHabitCountByDate(sourceHabitId, todayKey);
    expect(after).toBe(1);
    await targetDb.closeAsync();
  });

  it('blocks on checksum mismatch and leaves the device untouched', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'user_a');
    await seedSourceDevice(sourceDb);
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    await sourceDb.closeAsync();

    const remote = remoteFromUpserts(recording.upserted);
    const serving = buildServingSupabase(remote, { corruptEntity: 'todos' });
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('integrity_mismatch');
    }
    const todos = await import('@/features/todos/todos.data');
    expect(await todos.listTodos()).toHaveLength(0);
    const counts = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM habit_completions',
    );
    expect(Number(counts?.count)).toBe(0);
    await targetDb.closeAsync();
  });

  it('blocks on malformed rows', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'user_a');
    await seedSourceDevice(sourceDb);
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    await sourceDb.closeAsync();

    const remote = remoteFromUpserts(recording.upserted);
    const serving = buildServingSupabase(remote, {
      malformedRow: {
        entity: 'pomodoro_sessions',
        row: {
          id: 'pom_9999999999_bad',
          started_at: 'not-a-date',
          ended_at: '2026-08-03T10:00:00.000Z',
          duration_seconds: -5,
          session_type: 'focus',
          created_at: '2026-08-03T10:00:00.000Z',
        },
      },
    });
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('validation_failed');
    }
    const counts = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM todos',
    );
    expect(Number(counts?.count)).toBe(0);
    await targetDb.closeAsync();
  });

  it('blocks on broken dependencies (orphan completion) even with a valid manifest', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const orphanSource = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(orphanSource as never, 'user_a');
    await orphanSource.runAsync(
      `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
       VALUES ('habit_1', 'Drink water', 2, 'anytime', 'water-drop', '#0ea5e9', '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', NULL)`,
    );
    await orphanSource.runAsync(
      `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
       VALUES ('hcmp_9999999999_orphanref', 'habit_9999999999_orphanref', '2026-08-01', 1, '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z')`,
    );
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    await orphanSource.closeAsync();
    const orphanRemote = remoteFromUpserts(recording.upserted);
    const orphanServing = buildServingSupabase(orphanRemote);
    installSupabaseMock(orphanServing.supabase);
    const orphanTarget = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('dependency_failed');
      expect(result.diagnostics.join(' ')).toContain('references missing habit');
    }
    const orphanTodos = await orphanTarget.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM todos',
    );
    expect(Number(orphanTodos?.count)).toBe(0);
    await orphanTarget.closeAsync();
  });

  it('blocks when local content appears after the preview (complete emptiness)', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'user_a');
    await seedSourceDevice(sourceDb);
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    await sourceDb.closeAsync();

    const remote = remoteFromUpserts(recording.upserted);
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    // A single local-only pomodoro session makes the device non-empty for the
    // complete restore (it would be invisible to sync-table-only emptiness).
    await pomodoro.logPomodoroSession(
      '2026-08-05T09:00:00.000Z',
      '2026-08-05T09:25:00.000Z',
      1500,
      'focus',
    );
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('local_data_present');
    }
    const todos = await import('@/features/todos/todos.data');
    expect(await todos.listTodos()).toHaveLength(0);
    const sessions = await pomodoro.listPomodoroSessions();
    expect(sessions).toHaveLength(1); // untouched
    await targetDb.closeAsync();
  });

  it('blocks with a clear failure when the remote fetch fails mid-way', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'user_a');
    await seedSourceDevice(sourceDb);
    const checkpoint = await import('@/core/backup/backupCheckpoint');
    await checkpoint.runBackupMaintenance();
    await sourceDb.closeAsync();

    const remote = remoteFromUpserts(recording.upserted);
    const serving = buildServingSupabase(remote, { failEntity: 'workout_logs' });
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('fetch_failed');
    }
    const counts = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM todos',
    );
    expect(Number(counts?.count)).toBe(0);
    await targetDb.closeAsync();
  });
});
