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
 * Closure contract coverage: settings are fetched and verified BEFORE any
 * local write (every `{ data, error }` outcome is a restore failure that
 * leaves the device untouched), settings integrity is checksum-bound to the
 * manifest, NO network call can occur inside the import transaction (a
 * transaction-open guard in the Supabase stub would throw), and theme
 * (AsyncStorage) recovery is durable with restart retry.
 */

/** Controllable AsyncStorage double shared by every test in this file. */
const asyncStorageMock = vi.hoisted(() => {
  const state = new Map<string, string>();
  const failWrites = { value: false };
  return {
    state,
    failWrites,
    impl: {
      getItem: async (key: string) => state.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        if (failWrites.value) throw new Error('simulated AsyncStorage write failure');
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

/**
 * Injectable failure point INSIDE the restore import transaction: when set,
 * the first `setAppMetaText` write for this key throws after the entity
 * appliers have run (used to prove the weekly-reviews import rolls back).
 */
const appMetaWriteFailure = vi.hoisted(() => ({ failForKey: null as string | null }));

vi.mock('@/core/db/appMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/db/appMeta')>();
  return {
    ...actual,
    setAppMetaText: async (
      ...args: Parameters<typeof actual.setAppMetaText>
    ): Promise<ReturnType<typeof actual.setAppMetaText>> => {
      const key = (args[1] as { key?: string } | undefined)?.key ?? null;
      if (appMetaWriteFailure.failForKey !== null && key === appMetaWriteFailure.failForKey) {
        throw new Error('simulated app_meta write failure');
      }
      return actual.setAppMetaText(...args);
    },
  };
});

/** True while any withSQLiteTransaction callback is executing. */
const transactionOpen = vi.hoisted(() => ({ value: false }));

vi.mock('@/core/db/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/db/transactions')>();
  return {
    ...actual,
    withSQLiteTransaction: async (
      db: Parameters<typeof actual.withSQLiteTransaction>[0],
      task: Parameters<typeof actual.withSQLiteTransaction>[1],
    ) => {
      transactionOpen.value = true;
      try {
        return await actual.withSQLiteTransaction(db, task);
      } finally {
        transactionOpen.value = false;
      }
    },
  };
});

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };

function buildRecordingSupabase() {
  const upserted: UpsertCall[] = [];
  const from = vi.fn((entity: string) => {
    if (transactionOpen.value) {
      throw new Error('network call issued inside an open SQLite transaction');
    }
    return {
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
    };
  });
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
    failSettingsFetch?: boolean;
  } = {},
) {
  const from = vi.fn((entity: string) => {
    if (transactionOpen.value) {
      throw new Error('network call issued inside an open SQLite transaction');
    }
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
            if (entity === 'user_backup_settings' && options.failSettingsFetch) {
              // The exact `{ data: null, error: {...} }` shape the closure bug
              // depended on: a real PostgREST failure, not a missing row.
              return Promise.resolve({
                data: null,
                error: { message: 'simulated settings fetch failure' },
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

function installSupabaseMock(
  supabase: { from: ReturnType<typeof vi.fn> },
  overrides: { remoteEnabled?: boolean; authUserId?: string } = {},
) {
  const remoteEnabled = overrides.remoteEnabled ?? true;
  const authUserId = overrides.authUserId ?? 'user_a';
  vi.doMock('@/lib/supabase', () => ({
    supabase,
    isRemoteEnabled: vi.fn(() => remoteEnabled),
    getSupabaseAuthUserId: vi.fn().mockResolvedValue(authUserId),
    getSupabaseSessionUserId: vi.fn().mockResolvedValue(authUserId),
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
  'workout_session_sets',
  'pomodoro_sessions',
  'linked_action_rules',
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
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

/**
 * Phase 1 helper: build a real source device, publish its backup to the
 * recording stub, and return the captured remote material.
 */
async function publishSourceBackup(): Promise<Map<string, Record<string, unknown>[]>> {
  const recording = buildRecordingSupabase();
  installSupabaseMock(recording.supabase);
  const sourceDb = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(sourceDb as never, 'user_a');
  await seedSourceDevice(sourceDb);
  const checkpoint = await import('@/core/backup/backupCheckpoint');
  await checkpoint.runBackupMaintenance();
  await sourceDb.closeAsync();
  return remoteFromUpserts(recording.upserted);
}

/** Every user table must be untouched after a blocked restore. */
async function expectZeroImportedRows(db: TestDatabase): Promise<void> {
  for (const table of [
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
    'workout_session_sets',
    'pomodoro_sessions',
    'linked_action_rules',
    'weekly_reviews',
    'projects',
    'goals',
    'daily_plans',
    'custom_exercises',
    'workout_weekly_plan',
    'workout_schedule_overrides',
    'body_weight_entries',
  ]) {
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
    expect(Number(row?.count), table).toBe(0);
  }
  const goal = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'calorie_goal'",
  );
  expect(goal?.value ?? null).toBeNull();
}

describe('backup completeness v2 restore — settings integrity (closure)', () => {
  it('blocks on a settings fetch error ({data: null, error: {...}}) and leaves the device untouched', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote, { failSettingsFetch: true });
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('fetch_failed');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('blocks when the settings row is missing despite the manifest', async () => {
    const remote = await publishSourceBackup();
    remote.delete('user_backup_settings');
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('incomplete_manifest');
      expect(result.diagnostics.join(' ')).toContain('user_backup_settings');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('blocks on a malformed settings payload', async () => {
    const remote = await publishSourceBackup();
    const settingsRow = remote.get('user_backup_settings')?.[0];
    if (settingsRow) settingsRow.payload = { calorieGoal: 'not-an-object' };
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('validation_failed');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  });

  it('blocks on a settings checksum mismatch', async () => {
    const remote = await publishSourceBackup();
    const settingsRow = remote.get('user_backup_settings')?.[0];
    if (settingsRow) {
      const payload = settingsRow.payload as {
        calorieGoal: { calories: number };
      };
      settingsRow.payload = {
        ...payload,
        calorieGoal: { ...payload.calorieGoal, calories: payload.calorieGoal.calories + 100 },
      };
    }
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('integrity_mismatch');
      expect(result.diagnostics.join(' ')).toContain('settings');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  });

  it('blocks on an unsupported settings version', async () => {
    const remote = await publishSourceBackup();
    const settingsRow = remote.get('user_backup_settings')?.[0];
    if (settingsRow) settingsRow.settings_version = 99;
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('unsupported_version');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  });

  it('blocks a v2 manifest that does not certify settings integrity', async () => {
    const remote = await publishSourceBackup();
    const manifestRow = remote.get('backup_manifest')?.[0];
    if (manifestRow) delete manifestRow.settings_metadata;
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('incomplete_manifest');
      expect(result.diagnostics.join(' ')).toContain('settings integrity');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  });

  it('never issues a network call inside the import transaction (guarded full restore)', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    // The serving stub throws if `supabase.from` is reached while a
    // withSQLiteTransaction callback is open; reaching 'restored' proves the
    // transaction performed zero network calls.
    expect(result.status).toBe('restored');
    await targetDb.closeAsync();
  });

  it('reports BACKUP INVALID when the remote manifest lacks settings integrity metadata', async () => {
    const remote = await publishSourceBackup();
    const manifestRow = remote.get('backup_manifest')?.[0];
    if (manifestRow) delete manifestRow.settings_metadata;
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { getBackupStateSummary } = await import('@/core/backup/backupRestore');
    const summary = await getBackupStateSummary('user_a');
    expect(summary.state).toBe('invalid');
    expect(summary.lastCompleteAt).toBeNull();
    await targetDb.closeAsync();
  });

  it('reports V2 COMPLETE with the certified settings integrity for a valid manifest', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { getBackupStateSummary } = await import('@/core/backup/backupRestore');
    const summary = await getBackupStateSummary('user_a');
    expect(summary.state).toBe('v2_complete');
    expect(summary.lastCompleteGeneration).toBe(1);
    expect(summary.lastCompleteAt).not.toBeNull();
    await targetDb.closeAsync();
  });

  it('recognizes a known historical scope-3 backup (pre-planning) as complete V2, not invalid', async () => {
    const remote = await publishSourceBackup();
    const manifestRows = remote.get('backup_manifest');
    const manifestRow = manifestRows?.[0];
    expect(manifestRow).toBeDefined();
    // Simulate a backup produced before Projects/Goals/Daily Plans entered the
    // recoverable scope (and before the V5 per-set workout entity): drop the
    // post-V3 entities and the explicit scope flag so resolution must fall
    // back to the known historical scope-3 entity set.
    if (manifestRow) {
      delete manifestRow.backup_scope_version;
      const metadata = (manifestRow as Record<string, Record<string, unknown>>).entity_metadata;
      for (const dropped of [
        'projects',
        'goals',
        'daily_plans',
        'workout_session_sets',
        'custom_exercises',
        'workout_weekly_plan',
        'workout_schedule_overrides',
        'body_weight_entries',
      ]) {
        delete metadata[dropped];
      }
    }
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { getBackupStateSummary } = await import('@/core/backup/backupRestore');
    const summary = await getBackupStateSummary('user_a');
    expect(summary.state).toBe('v2_complete');
    expect(summary.missingEntities).toEqual(
      expect.arrayContaining(['projects', 'goals', 'daily_plans', 'workout_session_sets']),
    );
    await targetDb.closeAsync();
  });

  it('keeps a durable pending theme marker when AsyncStorage fails after commit, and retries on restart', async () => {
    const recording = buildRecordingSupabase();
    installSupabaseMock(recording.supabase);
    asyncStorageMock.state.set('superhabits.theme.mode', 'dark');
    asyncStorageMock.state.set(
      'superhabits.theme.slots.v2',
      JSON.stringify({ lightThemeId: 'ocean' }),
    );
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

    // Domain import commits, but the AsyncStorage theme application fails.
    asyncStorageMock.failWrites.value = true;
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('restored');

    // The durable marker survives and records the staged theme.
    const marker = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_theme_apply'",
    );
    expect(marker).not.toBeNull();
    expect(JSON.parse(marker?.value ?? '{}')).toMatchObject({ mode: 'dark' });

    // Restart: the bootstrap retry applies the theme and clears the marker
    // only on success.
    asyncStorageMock.failWrites.value = false;
    const { applyPendingThemeApplication } = await import('@/core/backup/backupSettings');
    expect(await applyPendingThemeApplication()).toBe(true);
    const after = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.pending_theme_apply'",
    );
    expect(after?.value).toBe('null');
    expect(asyncStorageMock.state.get('superhabits.theme.mode')).toBe('dark');
    await targetDb.closeAsync();
  });
});

async function seedSourceDevice(db: TestDatabase) {
  const todos = await import('@/features/todos/todos.data');
  const calories = await import('@/features/calories/calories.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const workout = await import('@/features/workout/workout.data');
  const linkedActions = await import('@/core/linked-actions/linkedActions.data');
  const projects = await import('@/features/projects/projects.data');
  const goals = await import('@/features/goals/goals.data');
  const dailyPlan = await import('@/features/daily-plan/dailyPlan.data');
  const weeklyReview = await import('@/features/weekly-review/weeklyReview.data');

  // Planning scope: project → goal → linked todo → daily plan referencing it.
  const projectId = await projects.addProject({
    name: 'Launch plan',
    description: 'Hardening wave',
    status: 'active',
  });
  const goalId = await goals.addGoal({ projectId, title: 'Ship wave v2' });
  const todoId = await todos.addTodo({
    title: 'Ship backup v2',
    priority: 'urgent',
    projectId,
    goalId,
  });
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
  const exerciseId = await workout.addExercise({
    routineId,
    name: 'Bench press',
    catalogExerciseId: 'builtin_barbell_bench_press',
    modality: 'weighted_strength',
    unilateral: true,
    supportsExternalLoad: true,
  });
  await workout.addSet({ exerciseId, setNumber: 1, activeSeconds: 40, restSeconds: 20 });
  await workout.logWorkoutSession({
    routineId,
    notes: 'Felt strong',
    exercises: [
      {
        exerciseName: 'Bench press',
        setsCompleted: 3,
        catalogExerciseId: 'builtin_barbell_bench_press',
        modality: 'weighted_strength',
        unilateral: true,
        supportsExternalLoad: true,
      },
    ],
  });
  // Per-set session data (scope V5): attach recorded sets to the logged
  // session's exercise.
  const sessionExerciseRow = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM workout_session_exercises ORDER BY id ASC LIMIT 1',
  );
  await db.runAsync(
    `INSERT INTO workout_session_sets (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
     VALUES ('wset_1', ?, 1, 60, 8, 'kg', 1, '2026-08-03T10:00:00.000Z'),
            ('wset_2', ?, 2, 62.5, 6, 'kg', 1, '2026-08-03T10:05:00.000Z')`,
    [sessionExerciseRow?.id ?? '', sessionExerciseRow?.id ?? ''],
  );
  await dailyPlan.upsertDailyPlan('2026-08-03', {
    intention: 'Deep work',
    topTodoIds: [todoId],
  });
  await weeklyReview.saveWeeklyReview({
    weekKey: '2026-W31',
    weekStartDate: '2026-07-27',
    weekEndDate: '2026-08-02',
    nextWeekStartDate: '2026-08-03',
    summaryPayload: '{"highlights":["shipped"]}',
    planPayload: '{"focus":"stability"}',
    reflection: 'Solid week',
  });
  await workout.createCustomExercise({
    name: 'Cable Y raise',
    aliases: ['cable y'],
    instructions: 'Pull toward the shoulders.',
    primaryArea: 'shoulders',
    secondaryAreas: [],
    equipment: 'cable',
    modality: 'weighted_strength',
    unilateral: false,
    supportsExternalLoad: true,
  });
  await workout.upsertWeeklyPlanEntry({ weekday: 1, routineId, planKind: 'workout' });
  await workout.addBodyWeightEntry({
    weight: 80,
    unit: 'kg',
    measuredAt: '2026-08-03T08:00:00.000Z',
    note: 'Morning check-in',
  });
  // The raw completion inserts above have no outbox intent yet; enqueue them
  // the way a real device would (backfill covers pre-existing history).
  return { todoId, habitId, projectId, goalId };
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
    expect(detailed?.exercises[0].catalog_exercise_id).toBe('builtin_barbell_bench_press');
    expect(detailed?.exercises[0].unilateral).toBe(1);
    expect(detailed?.exercises[0].supports_external_load).toBe(1);
    expect(detailed?.exercises[0].sets).toHaveLength(1);
    expect(detailed?.exercises[0].sets[0].active_seconds).toBe(40);
    const logs = await workout.listWorkoutLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].notes).toBe('Felt strong');
    const restoredSessionExercise = await targetDb.getFirstAsync<{
      catalog_exercise_id: string | null;
      unilateral: number;
      supports_external_load: number;
    }>(
      "SELECT catalog_exercise_id, unilateral, supports_external_load FROM workout_session_exercises WHERE exercise_name = 'Bench press'",
    );
    expect(restoredSessionExercise).toEqual({
      catalog_exercise_id: 'builtin_barbell_bench_press',
      unilateral: 1,
      supports_external_load: 1,
    });
    expect((await workout.listCustomExercises())[0]).toMatchObject({
      name: 'Cable Y raise',
      aliases: JSON.stringify(['cable y']),
      instructions: 'Pull toward the shoulders.',
      supports_external_load: 1,
    });
    expect((await workout.listWeeklyPlan())[0].routine_id).toBe(routines[0].id);
    expect((await workout.listBodyWeightEntries())[0]).toMatchObject({ weight: 80, unit: 'kg' });

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

  it('imports the full scope-5 planning scope with truthful counts and resolvable references', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('restored');
    if (result.status !== 'restored') return;

    // importedCounts are truthful for every planning-scope entity.
    expect(result.importedCounts.projects).toBe(1);
    expect(result.importedCounts.goals).toBe(1);
    expect(result.importedCounts.daily_plans).toBe(1);
    expect(result.importedCounts.weekly_reviews).toBe(1);
    expect(result.importedCounts.workout_session_sets).toBe(2);

    // The restored todo's project_id resolves to the IMPORTED project row.
    const todoRow = await targetDb.getFirstAsync<{
      project_id: string | null;
      goal_id: string | null;
    }>('SELECT project_id, goal_id FROM todos WHERE title = ? AND deleted_at IS NULL', [
      'Ship backup v2',
    ]);
    expect(todoRow?.project_id).toBeTruthy();
    const projectRow = await targetDb.getFirstAsync<{ name: string; deleted_at: string | null }>(
      'SELECT name, deleted_at FROM projects WHERE id = ?',
      [todoRow?.project_id ?? ''],
    );
    expect(projectRow?.name).toBe('Launch plan');
    expect(projectRow?.deleted_at).toBeNull();

    // The goal resolves too, and its project_id points at the same project.
    const goalRow = await targetDb.getFirstAsync<{ title: string; project_id: string | null }>(
      'SELECT title, project_id FROM goals WHERE id = ?',
      [todoRow?.goal_id ?? ''],
    );
    expect(goalRow?.title).toBe('Ship wave v2');
    expect(goalRow?.project_id).toBe(todoRow?.project_id);

    // Daily plan top_todo_ids resolve to restored, live todos.
    const planRow = await targetDb.getFirstAsync<{ top_todo_ids: string }>(
      'SELECT top_todo_ids FROM daily_plans',
    );
    const topIds = JSON.parse(planRow?.top_todo_ids ?? '[]') as string[];
    expect(topIds).toHaveLength(1);
    const topTodo = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM todos WHERE id = ? AND deleted_at IS NULL',
      [topIds[0]],
    );
    expect(Number(topTodo?.count)).toBe(1);

    // Weekly review content is restored verbatim.
    const reviewRow = await targetDb.getFirstAsync<{ reflection: string; week_key: string }>(
      'SELECT reflection, week_key FROM weekly_reviews',
    );
    expect(reviewRow?.week_key).toBe('2026-W31');
    expect(reviewRow?.reflection).toBe('Solid week');

    // Per-set session data landed under its session exercise.
    const setRows = await targetDb.getAllAsync<{ id: string; session_exercise_id: string }>(
      'SELECT id, session_exercise_id FROM workout_session_sets ORDER BY set_number ASC',
    );
    expect(setRows).toHaveLength(2);
    const parentExercise = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM workout_session_exercises WHERE id = ?',
      [setRows[0]?.session_exercise_id ?? ''],
    );
    expect(Number(parentExercise?.count)).toBe(1);
    await targetDb.closeAsync();
  });

  it('rolls back weekly_reviews (and everything else) when a post-import write fails', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();

    // Fail INSIDE the import transaction AFTER the entity appliers (including
    // weekly_reviews) have run: the last_restore_signature app_meta write sits
    // behind them. The whole transaction must roll back.
    appMetaWriteFailure.failForKey = 'last_restore_signature';
    try {
      const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
      await expect(restoreFromRemoteBackupV2()).rejects.toThrow('simulated app_meta write failure');
    } finally {
      appMetaWriteFailure.failForKey = null;
    }

    // Zero weekly_reviews rows persisted: the import never leaked out of the
    // transaction, so a retry is not blocked by a half-restored device.
    const reviewCount = await targetDb.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM weekly_reviews',
    );
    expect(Number(reviewCount?.count)).toBe(0);
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  });
});

describe('backup completeness v2 restore — fault-injection matrix', () => {
  it('rejects a structurally corrupt manifest as manifest_malformed and leaves the device untouched', async () => {
    const remote = await publishSourceBackup();
    const manifestRow = remote.get('backup_manifest')?.[0];
    expect(manifestRow).toBeDefined();
    if (manifestRow) manifestRow.generation = null;
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('manifest_malformed');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('rejects a future backup schema version as unsupported_version', async () => {
    const remote = await publishSourceBackup();
    const manifestRow = remote.get('backup_manifest')?.[0];
    if (manifestRow) manifestRow.backup_schema_version = 99;
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('unsupported_version');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('rejects an unrecognized entity scope instead of inferring one permissively', async () => {
    const remote = await publishSourceBackup();
    const manifestRow = remote.get('backup_manifest')?.[0];
    if (manifestRow) {
      delete (manifestRow as { backup_scope_version?: number }).backup_scope_version;
      // Dropping todos breaks every known historical entity set, so no exact
      // scope match is possible — restore must fail closed, never guess.
      const metadata = manifestRow.entity_metadata as Record<string, unknown>;
      delete metadata.todos;
    }
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('unsupported_version');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('blocks duplicate row ids served through the cloud V2 pipeline before any write', async () => {
    const remote = await publishSourceBackup();
    const todoRows = remote.get('todos');
    expect(todoRows?.length ?? 0).toBeGreaterThan(0);
    // Same id twice: the served set no longer matches the manifest's
    // certified per-entity checksum, so integrity verification must refuse
    // before any validation or write. (The duplicate-id validator rule
    // itself is separately unit-covered in tests/portableFormat.test.ts for
    // payloads whose checksums were recomputed over duplicates.)
    remote.set('todos', [...(todoRows ?? []), { ...(todoRows?.[0] as Record<string, unknown>) }]);
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase);
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('invalid');
    if (result.status === 'invalid') {
      expect(result.reason).toBe('integrity_mismatch');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);

  it('blocks with owner_mismatch when the verified account differs from the local dataset binding', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    // Remote data belongs to user_a; the TARGET device is durably bound to a
    // different account. Restore must refuse without mutating anything.
    installSupabaseMock(serving.supabase, { authUserId: 'user_a' });
    const targetDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(targetDb as never, 'user_b');
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('owner_mismatch');
    }
    await expectZeroImportedRows(targetDb);
    const binding = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'account.owner_user_id'",
    );
    expect(binding?.value).toBe('user_b');
    await targetDb.closeAsync();
  }, 20_000);

  it('reports remote_disabled without touching the device when remote mode is off', async () => {
    const remote = await publishSourceBackup();
    const serving = buildServingSupabase(remote);
    installSupabaseMock(serving.supabase, { remoteEnabled: false });
    const targetDb = await freshDatabase();
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const result = await restoreFromRemoteBackupV2();
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.reason).toBe('remote_disabled');
    }
    await expectZeroImportedRows(targetDb);
    await targetDb.closeAsync();
  }, 20_000);
});
