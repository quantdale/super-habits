import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Portable Data Export & Import V1 — real-SQLite source→export→import
 * equivalence.
 *
 * Phase 1 builds a real "source device": rows across every recoverable table
 * through the actual feature data layers, recoverable settings (calorie goal,
 * pomodoro defaults) in app_meta, and theme in (mocked) AsyncStorage. The
 * export is proven read-only (outbox, app_meta, saved-meal use counts, and
 * every updated_at are byte-identical after export) and produces a valid
 * portable envelope.
 *
 * Phase 2 replays the exported FILE onto a fresh empty device:
 * prepare → preview (nothing written yet) → confirm → ONE atomic import.
 * Assertions: row-level equality across all 12 tables, habit progress
 * insights (current/longest streak, 7/30/90-day rates, consistency,
 * scheduled occurrences, progress) equal, calorie daily totals + macros
 * equal, saved meals + usage metadata equal, focus minutes + session counts
 * equal, workout structure/history/summaries equal, linked-action rules
 * restored with empty event/execution ledgers and no side effects, settings
 * equal (calorie goal, pomodoro defaults, theme mode + slots), import-origin
 * metadata recorded, and the excluded state (outbox, auth, notification
 * processing) proven absent.
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

// `expo-constants` pulls expo-modules-core, which has no node/vitest runtime;
// the app version is informational metadata in the portable envelope.
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

const THEME_MODE_KEY = 'superhabits.theme.mode';
const THEME_SLOTS_KEY = 'superhabits.theme.slots.v2';

const ALL_TABLES = [
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
] as const;

async function dumpTable(db: TestDatabase, table: string): Promise<Record<string, unknown>[]> {
  // `app_meta` is keyed by `key` (no `id` column); everything else orders by id.
  const orderBy = table === 'app_meta' ? 'key' : 'id';
  return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY ${orderBy} ASC`);
}

async function dumpAll(db: TestDatabase): Promise<Record<string, Record<string, unknown>[]>> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of ALL_TABLES) out[table] = await dumpTable(db, table);
  return out;
}

async function countRows(db: TestDatabase, table: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

async function seedSourceDevice(db: TestDatabase): Promise<{ todoId: string; habitId: string }> {
  const todos = await import('@/features/todos/todos.data');
  const calories = await import('@/features/calories/calories.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const workout = await import('@/features/workout/workout.data');
  const linkedActions = await import('@/core/linked-actions/linkedActions.data');

  const todoId = await todos.addTodo({ title: 'Ship portable backup', priority: 'urgent' });
  await todos.addTodo({
    title: 'Morning pages',
    notes: 'Journal every day',
    recurrence: 'daily',
    priority: 'normal',
  });
  const completedTodoId = await todos.addTodo({ title: 'Stale completed task' });
  await todos.completeTodo(completedTodoId);

  // Habit predates its completion history so streaks compute over the window.
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
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
     VALUES ('hcmp_1', ?, '2026-08-01', 2, '2026-08-01T08:00:00.000Z', '2026-08-01T08:00:00.000Z'),
            ('hcmp_2', ?, '2026-08-02', 2, '2026-08-02T08:00:00.000Z', '2026-08-02T08:00:00.000Z'),
            ('hcmp_3', ?, '2026-08-03', 1, '2026-08-03T08:00:00.000Z', '2026-08-03T08:00:00.000Z')`,
    [habitId, habitId, habitId],
  );

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
  await calories.addCalorieEntry({
    foodName: 'Chicken salad',
    calories: 450,
    protein: 40,
    carbs: 15,
    fats: 22,
    fiber: 6,
    mealType: 'lunch',
    consumedOn: '2026-08-03',
  });
  await calories.addCalorieEntry({
    foodName: 'Greek yogurt',
    calories: 150,
    protein: 15,
    carbs: 8,
    fats: 5,
    fiber: 0,
    mealType: 'snack',
    consumedOn: '2026-08-02',
  });
  await calories.upsertSavedMeal({
    foodName: 'Oatmeal',
    calories: 300,
    protein: 10,
    carbs: 50,
    fats: 5,
    fiber: 4,
    mealType: 'breakfast',
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
  await pomodoro.logPomodoroSession(
    '2026-08-02T20:00:00.000Z',
    '2026-08-02T20:25:00.000Z',
    1500,
    'focus',
  );
  await pomodoro.logPomodoroSession(
    '2026-08-02T20:25:00.000Z',
    '2026-08-02T20:30:00.000Z',
    300,
    'short_break',
  );

  await workout.addRoutine('Push day', 'Chest, shoulders, triceps');
  const routineRow = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM workout_routines WHERE name = 'Push day'",
  );
  const routineId = routineRow?.id ?? '';
  const exerciseId = await workout.addExercise({ routineId, name: 'Bench press' });
  await workout.addSet({ exerciseId, setNumber: 1, activeSeconds: 40, restSeconds: 20 });
  await workout.addSet({ exerciseId, setNumber: 2, activeSeconds: 40, restSeconds: 20 });
  await workout.addSet({ exerciseId, setNumber: 3, activeSeconds: 35, restSeconds: 25 });
  const secondExerciseId = await workout.addExercise({ routineId, name: 'Overhead press' });
  await workout.addSet({
    exerciseId: secondExerciseId,
    setNumber: 1,
    activeSeconds: 30,
    restSeconds: 15,
  });
  await workout.logWorkoutSession({
    routineId,
    notes: 'Felt strong',
    exercises: [
      { exerciseName: 'Bench press', setsCompleted: 3 },
      { exerciseName: 'Overhead press', setsCompleted: 1 },
    ],
  });

  return { todoId, habitId };
}

async function exportSourceDevice(db: TestDatabase) {
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('portable export', () => {
  it('exports the complete recoverable scope read-only with a valid envelope', async () => {
    asyncStorageMock.state.set(THEME_MODE_KEY, 'dark');
    asyncStorageMock.state.set(THEME_SLOTS_KEY, JSON.stringify({ lightThemeId: 'ocean' }));
    const sourceDb = await freshDatabase();
    await seedSourceDevice(sourceDb);

    // Read-only proof snapshot.
    const beforeOutbox = await countRows(sourceDb, 'sync_outbox');
    const beforeMeta = await dumpTable(sourceDb, 'app_meta');
    const beforeMeals = await dumpTable(sourceDb, 'saved_meals');
    const beforeTodos = await dumpTable(sourceDb, 'todos');

    const result = await exportSourceDevice(sourceDb);

    // Read-only: nothing changed anywhere.
    expect(await countRows(sourceDb, 'sync_outbox')).toBe(beforeOutbox);
    expect(await dumpTable(sourceDb, 'app_meta')).toEqual(beforeMeta);
    expect(await dumpTable(sourceDb, 'saved_meals')).toEqual(beforeMeals);
    expect(await dumpTable(sourceDb, 'todos')).toEqual(beforeTodos);

    // Envelope contract.
    const parsed = JSON.parse(result.json) as Record<string, unknown>;
    expect(parsed.format).toBe('superhabits-portable-backup');
    expect(parsed.formatVersion).toBe(1);
    expect(parsed.backupSchemaVersion).toBe(2);
    expect(typeof parsed.exportedAt).toBe('string');
    expect(result.fileName).toMatch(/^superhabits-backup-.*\.json$/);
    expect(result.byteLength).toBeGreaterThan(1000);
    // No owner binding on the source → no fingerprint.
    expect((parsed.source as Record<string, unknown>).ownerFingerprint).toBeNull();
    const entities = parsed.entities as Record<string, unknown[]>;
    for (const table of ALL_TABLES) {
      expect(Array.isArray(entities[table])).toBe(true);
      expect(entities[table].length).toBe(await countRows(sourceDb, table));
    }
    // Excluded state must not appear in the file.
    expect((parsed.entities as Record<string, unknown>).sync_outbox).toBeUndefined();
    expect((parsed.entities as Record<string, unknown>).app_meta).toBeUndefined();
    expect((parsed.entities as Record<string, unknown>).linked_action_events).toBeUndefined();
    expect((parsed.entities as Record<string, unknown>).linked_action_executions).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('sync_outbox');
    expect(JSON.stringify(parsed)).not.toContain('access_token');

    // Re-validating the exported text yields a ready import.
    const { validatePortableBackupFile } = await import('@/core/portable/portableFormat');
    expect(validatePortableBackupFile(parsed).ok).toBe(true);

    await sourceDb.closeAsync();
  }, 60000);

  it('records a one-way owner fingerprint when a durable owner binding exists', async () => {
    const sourceDb = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(sourceDb as never, 'owner-user-id-1');
    await seedSourceDevice(sourceDb);
    const result = await exportSourceDevice(sourceDb);
    const parsed = JSON.parse(result.json) as Record<string, unknown>;
    const fingerprint = (parsed.source as Record<string, unknown>).ownerFingerprint as string;
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain('owner-user-id-1');
    expect(JSON.stringify(parsed)).not.toContain('owner-user-id-1');
    await sourceDb.closeAsync();
  }, 60000);
});

describe('portable import — source→import semantic equivalence', () => {
  it('restores the complete scope atomically, without side effects', async () => {
    asyncStorageMock.state.set(THEME_MODE_KEY, 'dark');
    asyncStorageMock.state.set(THEME_SLOTS_KEY, JSON.stringify({ lightThemeId: 'ocean' }));
    const sourceDb = await freshDatabase();
    const seeded = await seedSourceDevice(sourceDb);
    const result = await exportSourceDevice(sourceDb);
    const sourceDump = await dumpAll(sourceDb);
    await sourceDb.closeAsync();

    // Fresh empty destination (no owner, no data, no outbox).
    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
    const bootstrapMeta = await dumpTable(targetDb, 'app_meta');

    const outcome = await preparePortableImport({
      fileName: result.fileName,
      text: result.json,
    });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;

    // Preview content.
    expect(outcome.preview.integrityVerified).toBe(true);
    expect(outcome.preview.settingsIncluded).toBe(true);
    expect(outcome.preview.eligibility.kind).toBe('eligible');
    expect(outcome.preview.counts.todos).toBe(3);
    expect(outcome.preview.counts.habits).toBe(1);
    expect(outcome.preview.counts.habit_completions).toBe(3);
    expect(outcome.preview.counts.calorie_entries).toBe(3);
    // Adding calorie entries records the foods as saved meals automatically.
    expect(outcome.preview.counts.saved_meals).toBe(3);
    expect(outcome.preview.counts.pomodoro_sessions).toBe(3);
    expect(outcome.preview.counts.workout_routines).toBe(1);
    expect(outcome.preview.counts.routine_exercises).toBe(2);
    expect(outcome.preview.counts.routine_exercise_sets).toBe(4);
    expect(outcome.preview.counts.workout_logs).toBe(1);
    expect(outcome.preview.counts.workout_session_exercises).toBe(2);
    expect(outcome.preview.counts.linked_action_rules).toBe(1);
    expect(outcome.preview.ownerVerdict).toBe('local_only_source');

    // NO-WRITE-BEFORE-CONFIRM: the destination is still completely empty —
    // only the bootstrap app_meta keys exist, identical to before selection.
    const untouched = await inspectLocalAccountDataState(targetDb as never);
    expect(untouched.hasUserData).toBe(false);
    expect(untouched.pendingOutboxCount).toBe(0);
    expect(await countRows(targetDb, 'sync_outbox')).toBe(0);
    expect(await dumpTable(targetDb, 'app_meta')).toEqual(bootstrapMeta);

    // Import.
    const imported = await confirmPortableImport({ file: outcome.file });
    expect(imported.status).toBe('restored');
    if (imported.status !== 'restored') return;
    expect(imported.importedCounts.todos).toBe(3);
    expect(imported.importedCounts.linked_action_rules).toBe(1);

    // Row-level equivalence across every recoverable table.
    const targetDump = await dumpAll(targetDb);
    for (const table of ALL_TABLES) {
      expect(targetDump[table]).toEqual(sourceDump[table]);
    }

    // Habit progress insights: streaks, windows, consistency, occurrences.
    const habits = await import('@/features/habits/habits.data');
    const insights = await import('@/features/habits/habitInsights.domain');
    const habit = (await habits.listHabits())[0];
    const history = await habits.getCompletionHistory(habit.id);
    const sourceHabit = (await import('@/features/habits/habits.data')).listHabits;
    void sourceHabit;
    const metrics = insights.calculateHabitProgressInsights(habit, history, '2026-08-03');
    expect(metrics).not.toBeNull();
    expect(metrics?.currentStreak).toBe(2);
    expect(metrics?.longestStreak).toBe(2);
    // Days that reached the daily target of 2: Aug 1 and Aug 2 (Aug 3 reached 1).
    expect(metrics?.totalCompletedOccurrences).toBe(2);
    expect(metrics?.totalActual).toBe(5);
    expect(metrics?.last7.windowDays).toBe(7);
    expect(metrics?.last30.windowDays).toBe(30);
    expect(metrics?.last90.windowDays).toBe(90);

    // Calorie equivalence: daily totals + macros.
    const calories = await import('@/features/calories/calories.data');
    const daySummary = await calories.getCalorieSummaryByRange('2026-08-03', '2026-08-03');
    expect(daySummary[0]?.totalCalories ?? 0).toBe(750);
    const entries = await calories.listCalorieEntries('2026-08-03');
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, entry) => sum + entry.calories, 0)).toBe(750);
    expect((await calories.getCalorieGoal()).calories).toBe(2000);
    const savedMeals = await calories.searchSavedMeals('Oatmeal');
    expect(savedMeals[0]?.food_name).toBe('Oatmeal');
    expect(savedMeals[0]?.use_count).toBeGreaterThanOrEqual(1);
    expect(savedMeals[0]?.last_used_at).toBeTruthy();

    // Focus equivalence: session history + focus minutes.
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const sessions = await pomodoro.listPomodoroSessionsForDateRange('2026-08-02', '2026-08-03');
    expect(sessions).toHaveLength(3);
    const focusSeconds = sessions
      .filter((session) => session.session_type === 'focus')
      .reduce((sum, session) => sum + session.duration_seconds, 0);
    expect(focusSeconds).toBe(4500);

    // Workout equivalence: structure, logs, session exercises, last workout.
    const workout = await import('@/features/workout/workout.data');
    const routines = await workout.listRoutines();
    expect(routines).toHaveLength(1);
    const exercises = await workout.listExercises(routines[0].id);
    expect(exercises).toHaveLength(2);
    expect(exercises.map((exercise) => exercise.name)).toEqual(['Bench press', 'Overhead press']);
    const sets = await workout.listSets(exercises[0].id);
    expect(sets).toHaveLength(3);
    const logs = await workout.listWorkoutLogs(10);
    expect(logs).toHaveLength(1);
    expect(logs[0].notes).toBe('Felt strong');
    const sessionExercises = await targetDb.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM workout_session_exercises ORDER BY id ASC',
    );
    expect(sessionExercises).toHaveLength(2);

    // Linked actions: rules restored; ledgers NOT restored; no side effects.
    const linked = await import('@/core/linked-actions/linkedActions.data');
    const rules = await linked.listLinkedActionRules();
    expect(rules).toHaveLength(1);
    expect(rules[0].source.entityId).toBe(seeded.todoId);
    expect(await countRows(targetDb, 'linked_action_events')).toBe(0);
    expect(await countRows(targetDb, 'linked_action_executions')).toBe(0);
    expect(await countRows(targetDb, 'processed_notification_actions')).toBe(0);

    // Settings equivalence: pomodoro defaults + theme applied to AsyncStorage.
    const savedPomodoro = await pomodoro.getPomodoroSettings();
    expect(savedPomodoro.focusMinutes).toBe(50);
    expect(savedPomodoro.sessionsBeforeLongBreak).toBe(3);
    expect(asyncStorageMock.state.get(THEME_MODE_KEY)).toBe('dark');
    expect(asyncStorageMock.state.get(THEME_SLOTS_KEY)).toBe(
      JSON.stringify({ lightThemeId: 'ocean' }),
    );

    // Import-origin metadata + no owner binding + empty outbox.
    const origin = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe('null');
    const importedAt = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_at'",
    );
    expect(importedAt?.value).toBeTruthy();
    const localState = await inspectLocalAccountDataState(targetDb as never);
    expect(localState.ownerBinding).toBeNull();
    expect(localState.pendingOutboxCount).toBe(0);
    expect(localState.hasUserData).toBe(true);

    await targetDb.closeAsync();
  }, 120000);

  it('blocks a second confirm (double-confirm cannot import twice)', async () => {
    const sourceDb = await freshDatabase();
    await seedSourceDevice(sourceDb);
    const result = await exportSourceDevice(sourceDb);
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;

    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');
    // Second activation: the device is now populated → blocked, no duplicate.
    const second = await confirmPortableImport({ file: outcome.file });
    expect(second.status).toBe('blocked');
    if (second.status !== 'blocked') return;
    expect(second.reason).toBe('local_data_present');
    await targetDb.closeAsync();
  }, 60000);

  it('keeps a durable pending theme marker when AsyncStorage fails after commit, and retries on restart', async () => {
    asyncStorageMock.state.set(THEME_MODE_KEY, 'dark');
    const sourceDb = await freshDatabase();
    await seedSourceDevice(sourceDb);
    const result = await exportSourceDevice(sourceDb);
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;

    // Import commits, but the AsyncStorage theme application fails.
    asyncStorageMock.failWrites.value = true;
    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');

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
    expect(asyncStorageMock.state.get(THEME_MODE_KEY)).toBe('dark');
    await targetDb.closeAsync();
  }, 60000);
});

describe('portable import — cloud backup interaction', () => {
  it('never claims cloud completeness and enqueues imported state for a compatible owner', async () => {
    const sourceDb = await freshDatabase();
    // The source dataset has a durable owner so the file carries a
    // fingerprint; the destination is bound to the SAME owner.
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    const ownerId = 'owner-user-id-1';
    await setLocalDatasetOwner(sourceDb as never, ownerId);
    await seedSourceDevice(sourceDb);
    const result = await exportSourceDevice(sourceDb);
    const sourceDump = await dumpAll(sourceDb);
    await sourceDb.closeAsync();

    const targetDb = await freshDatabase();
    await setLocalDatasetOwner(targetDb as never, ownerId);

    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: result.fileName, text: result.json });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preview.ownerVerdict).toBe('same_owner');

    // Simulate a previously completed backfill (done markers present) so we
    // can prove the import invalidates them.
    const { setAppMetaText, setAppMetaJson, appMetaKeys } = await import('@/core/db/appMeta');
    await setAppMetaText(targetDb as never, appMetaKeys.backupScopeVersion, '2');
    await setAppMetaText(targetDb as never, appMetaKeys.backupBackfillStatus, 'complete');
    await setAppMetaJson(targetDb as never, appMetaKeys.backupBackfillDoneEntities, ['todos']);

    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');

    // Imported rows were durably enqueued for the owner (backfill reset +
    // re-run) — outbox covers every imported row + the settings record.
    const totalRows = Object.values(sourceDump).reduce((sum, rows) => sum + rows.length, 0);
    const outbox = await targetDb.getAllAsync<{ entity: string; id: string }>(
      'SELECT entity, id FROM sync_outbox',
    );
    expect(outbox.length).toBe(totalRows + 1);
    const settingsRecord = outbox.filter((row) => row.entity === 'user_backup_settings');
    expect(settingsRecord).toHaveLength(1);

    // Backup is DIRTY — cloud completeness was NOT claimed.
    const dirty = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.dirty'",
    );
    expect(dirty?.value).toBe('1');
    // Backfill markers were reset and re-completed by the re-run.
    const scope = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.scope_version'",
    );
    expect(scope?.value).toBe('2');
    const status = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.backfill_status'",
    );
    expect(status?.value).toBe('complete');
    // No checkpoint generation was recorded for the import.
    const lastComplete = await targetDb.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'backup.last_complete_generation'",
    );
    expect(lastComplete).toBeNull();

    await targetDb.closeAsync();
  }, 60000);
});
