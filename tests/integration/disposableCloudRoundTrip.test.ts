import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  BACKUP_ENTITIES,
  BACKUP_ENTITY_COLUMNS,
  BACKUP_SCOPE_VERSION,
} from '@/core/backup/backup.types';
import { checkDisposableBackend } from '@/simulation/backend/guard';
import { freshDatabase, type TestDatabase } from './helpers/db';

const storage = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: async (key: string) => {
      storage.delete(key);
    },
  },
}));

const run = process.env.DISPOSABLE_CERTIFY_RUN === '1';
const allTables = [...BACKUP_ENTITIES, 'user_backup_settings', 'backup_manifest'] as const;
const cleanupOrder = [
  'backup_manifest',
  'user_backup_settings',
  'workout_session_sets',
  'workout_session_exercises',
  'workout_logs',
  'routine_exercise_sets',
  'routine_exercises',
  'workout_schedule_overrides',
  'workout_weekly_plan',
  'habit_completions',
  'todos',
  'habits',
  'daily_plans',
  'goals',
  'projects',
  'calorie_entries',
  'saved_meals',
  'pomodoro_sessions',
  'linked_action_rules',
  'custom_exercises',
  'body_weight_entries',
  'workout_routines',
  'weekly_reviews',
] as const;

function client(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function remoteCount(remote: SupabaseClient, table: string, owner: string): Promise<number> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await remote
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', owner);
    if (!result.error) return result.count ?? 0;
    if (!result.error.message.includes('fetch failed') || attempt === 2) {
      throw new Error(`${table} count failed: ${result.error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error(`${table} count did not complete.`);
}

async function signInProbeOwner(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  ownedIds: string[],
): Promise<{ id: string; mode: 'anonymous' | 'email' }> {
  const anonymous = await userClient.auth.signInAnonymously();
  if (anonymous.data.user) {
    ownedIds.push(anonymous.data.user.id);
    return { id: anonymous.data.user.id, mode: 'anonymous' };
  }
  if (!anonymous.error?.message.includes('Anonymous sign-ins are disabled')) {
    throw new Error(`Disposable sign-in failed: ${anonymous.error?.message ?? 'unknown error'}`);
  }
  // Fresh disposable projects may have anonymous sign-ins disabled. Email
  // users still exercise the same authenticated RLS policies, while the
  // result explicitly reports that the app's anonymous bootstrap was not run.
  const email = `probe-${randomBytes(10).toString('hex')}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`Disposable test-user creation failed: ${created.error?.message}`);
  }
  ownedIds.push(created.data.user.id);
  const signedIn = await userClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.user) {
    throw new Error(`Disposable test-user sign-in failed: ${signedIn.error?.message}`);
  }
  return { id: signedIn.data.user.id, mode: 'email' };
}

describe.skipIf(!run)('disposable cloud backup and Restore V2', () => {
  it('proves schema, RLS, app backup, restore, hard deletion, owner binding, and outbox retry', async () => {
    const url = process.env.DISPOSABLE_CERTIFY_URL ?? '';
    const name = process.env.DISPOSABLE_CERTIFY_NAME ?? '';
    const publicKey = process.env.DISPOSABLE_CERTIFY_PUBLIC_KEY ?? '';
    const serviceKey = process.env.DISPOSABLE_CERTIFY_SERVICE_KEY ?? '';
    const productionHost = process.env.DISPOSABLE_CERTIFY_PRODUCTION_HOST ?? '';
    const guard = checkDisposableBackend({
      targetHost: url,
      targetProjectName: name,
      productionHosts: [productionHost],
      ambientEnv: {
        EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      },
      disposableMarkerPrefix: 'superhabits-disposable',
    });
    expect(productionHost).toContain('supabase.co');
    expect(guard.ok, guard.message).toBe(true);
    expect(publicKey).toBeTruthy();
    expect(serviceKey).toBeTruthy();

    // The admin key is used only for exact test-owner cleanup after the
    // owner-scoped client assertions. It is never put into an app mock.
    const admin = client(url, serviceKey);
    const ownerA = client(url, publicKey);
    const ownerB = client(url, publicKey);
    const ownedIds: string[] = [];
    let db: TestDatabase | null = null;
    let activeOwner: string | null = null;
    let activeRemote: SupabaseClient = ownerA;
    let authModes = '';
    try {
      const signA = await signInProbeOwner(ownerA, admin, ownedIds);
      const aId = signA.id;
      const signB = await signInProbeOwner(ownerB, admin, ownedIds);
      const bId = signB.id;
      authModes = `${signA.mode}/${signB.mode}`;
      activeOwner = aId;

      // Real PostgREST access to all 21 backup entities and both synthetic
      // rows proves exposure, columns, and grants; it is distinct from the
      // local SQLite migration tests.
      for (const table of allTables) {
        const columns =
          table === 'backup_manifest'
            ? [
                'user_id',
                'backup_schema_version',
                'generation',
                'completed_at',
                'entity_metadata',
                'settings_version',
                'updated_at',
              ]
            : table === 'user_backup_settings'
              ? ['user_id', 'settings_version', 'payload', 'updated_at']
              : [...BACKUP_ENTITY_COLUMNS[table], 'user_id'];
        const probe = await ownerA.from(table).select(columns.join(',')).limit(0);
        expect(probe.error, `${table} Data API schema`).toBeNull();
      }

      vi.doMock('@/lib/supabase', () => ({
        get supabase() {
          return activeRemote;
        },
        isRemoteEnabled: () => true,
        getSupabaseAuthUserId: async () => activeOwner,
        getSupabaseSessionUserId: async () => activeOwner,
      }));
      db = await freshDatabase();
      const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
      await setLocalDatasetOwner(db as never, aId);
      const todos = await import('@/features/todos/todos.data');
      const habits = await import('@/features/habits/habits.data');
      const workout = await import('@/features/workout/workout.data');
      const calories = await import('@/features/calories/calories.data');
      const pomodoro = await import('@/features/pomodoro/pomodoro.data');
      const { syncEngine } = await import('@/core/sync/sync.engine');

      const todoId = await todos.addTodo({ title: 'Disposable cloud certification' });
      const habitId = await habits.addHabit('Disposable habit', 1);
      await calories.addCalorieEntry({
        foodName: 'Disposable oats',
        calories: 300,
        protein: 12.123456789,
        carbs: 50.123456789,
        fats: 5.123456789,
        fiber: 1.123456789,
        mealType: 'breakfast',
        consumedOn: '2026-09-25',
      });
      await pomodoro.logPomodoroSession(
        '2026-09-25T09:00:00.000Z',
        '2026-09-25T09:25:00.000Z',
        1500,
        'focus',
      );
      await workout.addRoutine('Disposable routine', 'Disposable certification');
      const routine = await db.getFirstAsync<{ id: string }>(
        "SELECT id FROM workout_routines WHERE name = 'Disposable routine'",
      );
      expect(routine?.id).toBeTruthy();
      const routineId = routine!.id;
      const customId = await workout.createCustomExercise({
        name: 'Disposable cable raise',
        aliases: ['cable raise'],
        instructions: 'Raise slowly.',
        primaryArea: 'shoulders',
        secondaryAreas: [],
        equipment: 'cable',
        modality: 'weighted_strength',
        unilateral: false,
        supportsExternalLoad: true,
      });
      const exerciseId = await workout.addExercise({
        routineId,
        name: 'Disposable cable raise',
        catalogExerciseId: customId,
        modality: 'weighted_strength',
        supportsExternalLoad: true,
        progressionMode: 'linear',
        progressionIncrement: 1.123456789,
      });
      await workout.addSet({
        exerciseId,
        setNumber: 1,
        activeSeconds: 40,
        restSeconds: 20,
        targetLoad: 20.123456789,
      });
      const log = await workout.logWorkoutSession({
        routineId,
        exercises: [
          {
            exerciseName: 'Disposable cable raise',
            setsCompleted: 1,
            catalogExerciseId: customId,
            modality: 'weighted_strength',
            sets: [
              { setNumber: 1, weight: 20.123456789, reps: 8, weightUnit: 'kg', completed: true },
            ],
          },
        ],
      });
      expect(log.status).toBe('applied');
      await workout.upsertWeeklyPlanEntry({ weekday: 5, routineId, planKind: 'workout' });
      await workout.setWorkoutScheduleOverride({
        dateKey: '2026-09-26',
        overrideKind: 'workout',
        routineId,
      });
      await workout.addBodyWeightEntry({
        weight: 80.123456789,
        unit: 'kg',
        measuredAt: '2026-09-25T08:00:00.000Z',
      });

      // Inject one entity failure: successful entities leave the outbox; the
      // failed entity remains durable and retries successfully later.
      activeRemote = {
        ...ownerA,
        from: ((table: string) =>
          table === 'habits'
            ? { upsert: async () => ({ error: { message: 'injected disposable failure' } }) }
            : ownerA.from(table)) as SupabaseClient['from'],
      } as SupabaseClient;
      await expect(syncEngine.flush()).rejects.toThrow('injected disposable failure');
      const pendingHabit = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sync_outbox WHERE entity = 'habits' AND id = ?",
        [habitId],
      );
      expect(pendingHabit?.count).toBe(1);
      expect(await remoteCount(ownerA, 'todos', aId)).toBe(1);
      activeRemote = ownerA;
      await syncEngine.flush();
      expect(
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
          ?.count,
      ).toBe(0);

      const checkpoint = await import('@/core/backup/backupCheckpoint');
      const maintenance = await checkpoint.runBackupMaintenance();
      expect(maintenance.capturedManifest).toBe(true);
      const manifestResult = await ownerA
        .from('backup_manifest')
        .select('*')
        .eq('user_id', aId)
        .single();
      expect(manifestResult.error).toBeNull();
      expect(manifestResult.data?.backup_scope_version).toBe(BACKUP_SCOPE_VERSION);
      expect(Object.keys(manifestResult.data?.entity_metadata ?? {}).sort()).toEqual(
        [...BACKUP_ENTITIES].sort(),
      );
      expect(await remoteCount(ownerA, 'user_backup_settings', aId)).toBe(1);
      const localWeight = await db.getFirstAsync<{ weight: number }>(
        'SELECT weight FROM body_weight_entries LIMIT 1',
      );
      const remoteWeight = await ownerA
        .from('body_weight_entries')
        .select('weight')
        .eq('user_id', aId)
        .single();
      expect(remoteWeight.error).toBeNull();
      expect(
        remoteWeight.data?.weight,
        'body weight must survive the remote round trip without checksum drift',
      ).toBe(localWeight?.weight);
      for (const [table, columns] of [
        ['calorie_entries', ['protein', 'carbs', 'fats', 'fiber']],
        ['saved_meals', ['protein', 'carbs', 'fats', 'fiber']],
        ['routine_exercises', ['progression_increment']],
        ['routine_exercise_sets', ['target_load']],
        ['workout_session_sets', ['weight']],
      ] as const) {
        const selection = columns.join(',');
        const local = await db.getFirstAsync<Record<string, number>>(
          `SELECT ${selection} FROM ${table} LIMIT 1`,
        );
        const remote = await ownerA.from(table).select(selection).eq('user_id', aId).single();
        expect(remote.error, `${table} precision fetch`).toBeNull();
        const remoteRow = remote.data as unknown as Record<string, number> | null;
        for (const column of columns) {
          expect(remoteRow?.[column], `${table}.${column} decimal round trip`).toBe(
            local?.[column],
          );
        }
      }
      for (const table of BACKUP_ENTITIES) {
        const local = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM ${table}`,
        );
        expect(await remoteCount(ownerA, table, aId), `${table} remote count`).toBe(
          local?.count ?? 0,
        );
      }

      // B cannot read, spoof an owner-stamped insert, update, or delete A's
      // row. The unauthenticated role cannot read the row either.
      const anon = client(url, publicKey);
      for (const table of [
        'todos',
        'habits',
        'custom_exercises',
        'workout_session_sets',
        'user_backup_settings',
        'backup_manifest',
      ]) {
        expect(await remoteCount(ownerB, table, aId), `${table} RLS isolation`).toBe(0);
      }
      const unauthenticated = await anon.from('todos').select('id').eq('user_id', aId);
      expect(unauthenticated.data === null || unauthenticated.data.length === 0).toBe(true);
      const spoof = await ownerB.from('todos').insert({
        id: `todo_${Date.now()}_isolation`,
        user_id: aId,
        title: 'spoof',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      expect(spoof.error).not.toBeNull();
      const stolenUpdate = await ownerB.from('todos').update({ title: 'stolen' }).eq('id', todoId);
      expect(stolenUpdate.error).toBeNull();
      const ownerTodo = await ownerA.from('todos').select('title').eq('id', todoId).single();
      expect(ownerTodo.data?.title).toBe('Disposable cloud certification');
      const stolenDelete = await ownerB.from('todos').delete().eq('id', todoId);
      expect(stolenDelete.error).toBeNull();
      expect(await remoteCount(ownerA, 'todos', aId)).toBe(1);
      const stolenGymUpdate = await ownerB
        .from('custom_exercises')
        .update({ name: 'stolen exercise' })
        .eq('id', customId);
      expect(stolenGymUpdate.error).toBeNull();
      const ownerExercise = await ownerA
        .from('custom_exercises')
        .select('name')
        .eq('id', customId)
        .single();
      expect(ownerExercise.data?.name).toBe('Disposable cable raise');
      const stolenGymDelete = await ownerB.from('custom_exercises').delete().eq('id', customId);
      expect(stolenGymDelete.error).toBeNull();
      expect(await remoteCount(ownerA, 'custom_exercises', aId)).toBe(1);

      await db.closeAsync();
      db = await freshDatabase();
      const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
      const restored = await restoreFromRemoteBackupV2();
      expect(restored.status, JSON.stringify(restored)).toBe('restored');
      const ownerRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'account.owner_user_id'",
      );
      expect(ownerRow?.value).toBe(aId);
      expect(
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
          ?.count,
      ).toBe(0);
      expect(
        (
          await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) AS count FROM custom_exercises',
          )
        )?.count,
      ).toBe(1);
      expect(
        (
          await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) AS count FROM workout_weekly_plan',
          )
        )?.count,
      ).toBe(1);
      expect(
        (
          await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) AS count FROM workout_schedule_overrides',
          )
        )?.count,
      ).toBe(1);
      expect(
        (
          await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) AS count FROM body_weight_entries',
          )
        )?.count,
      ).toBe(1);
      expect(
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workout_logs'))
          ?.count,
      ).toBe(1);

      // Imported owner binding blocks a different account and preserves the
      // durable outbox. Switching back to the original owner drains it.
      const importedTodos = await import('@/features/todos/todos.data');
      await importedTodos.addTodo({ title: 'Post restore owner check' });
      const importedSync = (await import('@/core/sync/sync.engine')).syncEngine;
      activeOwner = bId;
      activeRemote = ownerB;
      await expect(importedSync.flush()).rejects.toThrow('does not match');
      expect(
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
          ?.count,
      ).toBeGreaterThan(0);
      expect(await remoteCount(ownerB, 'todos', bId)).toBe(0);
      activeOwner = aId;
      activeRemote = ownerA;
      await importedSync.flush();
      expect(
        (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
          ?.count,
      ).toBe(0);

      const importedWorkout = await import('@/features/workout/workout.data');
      expect(await importedWorkout.deleteWorkoutLog(log.logId!)).toBe(true);
      await importedSync.flush();
      expect(await remoteCount(ownerA, 'workout_logs', aId)).toBe(0);
      expect(await remoteCount(ownerA, 'workout_session_exercises', aId)).toBe(0);
      expect(await remoteCount(ownerA, 'workout_session_sets', aId)).toBe(0);
    } finally {
      await db?.closeAsync().catch(() => undefined);
      // Exact-owner cleanup only. No schema wipe or broad project teardown.
      const cleanupErrors: string[] = [];
      for (const id of ownedIds) {
        for (const table of cleanupOrder) {
          const result = await admin.from(table).delete().eq('user_id', id);
          if (result.error) cleanupErrors.push(`${table}:${result.error.code}`);
        }
        const result = await admin.auth.admin.deleteUser(id);
        if (result.error) cleanupErrors.push(`auth:${result.error.code}`);
      }
      expect(cleanupErrors, 'disposable cleanup').toEqual([]);
      for (const id of ownedIds) {
        for (const table of [
          'todos',
          'backup_manifest',
          'body_weight_entries',
          'workout_routines',
        ]) {
          expect(await remoteCount(admin, table, id), `${table} post-cleanup`).toBe(0);
        }
      }
    }
    process.stdout.write(
      `DISPOSABLE_REMOTE_PASS project=${new URL(url).hostname} auth=${authModes} scope=${BACKUP_SCOPE_VERSION} entities=${BACKUP_ENTITIES.length} cleanup=verified-test-owners\n`,
    );
  }, 240_000);
});

describe.skipIf(!run || process.env.DISPOSABLE_CERTIFY_EDGE !== '1')(
  'disposable edge function auth and rollout',
  () => {
    it('rejects unauthenticated and rollout-disabled requests before any provider work', async () => {
      const url = process.env.DISPOSABLE_CERTIFY_URL ?? '';
      const publicKey = process.env.DISPOSABLE_CERTIFY_PUBLIC_KEY ?? '';
      const serviceKey = process.env.DISPOSABLE_CERTIFY_SERVICE_KEY ?? '';
      const productionHost = process.env.DISPOSABLE_CERTIFY_PRODUCTION_HOST ?? '';
      const guard = checkDisposableBackend({
        targetHost: url,
        targetProjectName: process.env.DISPOSABLE_CERTIFY_NAME ?? '',
        productionHosts: [productionHost],
        ambientEnv: {
          EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        disposableMarkerPrefix: 'superhabits-disposable',
      });
      expect(guard.ok, guard.message).toBe(true);
      const admin = client(url, serviceKey);
      const userClient = client(url, publicKey);
      const ownedIds: string[] = [];
      let authMode = '';
      try {
        const signedIn = await signInProbeOwner(userClient, admin, ownedIds);
        authMode = signedIn.mode;
        const session = await userClient.auth.getSession();
        const token = session.data.session?.access_token;
        expect(token).toBeTruthy();
        for (const name of ['parse-ai-command', 'user-ai-ask']) {
          const endpoint = `${url}/functions/v1/${name}`;
          const headers = { apikey: publicKey, 'Content-Type': 'application/json' };
          const missing = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: '{}',
            signal: AbortSignal.timeout(15_000),
          });
          expect(missing.status, `${name} missing bearer`).toBe(401);
          const wrong = await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers, Authorization: 'Bearer invalid-token' },
            body: '{}',
            signal: AbortSignal.timeout(15_000),
          });
          expect(wrong.status, `${name} invalid bearer`).toBe(401);
          const valid = await fetch(endpoint, {
            method: 'POST',
            headers: { ...headers, Authorization: `Bearer ${token}` },
            body: '{}',
            signal: AbortSignal.timeout(15_000),
          });
          const body = await valid.text();
          expect(
            valid.status,
            `${name} authenticated default-off gate: ${body.slice(0, 180).replaceAll(token!, '[TOKEN]').replaceAll(publicKey, '[PUBLIC_KEY]')}`,
          ).toBe(403);
          expect(body).toContain('unavailable');
        }
      } finally {
        for (const id of ownedIds) {
          const deleted = await admin.auth.admin.deleteUser(id);
          expect(deleted.error, 'disposable edge test-user cleanup').toBeNull();
        }
      }
      process.stdout.write(
        `DISPOSABLE_EDGE_PASS project=${new URL(url).hostname} auth=${authMode} functions=2 provider_calls=0 cleanup=exact-test-owner\n`,
      );
    }, 60_000);
  },
);
