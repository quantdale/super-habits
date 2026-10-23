import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sql = fs.readFileSync(new URL('./cloud-readonly-preflight.sql', import.meta.url), 'utf8');
const withoutComments = (source) => source.replace(/--[^\n]*/g, '');

// This is a source guard, not a PostgreSQL parser or hosted certification.
function assertInspectionOnly(source) {
  const text = withoutComments(source);
  assert.match(text, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;/);
  assert.match(text, /ROLLBACK;\s*$/);
  const statements = text.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(
    statements,
    /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COMMIT|CALL|DO|COPY)\b/i,
  );
  assert.doesNotMatch(text, /\\(?:!|i\b|ir\b|o\b|out\b|gexec\b|copy\b|connect\b|c\b)/i);
  assert.doesNotMatch(text, /\b(?:SELECT|PERFORM)\s+public\./i);
}

test('cloud-readonly-preflight.sql is transaction-fenced and inspection-only', () => {
  assertInspectionOnly(sql);
  assert.match(sql, /SET LOCAL statement_timeout = '30s';/);
  assert.match(sql, /SET LOCAL lock_timeout = '3s';/);
});

test('inspection guard rejects mutation, application RPC execution and shell/meta execution', () => {
  for (const unsafe of [
    'DELETE FROM public.backup_generation;',
    'SELECT public.publish_backup_generation();',
    '\\! echo unsafe',
    '\\gexec',
    '\\i other.sql',
  ]) {
    assert.throws(() => assertInspectionOnly(sql.replace('ROLLBACK;', `${unsafe}\nROLLBACK;`)));
  }
});

test('expected table inventory matches all current backup entities and generation tables', () => {
  const types = fs.readFileSync(new URL('../core/backup/backup.types.ts', import.meta.url), 'utf8');
  const entities = [
    ...types
      .match(/export const BACKUP_ENTITIES = \[([\s\S]*?)\] as const/)[1]
      .matchAll(/'([a-z_]+)'/g),
  ].map((match) => match[1]);
  const expected = [
    ...entities,
    'user_backup_settings',
    'backup_manifest',
    'backup_generation',
    'backup_generation_chunk',
    'backup_generation_head',
    'backup_generation_sequence_reservation',
    'backup_generation_publication',
  ];
  const inventory = sql.match(/WITH expected\(name\) AS \(VALUES([\s\S]*?)\n\)/)[1];
  const actual = [...inventory.matchAll(/\('([a-z_]+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(actual.sort(), expected.sort());
});

test('numeric verification inventory matches the actual precision migration', () => {
  const migration = fs.readFileSync(
    new URL('../supabase/migrations/20260925125655_backup_numeric_precision.sql', import.meta.url),
    'utf8',
  );
  const targets = [];
  for (const table of migration.matchAll(/ALTER TABLE public\.([a-z_]+)([\s\S]*?);/g)) {
    for (const column of table[2].matchAll(/ALTER COLUMN ([a-z_]+) TYPE NUMERIC/g)) {
      targets.push(`${table[1]}.${column[1]}`);
    }
  }
  const inventory = sql.match(
    /WITH target\(table_name, column_name\) AS \(VALUES([\s\S]*?)\n\)/,
  )[1];
  const actual = [...inventory.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map(
    (match) => `${match[1]}.${match[2]}`,
  );
  assert.equal(targets.length, 17);
  assert.deepEqual(actual.sort(), targets.sort());
});

test('catalog audit covers RLS, effective and PUBLIC ACLs, definer/search_path, triggers and ledger', () => {
  for (const marker of [
    'pg_policies',
    'relrowsecurity',
    'relforcerowsecurity',
    'aclexplode',
    'acldefault',
    'has_table_privilege',
    'has_function_privilege',
    'pg_auth_members',
    'prosecdef',
    'proconfig',
    'pg_get_triggerdef',
    'supabase_migrations.schema_migrations',
    'auth.schema_migrations',
  ]) {
    assert.ok(sql.includes(marker), marker);
  }
  assert.doesNotMatch(withoutComments(sql), /\bauth\.users\b|SELECT\s+\*/i);
});

test('legacy and current RPC fences and cleanup-impact checks remain explicit', () => {
  for (const signature of [
    'reserve_backup_generation_sequence(text)',
    'reserve_backup_generation_sequence(text,text,bigint,integer)',
    'publish_backup_generation(text,bigint,integer,text)',
    'publish_backup_generation(text,bigint,integer,text,integer)',
    'backup_generation_publish_v1(text,bigint,integer,text)',
  ])
    assert.ok(sql.includes(signature), signature);
  assert.match(sql, /\\if :has_generation_tables/);
  assert.match(sql, /staged_non_head_non_journal_generations_visible/);
  assert.match(sql, /staged_cascading_chunks_visible/);
  assert.match(sql, /manifest_hash_mismatch/);
  assert.match(sql, /chunk_hash_mismatch/);
});
