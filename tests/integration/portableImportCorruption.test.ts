import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';

/**
 * Portable Data Export & Import V1 — corruption matrix + owner matrix +
 * populated-device guard + import eligibility edge cases.
 *
 * Every corruption is rejected by `preparePortableImport` and the local
 * database (user tables, outbox, app_meta) stays byte-identical. Owner
 * compatibility is decided from the durable binding + the file's one-way
 * fingerprint; a file can never change the owner binding.
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

// `portableFileIo` statically imports the native-only Expo modules; stub them
// for the node harness (the web bundle ships their web implementations).
vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));
vi.mock('expo-file-system', () => ({
  File: class {},
  Paths: { cache: {} },
}));
vi.mock('expo-sharing', () => ({
  isAvailableAsync: vi.fn(async () => true),
  shareAsync: vi.fn(),
}));

async function makeValidFile(): Promise<string> {
  const db = await freshDatabase();
  const todos = await import('@/features/todos/todos.data');
  await todos.addTodo({ title: 'Seed todo' });
  // Seed one row per entity group that the corruption cases mutate, so every
  // graph/row corruption is meaningful.
  await db.runAsync(
    `INSERT INTO habits (id, name, target_per_day, category, icon, color, rule_history, created_at, updated_at, deleted_at)
     VALUES ('habit_1', 'Hydrate', 1, 'anytime', 'water-drop', '#0ea5e9', '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', NULL)`,
  );
  await db.runAsync(
    `INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
     VALUES ('hcmp_1', 'habit_1', '2026-08-15', 1, '2026-08-15T08:00:00.000Z', '2026-08-15T08:00:00.000Z')`,
  );
  await db.runAsync(
    `INSERT INTO saved_meals (id, food_name, calories, protein, carbs, fats, fiber, meal_type, use_count, last_used_at, created_at)
     VALUES ('smeal_1', 'Oatmeal', 300, 10, 50, 5, 4, 'breakfast', 1, '2026-08-15T08:00:00.000Z', '2026-08-15T08:00:00.000Z')`,
  );
  await db.runAsync(
    `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
     VALUES ('pom_1', '2026-08-15T09:00:00.000Z', '2026-08-15T09:25:00.000Z', 1500, 'focus', '2026-08-15T09:00:00.000Z')`,
  );
  await db.runAsync(
    `INSERT INTO linked_action_rules (id, status, direction_policy, bidirectional_group_id, source_feature, source_entity_type, source_entity_id, trigger_type, target_feature, target_entity_type, target_entity_id, effect_type, effect_payload, created_at, updated_at, deleted_at)
     VALUES ('la_1', 'active', 'one_way', NULL, 'habits', 'habit', 'habit_1', 'habit.progress_incremented', 'calories', 'calorie_log', NULL, 'calorie.log', '{}', '2026-08-15T08:00:00.000Z', '2026-08-15T08:00:00.000Z', NULL)`,
  );
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const result = await exportPortableBackup();
  if (!result.ok) throw new Error(result.error);
  await db.closeAsync();
  return result.json;
}

async function prepare(text: string) {
  const { preparePortableImport } = await import('@/core/portable/portableImport');
  return preparePortableImport({ fileName: 'test.json', text });
}

async function countUserRows(db: TestDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
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
       SELECT COUNT(*) FROM linked_action_rules UNION ALL
       SELECT COUNT(*) FROM linked_action_events UNION ALL
       SELECT COUNT(*) FROM linked_action_executions
     )`,
  );
  return row?.count ?? 0;
}

describe('corruption matrix', () => {
  it('rejects every corrupted input and leaves the database unchanged', async () => {
    const valid = await makeValidFile();
    const parsed = JSON.parse(valid) as Record<string, unknown>;

    const corruptions: { name: string; build: () => string }[] = [
      { name: 'invalid JSON', build: () => '{"format": ' },
      { name: 'wrong format string', build: () => JSON.stringify({ ...parsed, format: 'nope' }) },
      {
        name: 'missing formatVersion',
        build: () => {
          const copy = { ...parsed };
          delete copy.formatVersion;
          return JSON.stringify(copy);
        },
      },
      {
        name: 'future formatVersion',
        build: () => JSON.stringify({ ...parsed, formatVersion: 99 }),
      },
      {
        name: 'future backup schema version',
        build: () => JSON.stringify({ ...parsed, backupSchemaVersion: 99 }),
      },
      {
        name: 'legacy backup schema version',
        build: () => JSON.stringify({ ...parsed, backupSchemaVersion: 1 }),
      },
      {
        name: 'missing entity',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          delete (copy.entities as Record<string, unknown>).todos;
          return JSON.stringify(copy);
        },
      },
      {
        name: 'unknown entity',
        build: () =>
          JSON.stringify({
            ...parsed,
            entities: { ...(parsed.entities as Record<string, unknown>), app_meta: [] },
          }),
      },
      {
        name: 'invalid todo row',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const todo = (
            (parsed.entities as Record<string, unknown>).todos as Record<string, unknown>[]
          )[0];
          (copy.entities as Record<string, unknown>).todos = [{ ...todo, completed: 42 }];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'invalid habit rule_history',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const habit = (
            (parsed.entities as Record<string, unknown>).habits as Record<string, unknown>[]
          )[0];
          (copy.entities as Record<string, unknown>).habits = [
            { ...habit, rule_history: 'not-json' },
          ];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'bad pomodoro session type',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const session = (
            (parsed.entities as Record<string, unknown>).pomodoro_sessions as Record<
              string,
              unknown
            >[]
          )[0];
          (copy.entities as Record<string, unknown>).pomodoro_sessions = [
            { ...session, session_type: 'nap' },
          ];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'malformed saved meal',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const meal = (
            (parsed.entities as Record<string, unknown>).saved_meals as Record<string, unknown>[]
          )[0];
          (copy.entities as Record<string, unknown>).saved_meals = [{ ...meal, use_count: -3 }];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'malformed linked action rule',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const rule = (
            (parsed.entities as Record<string, unknown>).linked_action_rules as Record<
              string,
              unknown
            >[]
          )[0];
          (copy.entities as Record<string, unknown>).linked_action_rules = [
            { ...rule, effect_payload: '{{{' },
          ];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'bad settings',
        build: () => JSON.stringify({ ...parsed, settings: { calorieGoal: 'not-an-object' } }),
      },
      {
        name: 'wrong entity checksum',
        build: () => {
          const copy = {
            ...parsed,
            integrity: { ...(parsed.integrity as Record<string, unknown>) },
          };
          const entities = {
            ...((copy.integrity as Record<string, unknown>).entities as Record<string, unknown>),
          };
          entities.todos = { count: 1, checksum: 'f'.repeat(64) };
          (copy.integrity as Record<string, unknown>).entities = entities;
          return JSON.stringify(copy);
        },
      },
      {
        name: 'wrong settings checksum',
        build: () => {
          const copy = {
            ...parsed,
            integrity: { ...(parsed.integrity as Record<string, unknown>) },
          };
          (copy.integrity as Record<string, unknown>).settings = {
            version: 2,
            checksum: 'e'.repeat(64),
          };
          return JSON.stringify(copy);
        },
      },
      {
        name: 'wrong payload checksum',
        build: () => {
          const copy = {
            ...parsed,
            integrity: { ...(parsed.integrity as Record<string, unknown>) },
          };
          (copy.integrity as Record<string, unknown>).payloadChecksum = 'd'.repeat(64);
          return JSON.stringify(copy);
        },
      },
      { name: 'truncated file', build: () => valid.slice(0, valid.length - 80) },
      {
        name: 'tampered exportedAt',
        build: () => JSON.stringify({ ...parsed, exportedAt: '2020-01-01T00:00:00.000Z' }),
      },
      {
        name: 'duplicate completion in graph',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          const completions = [
            ...((parsed.entities as Record<string, unknown>).habit_completions as Record<
              string,
              unknown
            >[]),
          ];
          (copy.entities as Record<string, unknown>).habit_completions = [
            ...completions,
            { ...completions[0], id: 'hcmp_extra_1' },
          ];
          return JSON.stringify(copy);
        },
      },
      {
        name: 'completion without habit parent',
        build: () => {
          const copy = { ...parsed, entities: { ...(parsed.entities as Record<string, unknown>) } };
          (copy.entities as Record<string, unknown>).habits = [];
          return JSON.stringify(copy);
        },
      },
    ];

    for (const corruption of corruptions) {
      const db = await freshDatabase();
      const before = {
        userRows: await countUserRows(db),
        outbox:
          (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
            ?.count ?? 0,
        meta: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM app_meta ORDER BY key'),
      };
      const outcome = await prepare(corruption.build());
      expect(outcome.status, corruption.name).toBe('rejected');
      const after = {
        userRows: await countUserRows(db),
        outbox:
          (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'))
            ?.count ?? 0,
        meta: await db.getAllAsync<Record<string, unknown>>('SELECT * FROM app_meta ORDER BY key'),
      };
      expect(after, `${corruption.name}: database unchanged`).toEqual(before);
      await db.closeAsync();
    }
  }, 120_000);

  it('rejects an oversized file at the I/O boundary before reading it', async () => {
    const { readPickedPortableFileWeb } = await import('@/core/portable/portableFileIo');
    const { PORTABLE_IMPORT_MAX_BYTES } = await import('@/core/portable/portable.types');
    const oversized = { size: PORTABLE_IMPORT_MAX_BYTES + 1 } as File;
    const result = await readPickedPortableFileWeb(oversized);
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/import limit/);
  });
});

describe('owner compatibility matrix', () => {
  async function fileWithOwner(ownerId: string | null): Promise<string> {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Owner seed' });
    if (ownerId) {
      const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
      await setLocalDatasetOwner(db as never, ownerId);
    }
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const result = await exportPortableBackup();
    if (!result.ok) throw new Error(result.error);
    await db.closeAsync();
    return result.json;
  }

  it('BLOCKS an owner-A file on an owner-B device and changes nothing', async () => {
    const text = await fileWithOwner('owner-a');
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'owner-b');
    const before = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM app_meta ORDER BY key',
    );
    const outcome = await prepare(text);
    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.message).toMatch(/different account/);
    expect(
      await db.getAllAsync<Record<string, unknown>>('SELECT * FROM app_meta ORDER BY key'),
    ).toEqual(before);
    expect(await countUserRows(db)).toBe(0);
    await db.closeAsync();
  }, 60_000);

  it('allows an owner file on an unclaimed device, records the origin, and clears any provisional binding', async () => {
    const text = await fileWithOwner('owner-a');
    const db = await freshDatabase();
    const { bindProvisionalLocalDatasetOwner, getLocalDatasetOwner } =
      await import('@/core/auth/account.data');
    await bindProvisionalLocalDatasetOwner(db as never, 'temp-session-x');

    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: 'a.json', text });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preview.ownerVerdict).toBe('unclaimed');
    expect(outcome.preview.disclosures.join(' ')).toMatch(/blocked for this dataset/);

    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');

    // The provisional binding was dropped; the device is unclaimed again but
    // the import-origin fingerprint is recorded durably.
    expect(await getLocalDatasetOwner(db as never)).toBeNull();
    const origin = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'portable.last_import_owner_fingerprint'",
    );
    expect(origin?.value).toBe(portableOwnerFingerprint('owner-a'));
    await db.closeAsync();
  });

  it('allows a local-only file on an owner-bound device with an explicit adoption disclosure', async () => {
    const text = await fileWithOwner(null);
    const db = await freshDatabase();
    const { setLocalDatasetOwner, getLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'owner-b');

    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const outcome = await preparePortableImport({ fileName: 'b.json', text });
    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preview.ownerVerdict).toBe('adopting_into_owner');
    expect(outcome.preview.disclosures.join(' ')).toMatch(/this account/);

    expect((await confirmPortableImport({ file: outcome.file })).status).toBe('restored');
    // The permanent owner binding is untouched.
    expect(await getLocalDatasetOwner(db as never)).toBe('owner-b');
    await db.closeAsync();
  });

  it('BLOCKS import on a populated device (complete emptiness guard)', async () => {
    const text = await makeValidFile();
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    await todos.addTodo({ title: 'Existing local todo' });

    const outcome = await prepare(text);
    expect(outcome.status).toBe('rejected');
    if (outcome.status !== 'rejected') return;
    expect(outcome.message).toMatch(/only available on an empty device/);
    expect(await countUserRows(db)).toBe(1); // the existing todo is untouched
    await db.closeAsync();
  });
});
