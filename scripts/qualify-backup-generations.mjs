/**
 * Execute the committed generation migrations and their hostile-client contract
 * against a NEW, disposable PostgreSQL cluster. Never accepts a connection URL:
 * it cannot accidentally run against a developer or production database.
 *
 * node scripts/qualify-backup-generations.mjs [--pg-bin <directory>]
 * PostgreSQL 17+ binaries must already exist. No installation or cloud access.
 * The temp evidence directory is retained; its server is always stopped.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Module, { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entities = [
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
  'weekly_reviews',
  'projects',
  'goals',
  'daily_plans',
  'workout_session_sets',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
];
const rewardEntities = [
  'gamification_events',
  'gamification_streak_freezes',
  'gamification_quests',
  'gamification_badges',
];
function generationEntities(scope) {
  if (scope === 7) return entities;
  const featureEntities = [...entities, 'todo_recurrence_series'];
  return scope === 10 ? [...featureEntities, ...rewardEntities] : featureEntities;
}
const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sha = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const canonicalRows = (rows) =>
  JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );

const validSettings = {
  calorieGoal: null,
  pomodoroSettings: null,
  theme: { mode: 'light', slots: null },
  macroTargets: null,
  pomodoroPresets: null,
  workoutRestSeconds: null,
  notificationPreferences: null,
  workoutPreferences: null,
};
const timestamp = '2026-10-20T00:00:00.000Z';
const validTodo = (id, extra = {}) => ({
  id,
  title: 'Task',
  notes: null,
  completed: 0,
  due_date: null,
  priority: 'normal',
  sort_order: 0,
  recurrence: null,
  recurrence_id: null,
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  ...extra,
});
const validCalorie = (id, extra = {}) => ({
  id,
  food_name: 'Coffee',
  calories: 10,
  protein: 12.5,
  carbs: 0,
  fats: 0,
  fiber: 0,
  meal_type: 'snack',
  consumed_on: '2026-10-20',
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: null,
  ...extra,
});

/** Execute real serializers: frozen Scope-7 preservation or current capture. */
async function productionGeneration(
  snapshotId,
  sequence,
  rows = {},
  scopeVersion = 7,
  baseHead = null,
) {
  const require = createRequire(import.meta.url);
  const ts = require('typescript');
  const state = new Map([
    ['sequence', String(sequence - 1)],
    ['verifiedBase', baseHead ? { ownerUserId: ownerA, ...baseHead } : null],
  ]);
  const db = {
    getAllAsync: async (query) => {
      if (/FROM sync_outbox/.test(query)) return [];
      const entity = /FROM (\w+)/.exec(query)?.[1];
      return rows[entity] ?? [];
    },
  };
  const mocks = {
    '@/core/db/appMeta': {
      appMetaKeys: {
        backupGenerationSequence: 'sequence',
        backupGenerationCapture: 'capture',
        backupVerifiedGenerationBaseHead: 'verifiedBase',
      },
      getAppMetaText: async (_db, key) => state.get(key) ?? null,
      getAppMetaJson: async (_db, key) => state.get(key) ?? null,
      getAppMetaJsonOrDefault: async (_db, key, fallback, normalize) => {
        const value = state.get(key);
        return value === undefined ? fallback : normalize ? normalize(value) : value;
      },
      setAppMetaJson: async (_db, key, value) => {
        state.set(key, value);
      },
      setAppMetaText: async (_db, key, value) => {
        state.set(key, value);
      },
    },
    '@/core/db/client': { getDatabase: async () => db },
    '@/core/auth/account.data': { getLocalDatasetOwner: async () => ownerA },
    '@/core/db/transactions': {
      withSQLiteTransaction: async (database, action) => action(database),
    },
    '@/lib/id': { createId: () => snapshotId },
    '@/lib/time': { nowIso: () => '2026-10-20T00:00:00.000Z' },
  };
  const cache = new Map();
  const load = (filename) => {
    const absolute = path.join(root, filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = new Module(absolute);
    cache.set(absolute, mod);
    mod.filename = absolute;
    mod.paths = Module._nodeModulePaths(path.dirname(absolute));
    mod.require = (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      if (id.startsWith('.'))
        return load(path.relative(root, path.resolve(path.dirname(absolute), id)) + '.ts');
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      absolute,
    );
    return mod.exports;
  };
  const { validateBackupRow, validateBackupSnapshotRow, validateBackupGraph } = load(
    'core/backup/backupValidators.ts',
  );
  for (const [entity, values] of Object.entries(rows))
    for (const row of values)
      assert.deepEqual(
        validateBackupSnapshotRow(entity, row),
        { ok: true, row },
        'production protocol fixture must satisfy actual Restore validators',
      );
  assert.deepEqual(
    validateBackupGraph(rows),
    [],
    'production protocol fixture graph must be restorable',
  );
  const captureModule = load('core/backup/generations/capture.ts');
  const { capture, chunks } =
    scopeVersion < 10
      ? captureModule.withReservedGenerationSequence(
          captureModule.captureVerifiedRows({
            ownerUserId: ownerA,
            rowsByEntity: rows,
            settingsPayload: validSettings,
            scopeVersion,
            baseHead,
          }),
          sequence,
        )
      : await captureModule.captureGeneration({ settingsPayload: validSettings });
  assert.equal(capture.snapshotId, snapshotId);
  assert.equal(capture.sequence, sequence);
  assert.deepEqual(
    Object.keys(JSON.parse(capture.manifest)[0].entities).filter(
      (key) => key !== 'user_backup_settings',
    ),
    generationEntities(scopeVersion),
    'SQL qualification entity contract drifted from production capture',
  );
  return {
    snapshotId,
    sequence,
    capture,
    item: JSON.parse(capture.manifest)[0],
    chunks,
    manifest: capture.manifest,
    checksum: capture.manifestChecksum,
    validateBackupRow,
  };
}

// These are protocol fixtures, not a replacement for Restore V2's domain-level
// row/settings validators. Values exercise UTF-8, escapes, floats and nested JSON
// while preserving the exact capture.ts serialization/checksum contract.
function generation(snapshotId, sequence, options = {}) {
  const rows = options.rows ?? {
    todos: [
      validTodo('todo_01', { title: 'Coffee ☕ "quoted"', notes: 'line\nbreak' }),
      validTodo('todo_02', { title: 'Later' }),
    ],
  };
  const chunks = [];
  const descriptions = {};
  const scopeVersion = options.scopeVersion ?? 7;
  const captureEntities = generationEntities(scopeVersion);
  for (const entity of captureEntities) {
    const all = rows[entity] ?? [];
    descriptions[entity] = { rows: all.length, checksum: sha(canonicalRows(all)) };
    for (let index = 0; index < all.length; index += 250) {
      const payload = canonicalRows(all.slice(index, index + 250));
      chunks.push({ entity, ordinal: index / 250, payload, checksum: sha(payload) });
    }
  }
  const settings = JSON.stringify(validSettings);
  chunks.push({
    entity: 'user_backup_settings',
    ordinal: 0,
    payload: settings,
    checksum: sha(settings),
  });
  descriptions.user_backup_settings = { rows: 1, checksum: sha(settings) };
  const item = {
    protocolVersion: 1,
    backupSchemaVersion: 2,
    scopeVersion,
    settingsVersion: 5,
    snapshotId,
    sequence,
    capturedAt: '2026-10-20T00:00:00.000Z',
    entities: descriptions,
    settingsChecksum: sha(settings),
  };
  if (options.mutate) options.mutate(item, chunks);
  const manifest = canonicalRows([item]);
  return { snapshotId, sequence, item, chunks, manifest, checksum: sha(manifest) };
}

export async function qualifyBackupGenerations(options = {}) {
  const bin =
    options.pgBin ??
    process.env.PG_BIN ??
    (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
  const exe = (name) =>
    bin ? path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
  const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'superhabits-generation-qualification-'));
  const data = path.join(evidence, 'data');
  const logPath = path.join(evidence, 'postgres.log');
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close((error) => (error ? reject(error) : resolve(value)));
    });
  });
  const log = fs.openSync(logPath, 'a');
  let started = false;
  let child;
  const checks = [];
  const base = [
    '-X',
    '-w',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'audit_owner',
    '-d',
    'postgres',
    '-At',
    '--set=ON_ERROR_STOP=1',
  ];
  const sql = (input, owner = null) =>
    spawnSync(exe('psql'), base, {
      input:
        (owner ? `SET ROLE authenticated; SET request.jwt.claim.sub=${literal(owner)};\n` : '') +
        input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
    });
  const ok = (input, owner = null) => {
    const result = sql(input, owner);
    assert.equal(result.status, 0, `${input}\n${result.stderr ?? result.error}`);
    return result.stdout
      .trim()
      .split(/\r?\n/)
      .filter((line) => line !== 'SET')
      .join('\n');
  };
  const rejected = (name, input, owner = ownerA, pattern = /ERROR:/) => {
    const result = sql(input, owner);
    assert.notEqual(result.status, 0, `${name}: unexpectedly accepted\n${result.stdout}`);
    assert.match(result.stderr, pattern, `${name}: wrong failure ${result.stderr}`);
    checks.push(name);
  };
  const sqlAsync = (input, owner = ownerA) =>
    new Promise((resolve, reject) => {
      const proc = spawn(exe('psql'), base, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error('psql timed out'));
      }, 15000);
      proc.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      proc.once('error', reject);
      proc.once('exit', (status) => {
        clearTimeout(timer);
        resolve({ status, stdout, stderr });
      });
      proc.stdin.end(
        `SET ROLE authenticated; SET request.jwt.claim.sub=${literal(owner)};\n${input}`,
      );
    });
  const reserve = (id, owner = ownerA) =>
    Number(ok(`SELECT public.reserve_backup_generation_sequence(${literal(id)});`, owner));
  const metadataSql = (g, owner = ownerA) => `INSERT INTO public.backup_generation
    (user_id,snapshot_id,sequence,protocol_version,backup_schema_version,scope_version,settings_version,
      manifest,manifest_checksum,captured_at)
    VALUES(${literal(owner)},${literal(g.snapshotId)},${g.sequence},1,2,7,5,
      ${literal(g.manifest)},${literal(g.checksum)},${literal(g.item.capturedAt)})
    ON CONFLICT(user_id,snapshot_id) DO UPDATE SET manifest=EXCLUDED.manifest,
      manifest_checksum=EXCLUDED.manifest_checksum;`;
  const chunkSql = (g, c, owner = ownerA) => `INSERT INTO public.backup_generation_chunk
    (user_id,snapshot_id,entity,ordinal,payload,checksum) VALUES(${literal(owner)},
      ${literal(g.snapshotId)},${literal(c.entity)},${c.ordinal},${literal(c.payload)},${literal(c.checksum)})
    ON CONFLICT(user_id,snapshot_id,entity,ordinal) DO UPDATE SET
      payload=EXCLUDED.payload,checksum=EXCLUDED.checksum;`;
  const upload = (g, owner = ownerA) => {
    ok(metadataSql(g, owner), owner);
    for (const chunk of g.chunks) ok(chunkSql(g, chunk, owner), owner);
  };
  const publishSql = (g, previous, count = g.chunks.length) =>
    `SELECT snapshot_id || ':' || sequence FROM public.publish_backup_generation(
      ${literal(g.snapshotId)},${previous},${count},${literal(g.checksum)});`;
  try {
    const initialized = spawnSync(
      exe('initdb'),
      [
        '-D',
        data,
        '-U',
        'audit_owner',
        '-A',
        'trust',
        '--locale-provider=builtin',
        '--builtin-locale=C.UTF-8',
        '-E',
        'UTF8',
        '--no-sync',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 30000 },
    );
    assert.equal(initialized.status, 0, `initdb: ${initialized.stderr ?? initialized.error}`);
    child = spawn(
      exe('postgres'),
      ['-D', data, '-h', '127.0.0.1', '-p', String(port), '-c', 'fsync=off'],
      { windowsHide: true, stdio: ['ignore', log, log] },
    );
    // A bounded readiness loop, for this newly created server only.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (sql('SELECT 1;').status === 0) {
        started = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(started, `PostgreSQL did not start; inspect ${logPath}`);
    ok(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      INSERT INTO auth.users VALUES(${literal(ownerA)}),(${literal(ownerB)});`);
    const migrations = fs
      .readdirSync(path.join(root, 'supabase/migrations'))
      .filter((name) =>
        /(?:add_backup_generation_protocol|fix_backup_generation_publication|verify_and_reserve_backup_generations)\.sql$/.test(
          name,
        ),
      )
      .sort();
    assert.equal(
      migrations.length,
      3,
      'qualification must execute all three committed protocol migrations',
    );
    for (const file of migrations.slice(0, 2))
      ok(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
    // Re-derive the audited failures on the actual predecessor, inside rollback
    // transactions. This ensures the qualification is sensitive to both fixes.
    const predecessor = generation('predecessor_control', 1);
    const retryFailure = sql(
      `BEGIN; ${metadataSql(predecessor)}
      ${chunkSql(predecessor, predecessor.chunks[0])}
      ${chunkSql(predecessor, predecessor.chunks[0])} ROLLBACK;`,
      ownerA,
    );
    assert.notEqual(retryFailure.status, 0);
    assert.match(retryFailure.stderr, /row-level security/);
    checks.push('predecessor control reproduces R3-07 identical chunk retry failure');
    predecessor.manifest = '{}';
    predecessor.checksum = 'a'.repeat(64);
    assert.match(
      ok(
        `BEGIN; ${metadataSql(predecessor)}
      ${chunkSql(predecessor, predecessor.chunks[0])}
      ${publishSql(predecessor, 0, 1)} ROLLBACK;`,
        ownerA,
      ),
      /predecessor_control:1/,
    );
    checks.push('predecessor control reproduces R3-08 invalid publication acceptance');
    ok(fs.readFileSync(path.join(root, 'supabase/migrations', migrations[2]), 'utf8'));
    checks.push('unaltered committed migrations execute');
    assert.deepEqual(JSON.parse(ok('SELECT public.backup_generation_capabilities();', ownerA)), {
      protocol_version: 1,
      content_verification_version: 1,
      sequence_reservation_version: 1,
      backup_schema_version: 2,
      scope_version: 7,
      settings_version: 5,
    });
    checks.push('explicit versioned capability');
    assert.equal(
      ok(`SELECT bool_and(relrowsecurity) FROM pg_class
      WHERE oid IN ('public.backup_generation'::regclass,'public.backup_generation_chunk'::regclass,
        'public.backup_generation_head'::regclass,'public.backup_generation_sequence_reservation'::regclass,
        'public.backup_generation_publication'::regclass);`),
      't',
    );
    assert.equal(
      ok(`SELECT bool_and(prosecdef AND proconfig=ARRAY['search_path=pg_catalog'])
      FROM pg_proc WHERE oid IN ('public.publish_backup_generation(text,bigint,integer,text)'::regprocedure,
        'public.reserve_backup_generation_sequence(text)'::regprocedure);`),
      't',
    );
    assert.equal(
      ok(`SELECT has_function_privilege('anon','public.publish_backup_generation(text,bigint,integer,text)','EXECUTE')
      OR has_function_privilege('anon','public.reserve_backup_generation_sequence(text)','EXECUTE')
      OR has_function_privilege('authenticated','public.backup_generation_canonical_rows(json)','EXECUTE')
      OR has_table_privilege('authenticated','public.backup_generation_publication','INSERT')
      OR has_table_privilege('authenticated','public.backup_generation_sequence_reservation','INSERT');`),
      'f',
    );
    checks.push('RLS enabled and privileged RPC/helper grants constrained');
    rejected(
      'authenticated role without owner refused',
      `SET ROLE authenticated;
      SELECT public.reserve_backup_generation_sequence('ownerless');`,
      null,
      /requires an authenticated owner/,
    );
    assert.equal(reserve('g1'), 1);
    assert.equal(reserve('g1'), 1);
    assert.equal(reserve('g2'), 2);
    checks.push('fresh owner allocation and lost-response reservation retry');
    const reservations = await Promise.all(
      ['reserve_a', 'reserve_b'].map((id) =>
        sqlAsync(`SELECT public.reserve_backup_generation_sequence(${literal(id)});`),
      ),
    );
    for (const result of reservations) assert.equal(result.status, 0, result.stderr);
    const values = reservations.map((result) => Number(result.stdout.trim().split(/\r?\n/).at(-1)));
    assert.equal(new Set(values).size, 2);
    checks.push('concurrent same-owner reservations unique');

    const g1 = await productionGeneration('g1', 1, {
      todos: [
        validTodo('todo_01', { title: 'Coffee ☕ "quoted"', notes: 'line\nbreak' }),
        validTodo('todo_02', { title: 'Later' }),
      ],
    });
    const g2 = await productionGeneration('g2', 2, {
      todos: Array.from({ length: 251 }, (_, index) =>
        validTodo(`todo_${String(index).padStart(4, '0')}`, { title: `Boundary ${index}` }),
      ),
    });
    checks.push('actual production capture bytes use the server contract');
    rejected(
      'unreserved sequence cannot seize another reservation',
      metadataSql(generation('unreserved', 1)),
    );
    upload(g1);
    ok(metadataSql(g1), ownerA);
    for (const chunk of g1.chunks) ok(chunkSql(g1, chunk), ownerA);
    checks.push('identical metadata and chunk upsert retries accepted');
    rejected(
      'changed chunk bytes refused',
      chunkSql(g1, { ...g1.chunks[0], payload: '[{}]', checksum: sha('[{}]') }),
    );
    assert.equal(ok(publishSql(g1, 0), ownerA), 'g1:1');
    assert.equal(ok(publishSql(g1, 0), ownerA), 'g1:1');
    checks.push('verified first publication and lost-ack retry');
    for (const chunk of g1.chunks) ok(chunkSql(g1, chunk), ownerA);
    checks.push('published identical chunk retry accepted');
    rejected('published append refused', chunkSql(g1, { ...g1.chunks[0], ordinal: 9 }));
    rejected(
      'chunk identity reassignment refused',
      `UPDATE public.backup_generation_chunk
      SET entity='habits' WHERE snapshot_id='g1' AND entity='todos';`,
    );
    rejected(
      'metadata identity reassignment refused',
      `UPDATE public.backup_generation
      SET snapshot_id='rewritten' WHERE snapshot_id='g1';`,
    );
    rejected(
      'direct head write refused',
      `INSERT INTO public.backup_generation_head(user_id,snapshot_id,sequence)
      VALUES(${literal(ownerA)},'g2',2) ON CONFLICT(user_id) DO UPDATE SET snapshot_id='g2',sequence=2;`,
    );
    rejected(
      'retained content deletion refused',
      `DELETE FROM public.backup_generation WHERE snapshot_id='g1';`,
    );
    rejected(
      'retained chunk deletion refused',
      `DELETE FROM public.backup_generation_chunk WHERE snapshot_id='g1';`,
    );
    assert.equal(ok('SELECT count(*) FROM public.backup_generation;', ownerB), '0');
    assert.equal(ok('SELECT count(*) FROM public.backup_generation_chunk;', ownerB), '0');
    assert.equal(ok('SELECT count(*) FROM public.backup_generation_head;', ownerB), '0');
    checks.push('cross-owner content and head invisible');
    rejected('cross-owner upload refused', chunkSql(g1, g1.chunks[0]), ownerB);
    rejected(
      'cross-owner publication refused',
      publishSql(g1, 0),
      ownerB,
      /does not exist for this owner/,
    );
    rejected(
      'anonymous publication refused',
      "SET ROLE anon; SELECT public.publish_backup_generation('g1',0,2,repeat('a',64));",
      null,
    );

    async function negative(name, mutate, adjust = null) {
      const id = `bad_${checks.length}`;
      const g = generation(id, reserve(id), { mutate });
      if (adjust) adjust(g);
      upload(g);
      rejected(name, publishSql(g, 1));
      assert.equal(ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA), 'g1');
    }
    await negative(
      'fabricated manifest checksum refused',
      () => {},
      (g) => {
        g.checksum = 'f'.repeat(64); // Both stored and caller checksums agree, but are false.
      },
    );
    await negative(
      'manifest empty object refused',
      () => {},
      (g) => {
        g.manifest = '{}';
        g.checksum = sha('{}');
      },
    );
    await negative('entity rowcount mismatch refused', (item) => {
      item.entities.todos.rows += 1;
    });
    await negative('entity checksum mismatch refused', (item) => {
      item.entities.todos.checksum = 'a'.repeat(64);
    });
    await negative('chunk checksum mismatch refused', (_item, chunks) => {
      chunks[0].checksum = 'a'.repeat(64);
    });
    await negative('missing ordinal refused', (_item, chunks) => {
      chunks[0].ordinal = 1;
    });
    await negative('incomplete chunk set refused', (_item, chunks) => {
      chunks.shift();
    });
    await negative('unknown entity refused', (_item, chunks) => {
      chunks.push({ entity: 'unknown', ordinal: 0, payload: '[]', checksum: sha('[]') });
    });
    await negative('unsupported scope refused', (item) => {
      item.scopeVersion = 8;
    });
    await negative('missing entity scope refused', (item) => {
      delete item.entities.habits;
    });
    await negative('settings bytes checksum mismatch refused', (_item, chunks) => {
      chunks.at(-1).payload = '{}';
    });
    await negative('settings manifest checksum mismatch refused', (item) => {
      item.settingsChecksum = 'b'.repeat(64);
    });
    await negative('missing settings version refused', (item) => {
      delete item.settingsVersion;
    });
    await negative('manifest sequence mismatch refused', (item) => {
      item.sequence += 1;
    });
    const duplicate = generation('duplicate_ids', reserve('duplicate_ids'), {
      rows: { todos: [validTodo('todo_1'), validTodo('todo_1')] },
    });
    upload(duplicate);
    rejected('duplicate row identity refused', publishSql(duplicate, 1));
    const orphan = generation('orphan', reserve('orphan'), {
      rows: {
        habit_completions: [
          {
            id: 'hcmp_1',
            habit_id: 'habit_1',
            date_key: '2026-10-20',
            count: 1,
            created_at: timestamp,
            updated_at: timestamp,
          },
        ],
      },
    });
    upload(orphan);
    rejected('orphan relationship refused', publishSql(orphan, 1));

    // These payloads have correct wire checksums. Publication must also reject
    // content the actual Restore validators cannot import.
    async function semanticNegative(name, rows, settings = validSettings) {
      const id = `semantic_${checks.length}`;
      const g = generation(id, reserve(id), { rows });
      const c = g.chunks.find((chunk) => chunk.entity === 'user_backup_settings');
      c.payload = JSON.stringify(settings);
      c.checksum = sha(c.payload);
      g.item.settingsChecksum = c.checksum;
      g.item.entities.user_backup_settings.checksum = c.checksum;
      g.manifest = canonicalRows([g.item]);
      g.checksum = sha(g.manifest);
      upload(g);
      rejected(name, publishSql(g, 1));
      assert.equal(ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA), 'g1');
    }
    const missing = validTodo('todo_1');
    delete missing.completed;
    await semanticNegative('missing required Todo field refused', { todos: [missing] });
    await semanticNegative(
      'invalid settings theme type refused',
      { todos: [validTodo('todo_1')] },
      { theme: 'light' },
    );
    await semanticNegative('invalid settings goal type refused', {}, { calorieGoal: 10 });
    await semanticNegative('wrong Todo field type refused', {
      todos: [validTodo('todo_1', { completed: '0' })],
    });
    await semanticNegative('invalid Todo enum refused', {
      todos: [validTodo('todo_1', { priority: 'unknown' })],
    });
    await semanticNegative('unknown recovery column refused', {
      todos: [validTodo('todo_1', { secret: 1 })],
    });
    await semanticNegative('negative Todo ordinal refused', {
      todos: [validTodo('todo_1', { sort_order: -1 })],
    });
    await semanticNegative('UTF-16 overlong title refused', {
      todos: [validTodo('todo_1', { title: '😀'.repeat(251) })],
    });
    const base = { created_at: timestamp, updated_at: timestamp, deleted_at: null };
    const routine = { id: 'wrk_1', name: 'Routine', description: null, ...base };
    const exercise = {
      id: 'ex_1',
      routine_id: 'wrk_1',
      name: 'Exercise',
      sort_order: 0,
      catalog_exercise_id: 'cex_1',
      ...base,
    };
    await semanticNegative('missing custom catalog parent refused', {
      workout_routines: [routine],
      routine_exercises: [exercise],
    });
    const plan = {
      id: 'dplan_1',
      date_key: '2026-10-20',
      intention: null,
      top_todo_ids: '["todo_1"]',
      focus_target_minutes: 0,
      notes: null,
      reflection: null,
      energy_score: null,
      status: 'draft',
      completed_at: null,
      ...base,
    };
    await semanticNegative('daily plan missing Todo parent refused', { daily_plans: [plan] });
    const meal = {
      id: 'smeal_1',
      food_name: 'Meal',
      calories: 1,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      meal_type: 'snack',
      use_count: 0,
      last_used_at: timestamp,
      created_at: timestamp,
    };
    await semanticNegative('case-insensitive duplicate saved meal refused', {
      saved_meals: [meal, { ...meal, id: 'smeal_2', food_name: 'MEAL' }],
    });
    const weekly = {
      id: 'wplan_1',
      weekday: 1,
      routine_id: null,
      plan_kind: 'rest',
      note: null,
      ...base,
    };
    await semanticNegative('duplicate active workout weekday refused', {
      workout_weekly_plan: [weekly, { ...weekly, id: 'wplan_2' }],
    });
    const override = {
      id: 'wover_1',
      date_key: '2026-10-20',
      routine_id: null,
      override_kind: 'rest',
      moved_from_date_key: null,
      note: null,
      ...base,
    };
    await semanticNegative('duplicate active workout date refused', {
      workout_schedule_overrides: [override, { ...override, id: 'wover_2' }],
    });
    const habit = {
      id: 'habit_1',
      name: 'Habit',
      target_per_day: 1,
      reminder_time: null,
      category: 'anytime',
      icon: 'check-circle',
      color: '#fff',
      rule_history: '[]',
      ...base,
    };
    const completion = {
      id: 'hcmp_1',
      habit_id: 'habit_1',
      date_key: '2026-10-20',
      count: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await semanticNegative('duplicate habit date refused', {
      habits: [habit],
      habit_completions: [completion, { ...completion, id: 'hcmp_2' }],
    });
    await semanticNegative('malformed habit rules refused', {
      habits: [
        {
          ...habit,
          rule_history: '[{"effective_from_date":"2026-10-20","weekdays":[8],"target_per_day":1}]',
        },
      ],
    });
    await semanticNegative('malformed habit lifecycle refused', {
      habits: [
        { ...habit, lifecycle_history: '[{"from_date_key":"2026-10-20","to_date_key":null}]' },
      ],
    });

    await semanticNegative('entity chunk UTF-8 byte budget enforced', {
      todos: Array.from({ length: 14 }, (_, i) =>
        validTodo('todo_' + String(i).padStart(3, '0'), { notes: 'n'.repeat(10000) }),
      ),
    });
    await semanticNegative(
      'settings chunk UTF-8 byte budget enforced',
      {},
      { ...validSettings, extra: 'x'.repeat(131072) },
    );
    const variable = generation('variable_chunks', reserve('variable_chunks'), {
      rows: { todos: [validTodo('todo_1'), validTodo('todo_2'), validTodo('todo_3')] },
    });
    const originalChunk = variable.chunks.find((c) => c.entity === 'todos');
    const threeRows = JSON.parse(originalChunk.payload);
    const split = [threeRows.slice(0, 2), threeRows.slice(2)].map((rows, ordinal) => {
      const payload = canonicalRows(rows);
      return { entity: 'todos', ordinal, payload, checksum: sha(payload) };
    });
    variable.chunks = [...split, ...variable.chunks.filter((c) => c.entity !== 'todos')];
    ok(
      'BEGIN;' +
        metadataSql(variable) +
        variable.chunks.map((c) => chunkSql(variable, c)).join('') +
        publishSql(variable, 1) +
        'ROLLBACK;',
      ownerA,
    );
    checks.push('variable-size bounded 2+1 row chunks preserve ordinal/count/checksum integrity');

    // A complete positive corpus reaches every entity's domain validator, not
    // merely empty-entity hashes. Validate these same rows with actual TS above.
    const project = {
      id: 'proj_1',
      name: 'Project',
      description: null,
      color: '#fff',
      status: 'active',
      target_date: null,
      sort_order: 0,
      completed_at: null,
      ...base,
    };
    const goal = {
      id: 'goal_1',
      project_id: 'proj_1',
      title: 'Goal',
      description: null,
      horizon: 'week',
      target_date: null,
      status: 'active',
      progress_percent: 0,
      completed_at: null,
      ...base,
    };
    const coherentRows = {
      todos: [validTodo('todo_1', { project_id: 'proj_1', goal_id: 'goal_1' })],
      habits: [habit],
      habit_completions: [completion],
      calorie_entries: [validCalorie('cal_1')],
      saved_meals: [meal],
      workout_routines: [routine],
      routine_exercises: [exercise],
      routine_exercise_sets: [
        {
          id: 'eset_1',
          exercise_id: 'ex_1',
          set_number: 1,
          active_seconds: 0,
          rest_seconds: 0,
          ...base,
        },
      ],
      workout_logs: [
        {
          id: 'wrk_2',
          routine_id: 'wrk_1',
          notes: null,
          completed_at: timestamp,
          created_at: timestamp,
        },
      ],
      workout_session_exercises: [
        {
          id: 'wsex_1',
          log_id: 'wrk_2',
          exercise_name: 'Exercise',
          sets_completed: 1,
          created_at: timestamp,
        },
      ],
      workout_session_sets: [
        {
          id: 'sset_1',
          session_exercise_id: 'wsex_1',
          set_number: 1,
          weight: null,
          reps: null,
          weight_unit: null,
          completed: 1,
          created_at: timestamp,
        },
      ],
      pomodoro_sessions: [
        {
          id: 'pom_1',
          started_at: timestamp,
          ended_at: timestamp,
          duration_seconds: 0,
          session_type: 'focus',
          created_at: timestamp,
        },
      ],
      linked_action_rules: [
        {
          id: 'link_1',
          status: 'active',
          direction_policy: 'one_way',
          bidirectional_group_id: null,
          source_feature: 'todos',
          source_entity_type: 'todo',
          source_entity_id: 'todo_1',
          trigger_type: 'todo.completed',
          target_feature: 'habits',
          target_entity_type: 'habit',
          target_entity_id: 'habit_1',
          effect_type: 'habit.increment',
          effect_payload: '{}',
          ...base,
        },
      ],
      weekly_reviews: [
        {
          id: 'wrev_1',
          week_key: '2026-W43',
          week_start_date: '2026-10-19',
          week_end_date: '2026-10-25',
          next_week_start_date: '2026-10-26',
          completed_at: null,
          status: 'draft',
          summary_payload: '{}',
          plan_payload: '{}',
          reflection: '',
          ...base,
        },
      ],
      projects: [project],
      goals: [goal],
      daily_plans: [plan],
      custom_exercises: [
        {
          id: 'cex_1',
          name: 'Exercise',
          description: null,
          primary_area: 'chest',
          secondary_areas: '[]',
          equipment: null,
          modality: 'weighted_strength',
          unilateral: 0,
          ...base,
        },
      ],
      workout_weekly_plan: [weekly],
      workout_schedule_overrides: [override],
      body_weight_entries: [
        {
          id: 'bw_1',
          measured_on: '2026-10-20',
          measured_at: timestamp,
          weight: 80,
          unit: 'kg',
          note: null,
          ...base,
        },
      ],
    };
    const complete = await productionGeneration(
      'domain_complete',
      reserve('domain_complete'),
      coherentRows,
    );
    ok(
      'BEGIN;' +
        metadataSql(complete) +
        complete.chunks.map((c) => chunkSql(complete, c)).join('') +
        publishSql(complete, 1) +
        'ROLLBACK;',
      ownerA,
    );
    checks.push(
      'all 21 entity row/graph validators accept the actual TypeScript-validated positive corpus',
    );
    const fieldCounterexamples = [];
    for (const [entity, values] of Object.entries(coherentRows))
      for (const row of values) {
        for (const key of Object.keys(row))
          for (const mode of ['missing', 'null', 'wrong-type']) {
            const mutant = { ...row };
            if (mode === 'missing') delete mutant[key];
            else
              mutant[key] =
                mode === 'null' ? null : typeof row[key] === 'string' ? 123 : { invalid: true };
            if (!complete.validateBackupRow(entity, mutant).ok)
              fieldCounterexamples.push({ entity, mutant, key, mode });
          }
      }
    // Compare independently against the actual TS validator, not a duplicate
    // descriptor evaluator. Bundle safe helper calls in one owner-only DO block.
    ok(
      'DO $parity$ BEGIN ' +
        fieldCounterexamples
          .map(
            ({ entity, mutant, key, mode }) =>
              'BEGIN PERFORM public.backup_generation_validate_row(' +
              literal(entity) +
              ',' +
              literal(JSON.stringify(mutant)) +
              '::jsonb); ' +
              'RAISE EXCEPTION ' +
              literal('TS-invalid row accepted by SQL: ' + entity + '.' + key + ' ' + mode) +
              '; ' +
              'EXCEPTION WHEN check_violation THEN NULL; END;',
          )
          .join('') +
        ' END $parity$;',
    );
    checks.push(
      'actual TypeScript-invalid missing/null/type counterexamples refused by SQL (' +
        fieldCounterexamples.length +
        ' cases)',
    );

    upload(g2);
    assert.equal(ok(publishSql(g2, 1), ownerA), 'g2:2');
    checks.push('251-row entity verifies across the 250-row chunk boundary');
    rejected('old lost-ack retry cannot regress newer head', publishSql(g1, 0));
    assert.equal(
      ok(
        "SELECT count(*) FROM public.backup_generation_publication WHERE snapshot_id IN ('g1','g2');",
        ownerA,
      ),
      '2',
    );
    assert.equal(
      ok(
        "SELECT payload FROM public.backup_generation_chunk WHERE snapshot_id='g1' AND entity='todos';",
        ownerA,
      ),
      g1.chunks[0].payload,
    );
    checks.push('current and previous complete recovery bytes retained');
    const contenders = ['race_a', 'race_b'].map((id) => generation(id, reserve(id)));
    contenders.forEach((g) => upload(g));
    const raced = await Promise.all(contenders.map((g) => sqlAsync(publishSql(g, 2))));
    assert.equal(raced.filter((result) => result.status === 0).length, 1, JSON.stringify(raced));
    checks.push('same-owner publication CAS race has exactly one winner');
    const previous = Number(ok('SELECT sequence FROM public.backup_generation_head;', ownerA));
    const empty = await productionGeneration('empty_complete', reserve('empty_complete'));
    upload(empty);
    assert.equal(ok(publishSql(empty, previous), ownerA), `empty_complete:${empty.sequence}`);
    checks.push('complete empty entity scope with settings publishes');

    // A different owner has no head yet. Two first publishers must serialize too.
    const firstContenders = ['first_a', 'first_b'].map((id) => generation(id, reserve(id, ownerB)));
    firstContenders.forEach((g) => upload(g, ownerB));
    const firstRace = await Promise.all(
      firstContenders.map((g) => sqlAsync(publishSql(g, 0), ownerB)),
    );
    assert.equal(
      firstRace.filter((result) => result.status === 0).length,
      1,
      JSON.stringify(firstRace),
    );
    checks.push('first-head publication race has exactly one winner');

    // Apply the current additive chain only AFTER the historical predecessor
    // controls. A minimal pre-existing feature-table shell is sufficient for
    // the additive ALTER; row bytes below still come from the real serializer.
    ok('CREATE TABLE public.todos (id text PRIMARY KEY, user_id uuid);');
    ok('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated,anon;');
    for (const file of [
      '20261020090000_enforce_backup_publication_provenance.sql',
      '20261115090000_add_recoverable_todo_recurrence.sql',
      '20261115100000_add_recurring_spawn_provenance.sql',
      '20261123140000_add_reward_snapshot_scope.sql',
    ]) {
      ok(fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8'));
      migrations.push(file);
    }
    assert.deepEqual(JSON.parse(ok('SELECT public.backup_generation_capabilities();', ownerA)), {
      protocol_version: 2,
      publication_provenance_version: 1,
      content_verification_version: 1,
      sequence_reservation_version: 1,
      backup_schema_version: 2,
      scope_version: 10,
      settings_version: 5,
    });
    assert.equal(
      ok(
        "SELECT relrowsecurity FROM pg_class WHERE oid='public.todo_recurrence_series'::regclass;",
      ),
      't',
    );
    assert.equal(
      ok(
        "SELECT has_table_privilege('authenticated','public.todo_recurrence_series','TRUNCATE') OR has_table_privilege('anon','public.todo_recurrence_series','SELECT');",
      ),
      'f',
    );
    assert.equal(
      ok(
        "SELECT bool_and(prosecdef AND proconfig=ARRAY['search_path=pg_catalog']) FROM pg_proc WHERE oid IN ('public.publish_backup_generation(text,bigint,integer,text,integer)'::regprocedure,'public.backup_generation_publish_v1(text,bigint,integer,text)'::regprocedure);",
      ),
      't',
    );
    checks.push(
      'Scope-10 capability, series RLS/ACL reset, and unchanged pinned provenance wrapper',
    );
    ok(
      `INSERT INTO public.todo_recurrence_series(id,title,created_at,updated_at) VALUES('rec_owned','Series',${literal(timestamp)},${literal(timestamp)});`,
      ownerA,
    );
    assert.equal(ok('SELECT count(*) FROM public.todo_recurrence_series;', ownerB), '0');
    rejected(
      'series owner cannot transfer its row',
      `UPDATE public.todo_recurrence_series SET user_id=${literal(ownerB)} WHERE id='rec_owned';`,
    );
    rejected('series owner cannot truncate the table', 'TRUNCATE public.todo_recurrence_series;');
    rejected(
      'unauthenticated series read refused',
      'SET ROLE anon; SELECT * FROM public.todo_recurrence_series;',
      null,
      /permission denied/,
    );
    rejected(
      'private content verifier remains inaccessible',
      "SELECT public.backup_generation_publish_v1('none',0,1,repeat('a',64));",
      ownerA,
      /permission denied for function/,
    );

    let currentHead = JSON.parse(
      ok(
        "SELECT json_build_object('snapshotId',snapshot_id,'sequence',sequence) FROM public.backup_generation_head;",
        ownerA,
      ),
    );
    const reserveCurrent = (id) =>
      Number(
        ok(
          `SELECT public.reserve_backup_generation_sequence(${literal(id)},${literal(currentHead.snapshotId)},${currentHead.sequence},1);`,
          ownerA,
        ),
      );
    const uploadCurrent = (g) => {
      const base = g.capture ?? {
        baseHeadSnapshotId: currentHead.snapshotId,
        baseHeadSequence: currentHead.sequence,
      };
      ok(
        `INSERT INTO public.backup_generation(user_id,snapshot_id,sequence,protocol_version,backup_schema_version,scope_version,settings_version,manifest,manifest_checksum,captured_at,base_head_snapshot_id,base_head_sequence,publication_provenance_version)
        VALUES(${literal(ownerA)},${literal(g.snapshotId)},${g.sequence},1,2,${g.item.scopeVersion},5,${literal(g.manifest)},${literal(g.checksum)},${literal(g.item.capturedAt)},${literal(base.baseHeadSnapshotId)},${base.baseHeadSequence},1);`,
        ownerA,
      );
      for (const chunk of g.chunks) ok(chunkSql(g, chunk), ownerA);
    };
    const publishCurrent = (g) =>
      `SELECT snapshot_id || ':' || sequence FROM public.publish_backup_generation(${literal(g.snapshotId)},${currentHead.sequence},${g.chunks.length},${literal(g.checksum)},1);`;
    const series = {
      id: 'rec_1',
      title: 'Canonical series',
      notes: 'Series notes',
      priority: 'normal',
      ...base,
    };
    const currentRows = {
      ...coherentRows,
      todo_recurrence_series: [series],
      todos: [
        validTodo('todo_1', {
          title: 'Only today',
          priority: 'urgent',
          recurrence: 'daily',
          recurrence_id: 'rec_1',
          due_date: '2026-10-20',
          recurrence_date_key: '2026-10-19',
          recurrence_touched: 1,
          project_id: 'proj_1',
          goal_id: 'goal_1',
          completed: 1,
          completed_at: timestamp,
        }),
        validTodo('todo_2', {
          title: 'Completion-created copy',
          recurrence: 'daily',
          recurrence_id: 'rec_1',
          due_date: '2026-10-21',
          recurrence_date_key: '2026-10-21',
          recurrence_touched: 0,
          recurrence_spawned_by_id: 'todo_1',
        }),
      ],
      weekly_reviews: [
        {
          ...coherentRows.weekly_reviews[0],
          reflection: 'r'.repeat(4000),
          summary_payload: JSON.stringify({ note: 's'.repeat(2000) }),
          plan_payload: JSON.stringify({ note: 'p'.repeat(2000) }),
        },
      ],
      daily_plans: [
        {
          ...plan,
          reflection: 'r'.repeat(2000),
          top_todo_titles: JSON.stringify([
            '\u0001'.repeat(200),
            '\u0002'.repeat(200),
            '\u0003'.repeat(200),
          ]),
        },
      ],
    };
    const modern = await productionGeneration(
      'scope9_complete',
      reserveCurrent('scope9_complete'),
      currentRows,
      9,
      currentHead,
    );
    assert.equal(modern.capture.baseHeadSnapshotId, currentHead.snapshotId);
    assert.equal(modern.capture.baseHeadSequence, currentHead.sequence);
    uploadCurrent(modern);
    assert.equal(ok(publishCurrent(modern), ownerA), `scope9_complete:${modern.sequence}`);
    currentHead = { snapshotId: modern.snapshotId, sequence: modern.sequence };
    assert.equal(ok(publishCurrent(modern), ownerA), `scope9_complete:${modern.sequence}`);
    checks.push(
      'actual Scope-9 22-entity capture publishes with exact spawn links, original occurrence metadata and full valid review limits',
    );

    const invalidCurrent = [
      [
        'missing completion-spawn parent',
        {
          todo_recurrence_series: [series],
          todos: [{ ...currentRows.todos[1], recurrence_spawned_by_id: 'todo_999' }],
        },
        null,
        /missing or self completion-spawn parent/,
      ],
      [
        'self completion-spawn parent',
        {
          todo_recurrence_series: [series],
          todos: [{ ...currentRows.todos[1], recurrence_spawned_by_id: 'todo_2' }],
        },
        null,
        /missing or self completion-spawn parent/,
      ],
      [
        'malformed completion-spawn parent id',
        {
          todo_recurrence_series: [series],
          todos: [{ ...currentRows.todos[1], recurrence_spawned_by_id: '' }],
        },
        null,
        /invalid recovery field/,
      ],
      [
        'missing series parent',
        { todos: [{ ...currentRows.todos[0], project_id: null, goal_id: null }] },
        null,
        /missing recurring-series parent/,
      ],
      [
        'invalid occurrence date',
        {
          todo_recurrence_series: [series],
          todos: [
            {
              ...currentRows.todos[0],
              project_id: null,
              goal_id: null,
              recurrence_date_key: '2026-02-30',
            },
          ],
        },
        null,
        /invalid recovery field/,
      ],
      [
        'invalid occurrence provenance',
        {
          todo_recurrence_series: [series],
          todos: [
            { ...currentRows.todos[0], project_id: null, goal_id: null, recurrence_touched: 2 },
          ],
        },
        null,
        /invalid recovery field/,
      ],
      [
        'corrupt entity checksum',
        {},
        (item) => {
          item.entities.todos.checksum = 'a'.repeat(64);
        },
        /entity row count or checksum mismatch/,
      ],
    ];
    for (const [name, rows, mutate, pattern] of invalidCurrent) {
      const id = `scope9_bad_${checks.length}`;
      const bad = generation(id, reserveCurrent(id), { scopeVersion: 9, rows, mutate });
      uploadCurrent(bad);
      rejected(name, publishCurrent(bad), ownerA, pattern);
      assert.equal(
        ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA),
        modern.snapshotId,
      );
    }
    // A preserved old recovery point still carries precisely Scope-7 bytes,
    // not fabricated Scope-8 series rows from this device's unrelated state.
    const preserved = await productionGeneration(
      'scope7_preserved',
      reserveCurrent('scope7_preserved'),
      coherentRows,
      7,
      currentHead,
    );
    assert.equal(preserved.item.scopeVersion, 7);
    assert.ok(!('todo_recurrence_series' in preserved.item.entities));
    uploadCurrent(preserved);
    assert.equal(ok(publishCurrent(preserved), ownerA), `scope7_preserved:${preserved.sequence}`);
    currentHead = { snapshotId: preserved.snapshotId, sequence: preserved.sequence };
    const forgedId = 'scope7_uncertified_fields';
    const forged = generation(forgedId, reserveCurrent(forgedId), {
      rows: { todos: [validTodo('todo_1', { recurrence_touched: 1 })] },
    });
    uploadCurrent(forged);
    rejected(
      'Scope-7 cannot smuggle unchecksummed Scope-8 occurrence fields',
      publishCurrent(forged),
      ownerA,
      /scope 7 cannot certify scope 8/,
    );
    const scope8Rows = {
      ...currentRows,
      todos: currentRows.todos.map(({ recurrence_spawned_by_id: _link, ...row }) => row),
    };
    const preserved8 = await productionGeneration(
      'scope8_preserved',
      reserveCurrent('scope8_preserved'),
      scope8Rows,
      8,
      currentHead,
    );
    assert.equal(preserved8.item.scopeVersion, 8);
    assert.ok(
      preserved8.chunks
        .filter((c) => c.entity === 'todos')
        .every((c) => !c.payload.includes('recurrence_spawned_by_id')),
    );
    uploadCurrent(preserved8);
    assert.equal(ok(publishCurrent(preserved8), ownerA), `scope8_preserved:${preserved8.sequence}`);
    currentHead = { snapshotId: preserved8.snapshotId, sequence: preserved8.sequence };
    checks.push('frozen Scope-8 capture preserves its bytes without inventing Scope-9 spawn links');
    const forged8Id = 'scope8_uncertified_spawn_link';
    const forged8 = generation(forged8Id, reserveCurrent(forged8Id), {
      scopeVersion: 8,
      rows: { todos: [validTodo('todo_1', { recurrence_spawned_by_id: null })] },
    });
    uploadCurrent(forged8);
    rejected(
      'Scope-8 cannot smuggle Scope-9 completion metadata',
      publishCurrent(forged8),
      ownerA,
      /historical scope cannot certify scope 9/,
    );
    assert.equal(
      ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA),
      preserved8.snapshotId,
    );
    assert.equal(
      ok(
        "SELECT count(*) FROM public.backup_generation_publication WHERE snapshot_id IN ('scope9_complete','scope7_preserved','scope8_preserved');",
        ownerA,
      ),
      '3',
    );
    checks.push(
      'historical Scope-7/8 preservation remains publishable without rewriting current recovery bytes',
    );

    const rewardRows = {
      ...currentRows,
      gamification_events: [
        {
          id: 'gxp_1792195200000_abcdef12',
          event_kind: 'freeze_grant',
          source_key: 'freeze:7',
          xp: 0,
          date_key: '2026-10-17',
          created_at: timestamp,
        },
      ],
      gamification_streak_freezes: [
        {
          id: '2026-10-18',
          date_key: '2026-10-18',
          saved_at: timestamp,
        },
      ],
      gamification_quests: [
        {
          id: '2026-10-17:focus_sprint',
          date_key: '2026-10-17',
          quest_id: 'focus_sprint',
          completed_at: timestamp,
        },
      ],
      gamification_badges: [
        {
          id: 'focus:1',
          badge_id: 'focus:1',
          family: 'focus',
          tier: 1,
          unlocked_at: timestamp,
          date_key: '2026-10-17',
        },
      ],
    };
    const rewards = await productionGeneration(
      'scope10_rewards',
      reserveCurrent('scope10_rewards'),
      rewardRows,
      10,
      currentHead,
    );
    uploadCurrent(rewards);
    assert.equal(ok(publishCurrent(rewards), ownerA), `scope10_rewards:${rewards.sequence}`);
    currentHead = { snapshotId: rewards.snapshotId, sequence: rewards.sequence };
    assert.equal(
      ok(
        "SELECT count(*) FROM public.backup_generation_chunk WHERE entity LIKE 'gamification_%';",
        ownerA,
      ),
      '4',
    );
    assert.equal(
      ok(
        "SELECT count(*) FROM public.backup_generation_chunk WHERE entity LIKE 'gamification_%';",
        ownerB,
      ),
      '0',
    );
    checks.push('Scope 10 production capture publishes four owner-scoped reward streams');

    const badRewardCases = [
      [
        'negative freeze XP',
        { gamification_events: [{ ...rewardRows.gamification_events[0], xp: -1 }] },
        /invalid reward row/,
      ],
      [
        'mismatched freeze key',
        {
          gamification_streak_freezes: [
            { ...rewardRows.gamification_streak_freezes[0], id: '2026-10-17' },
          ],
        },
        /invalid reward row/,
      ],
      [
        'duplicate reward receipt',
        {
          gamification_events: [
            ...rewardRows.gamification_events,
            { ...rewardRows.gamification_events[0], id: 'gxp_1792195200001_abcdef12' },
          ],
        },
        /duplicate recovery unique key/,
      ],
      [
        'broken Scope 9 spawn parent in Scope 10',
        {
          todos: [
            validTodo('todo_1792195200000_abcdef12', {
              recurrence_spawned_by_id: 'todo_1792195200001_abcdef12',
            }),
          ],
        },
        /missing or self completion-spawn parent/,
      ],
    ];
    for (const [name, patch, pattern] of badRewardCases) {
      const id = `scope10_bad_${checks.length}`;
      const bad = generation(id, reserveCurrent(id), {
        scopeVersion: 10,
        rows: { ...rewardRows, ...patch },
      });
      uploadCurrent(bad);
      rejected(name, publishCurrent(bad), ownerA, pattern);
      assert.equal(
        ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA),
        rewards.snapshotId,
      );
    }

    const mealSnapshotId = 'scope10_unicode_meal_names';
    const unicodeMeals = await productionGeneration(
      mealSnapshotId,
      reserveCurrent(mealSnapshotId),
      {
        ...rewardRows,
        saved_meals: [
          { ...meal, food_name: 'Éclair' },
          { ...meal, id: 'smeal_2', food_name: 'éclair' },
        ],
      },
      10,
      currentHead,
    );
    uploadCurrent(unicodeMeals);
    rejected(
      'predecessor verifier rejects SQLite-distinct Unicode meal names',
      publishCurrent(unicodeMeals),
      ownerA,
      /duplicate recovery unique key/,
    );

    const mealIdentityMigration = '20261127080000_fix_backup_generation_saved_meal_identity.sql';
    ok(fs.readFileSync(path.join(root, 'supabase/migrations', mealIdentityMigration), 'utf8'));
    migrations.push(mealIdentityMigration);
    assert.equal(
      ok('SELECT snapshot_id FROM public.backup_generation_head;', ownerA),
      currentHead.snapshotId,
    );
    assert.equal(
      ok(`SELECT has_function_privilege('authenticated',
           'public.backup_generation_publish_v1(text,bigint,integer,text)', 'EXECUTE')
        OR has_function_privilege('anon',
           'public.backup_generation_publish_v1(text,bigint,integer,text)', 'EXECUTE');`),
      'f',
    );
    const duplicateMealId = 'scope10_ascii_duplicate_meal';
    const asciiDuplicate = generation(duplicateMealId, reserveCurrent(duplicateMealId), {
      scopeVersion: 10,
      rows: { saved_meals: [meal, { ...meal, id: 'smeal_2', food_name: 'MEAL' }] },
    });
    uploadCurrent(asciiDuplicate);
    rejected(
      'successor verifier still rejects ASCII case duplicates',
      publishCurrent(asciiDuplicate),
      ownerA,
      /duplicate recovery unique key/,
    );
    assert.equal(
      ok(publishCurrent(unicodeMeals), ownerA),
      `${unicodeMeals.snapshotId}:${unicodeMeals.sequence}`,
    );
    checks.push('Scope 10 accepts saved-meal names which SQLite NOCASE treats as distinct');

    const report = {
      passed: checks.length,
      checks,
      migrations,
      evidence,
      postgres: ok('SHOW server_version;'),
      limitations: [
        'Local PostgreSQL uses a minimal auth.uid()/role shim; hosted Auth/PostgREST and deployment remain separate qualification.',
        'The feature-table ALTER shell and Unicode fixture verify immutable publication. Mutable saved-meal index behavior requires separate qualification.',
      ],
    };
    fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    return report;
  } finally {
    if (started || child) {
      const stopped = spawnSync(
        exe('pg_ctl'),
        ['-D', data, '-m', 'fast', '-w', '-t', '15', 'stop'],
        { encoding: 'utf8', windowsHide: true, timeout: 20000 },
      );
      if (stopped.status !== 0 && child?.exitCode === null) {
        child.kill();
        throw new Error(
          `Disposable PostgreSQL shutdown failed: ${stopped.stderr}; evidence ${evidence}`,
        );
      }
    }
    fs.closeSync(log);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = process.argv.indexOf('--pg-bin');
  const report = await qualifyBackupGenerations({
    pgBin: option >= 0 ? process.argv[option + 1] : undefined,
  });
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
