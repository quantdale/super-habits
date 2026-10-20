#!/usr/bin/env node
/**
 * Isolated PostgreSQL qualification for the backup publication provenance
 * contract (`AUD-F4`).
 *
 * Starts a throwaway PostgreSQL 17 cluster under the OS temp directory with
 * trust auth, applies the actual committed migration chain, and exercises the
 * SQL contract as `authenticated`:
 *   - capability protocol 2 + provenance version 1 are advertised;
 *   - the old one-argument reservation and four-argument publication RPCs are
 *     gone, and the internal verifier is not executable by clients;
 *   - a capture/reservation without a valid base head is refused;
 *   - a generation reserved against G1 but published after G2 is refused;
 *   - a stale pre-staged generation cannot advance a newer head;
 *   - a correctly based generation still publishes and is idempotent.
 *
 * No production/shared database is touched.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const PG_BIN = process.env.PGBIN ?? 'C:\\Program Files\\PostgreSQL\\17\\bin';
const PORT = Number(process.env.SUPERHABITS_PG_PORT ?? 55439 + randomInt(0, 100));
const USER_ID = '00000000-0000-0000-0000-000000000001';
/** Second owner: holds published pre-provenance history for the cleanup case. */
const USER_ID_2 = '00000000-0000-0000-0000-000000000002';
const ENTITIES = [
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
const EMPTY_HASH = sha256('[]');
const SETTINGS_PAYLOAD = '{}';
const SETTINGS_HASH = sha256(SETTINGS_PAYLOAD);

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Same top-level key ordering as `canonicalGenerationRows` in capture.ts. */
function canonical(rows) {
  return JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );
}

function emptyManifest(snapshotId, sequence) {
  const capturedAt = `2026-10-20T00:00:0${sequence}.000Z`;
  const entities = Object.fromEntries(
    ENTITIES.map((entity) => [entity, { rows: 0, checksum: EMPTY_HASH }]),
  );
  entities.user_backup_settings = { rows: 1, checksum: SETTINGS_HASH };
  const manifest = canonical([
    {
      protocolVersion: 1,
      backupSchemaVersion: 2,
      scopeVersion: 7,
      settingsVersion: 5,
      snapshotId,
      sequence,
      capturedAt,
      entities,
      settingsChecksum: SETTINGS_HASH,
    },
  ]);
  return { manifest, checksum: sha256(manifest), capturedAt };
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function generationSql(snapshotId, sequence, baseSnapshotId, baseSequence) {
  const { manifest, checksum, capturedAt } = emptyManifest(snapshotId, sequence);
  const baseSnapshot = baseSnapshotId === null ? 'NULL' : sqlString(baseSnapshotId);
  const baseSeq = baseSequence === null ? 'NULL' : String(baseSequence);
  return {
    checksum,
    sql: `
INSERT INTO public.backup_generation
  (snapshot_id, sequence, protocol_version, backup_schema_version, scope_version,
   settings_version, manifest, manifest_checksum, captured_at,
   base_head_snapshot_id, base_head_sequence, publication_provenance_version)
VALUES
  (${sqlString(snapshotId)}, ${sequence}, 1, 2, 7, 5,
   ${sqlString(manifest)}, ${sqlString(checksum)}, ${sqlString(capturedAt)},
   ${baseSnapshot}, ${baseSeq}, 1);
INSERT INTO public.backup_generation_chunk
  (snapshot_id, entity, ordinal, payload, checksum)
VALUES
  (${sqlString(snapshotId)}, 'user_backup_settings', 0,
   ${sqlString(SETTINGS_PAYLOAD)}, ${sqlString(SETTINGS_HASH)});
`,
  };
}

function psql(connection, args) {
  return execFileSync(
    path.join(PG_BIN, 'psql.exe'),
    ['-X', '-q', '-w', '-P', 'pager=off', '-v', 'ON_ERROR_STOP=1', ...connection, ...args],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
}

function runSql(connection, sql, filePath) {
  fs.writeFileSync(filePath, sql, 'utf8');
  return psql(connection, ['-f', filePath]);
}

const g1 = generationSql('g1', 1, null, null);
const g2 = generationSql('g2', 2, 'g1', 1);
const g3 = generationSql('g3_stale_race', 3, 'g1', 1);
const g5 = generationSql('g5_valid', 4, 'g2', 2);
const g6 = generationSql('g6_hijack', 5, 'g5_valid', 4);

const testSql = `
-- Cleanup preservation (W-1 review case): published pre-provenance history
-- must survive the migration. Runs before the role switch because RLS is
-- owner-scoped and this history belongs to the second owner.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.backup_generation
     WHERE user_id = '${USER_ID_2}' AND snapshot_id = 'legacy_kept'
       AND publication_provenance_version = 0
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: published provenance-0 history was deleted by cleanup';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.backup_generation_head
     WHERE user_id = '${USER_ID_2}' AND snapshot_id = 'legacy_kept'
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: a published head row was deleted by cleanup';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.backup_generation_publication
     WHERE user_id = '${USER_ID_2}' AND snapshot_id = 'legacy_kept'
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: a publication journal row was deleted by cleanup';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_generation_sequence_reservation
     WHERE user_id = '${USER_ID_2}' AND snapshot_id = 'legacy_kept'
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: a provenance-0 reservation was not retired';
  END IF;
END $$;

SET test.uid = ${sqlString(USER_ID)};
SET ROLE authenticated;

DO $$
DECLARE v_cap jsonb;
BEGIN
  v_cap := public.backup_generation_capabilities();
  IF (v_cap->>'protocol_version')::int <> 2 THEN
    RAISE EXCEPTION 'TEST_FAILED: protocol_version is not 2';
  END IF;
  IF (v_cap->>'publication_provenance_version')::int <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: publication_provenance_version is not 1';
  END IF;
  IF to_regprocedure('public.reserve_backup_generation_sequence(text)') IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: old one-argument reservation RPC still exists';
  END IF;
  IF to_regprocedure('public.publish_backup_generation(text,bigint,integer,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: old four-argument publication RPC still exists';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.backup_generation_publish_v1(text,bigint,integer,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED: internal v1 publisher is executable by clients';
  END IF;
  IF has_function_privilege(
       'service_role',
       'public.backup_generation_publish_v1(text,bigint,integer,text)',
       'EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED: internal v1 publisher is executable by service_role';
  END IF;
  IF has_table_privilege('authenticated', 'public.backup_generation', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.backup_generation_chunk', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.backup_generation_head', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.backup_generation_sequence_reservation', 'TRUNCATE')
    OR has_table_privilege('authenticated', 'public.backup_generation_publication', 'TRUNCATE') THEN
    RAISE EXCEPTION 'TEST_FAILED: destructive generation-table privilege remains';
  END IF;
  IF EXISTS(SELECT 1 FROM public.backup_generation_sequence_reservation WHERE snapshot_id='legacy_stale')
    OR EXISTS(SELECT 1 FROM public.backup_generation WHERE snapshot_id='legacy_stale') THEN
    RAISE EXCEPTION 'TEST_FAILED: pre-migration provenance-0 staging was not retired';
  END IF;
END $$;

SELECT public.reserve_backup_generation_sequence('g1', NULL, NULL, 1);
${g1.sql}
SELECT public.publish_backup_generation('g1', 0, 1, ${sqlString(g1.checksum)}, 1);

DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g1' OR h.sequence <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: g1 did not become the head';
  END IF;
END $$;

DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  BEGIN
    PERFORM public.reserve_backup_generation_sequence('bad_null_base', NULL, NULL, 1);
    RAISE EXCEPTION 'TEST_FAILED: reservation with no base succeeded after a head existed';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g1' OR h.sequence <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: rejected reservation changed the head';
  END IF;
END $$;

-- g2 reserves against g1. g3 also reserves against g1 while g1 is still head;
-- this models a client that staged a capture before another device advanced.
SELECT public.reserve_backup_generation_sequence('g2', 'g1', 1, 1);
SELECT public.reserve_backup_generation_sequence('g3_stale_race', 'g1', 1, 1);
${g2.sql}
SELECT public.publish_backup_generation('g2', 1, 1, ${sqlString(g2.checksum)}, 1);
-- Idempotent retry of the same visible generation.
SELECT public.publish_backup_generation('g2', 1, 1, ${sqlString(g2.checksum)}, 1);

${g3.sql}
DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  BEGIN
    PERFORM public.publish_backup_generation(
      'g3_stale_race', 2, 1, ${sqlString(g3.checksum)}, 1
    );
    RAISE EXCEPTION 'TEST_FAILED: stale generation advanced a newer head';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g2' OR h.sequence <> 2 THEN
    RAISE EXCEPTION 'TEST_FAILED: rejected stale publication changed the head';
  END IF;
END $$;

DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  BEGIN
    PERFORM public.reserve_backup_generation_sequence(
      'bad_stale_base', 'g1', 1, 1
    );
    RAISE EXCEPTION 'TEST_FAILED: reservation against a stale base succeeded';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL;
  END;
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g2' OR h.sequence <> 2 THEN
    RAISE EXCEPTION 'TEST_FAILED: rejected stale-base reservation changed the head';
  END IF;
END $$;

-- A correctly based generation still publishes.
SELECT public.reserve_backup_generation_sequence('g5_valid', 'g2', 2, 1);
${g5.sql}
SELECT public.publish_backup_generation('g5_valid', 2, 1, ${sqlString(g5.checksum)}, 1);

DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g5_valid' OR h.sequence <> 4 THEN
    RAISE EXCEPTION 'TEST_FAILED: valid g5 did not become the head';
  END IF;
END $$;

-- W-1: reservation idempotency plus hijack resistance. A raw provenance-0
-- insert at a live reserved identity must be refused instead of occupying the
-- primary key and wedging the legitimate publisher (whose upsert would then be
-- rejected by the immutability guard forever).
DO $$
DECLARE v_seq bigint; v_retry bigint;
BEGIN
  v_seq := public.reserve_backup_generation_sequence('g6_hijack', 'g5_valid', 4, 1);
  v_retry := public.reserve_backup_generation_sequence('g6_hijack', 'g5_valid', 4, 1);
  IF v_seq IS DISTINCT FROM v_retry THEN
    RAISE EXCEPTION 'TEST_FAILED: reservation retry was not idempotent';
  END IF;
  BEGIN
    PERFORM public.reserve_backup_generation_sequence('g6_hijack', 'g5_valid', 99, 1);
    RAISE EXCEPTION 'TEST_FAILED: reservation retry with a different base succeeded';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.backup_generation
      (snapshot_id, sequence, protocol_version, backup_schema_version, scope_version,
       settings_version, manifest, manifest_checksum, captured_at)
    VALUES ('g6_hijack', v_seq, 1, 2, 7, 5, '{}', repeat('b', 64), '2026-10-20T00:00:00.000Z');
    RAISE EXCEPTION 'TEST_FAILED: a provenance-0 insert hijacked a live reservation';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.backup_generation
      (snapshot_id, sequence, protocol_version, backup_schema_version, scope_version,
       settings_version, manifest, manifest_checksum, captured_at,
       base_head_snapshot_id, base_head_sequence, publication_provenance_version)
    VALUES ('g6_hijack', v_seq, 1, 2, 7, 5, '{}', repeat('c', 64), '2026-10-20T00:00:00.000Z',
            'g5_valid', 4, 0);
    RAISE EXCEPTION 'TEST_FAILED: a provenance-0 insert with a mirrored base hijacked a reservation';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
END $$;

-- The hijack attempts left no residue: the legitimate client flow for the
-- same reserved identity still stages and publishes normally (no wedge).
SELECT public.reserve_backup_generation_sequence('g6_hijack', 'g5_valid', 4, 1);
${g6.sql}
SELECT public.publish_backup_generation('g6_hijack', 4, 1, ${sqlString(g6.checksum)}, 1);

DO $$
DECLARE h public.backup_generation_head%ROWTYPE;
BEGIN
  SELECT * INTO h FROM public.backup_generation_head WHERE user_id = auth.uid();
  IF h.snapshot_id <> 'g6_hijack' OR h.sequence <> 5 THEN
    RAISE EXCEPTION 'TEST_FAILED: the legitimate publisher was wedged by the hijack attempts';
  END IF;
END $$;

RESET ROLE;
`;

const migrations = [
  '20261018000000_add_backup_generation_protocol.sql',
  '20261019000000_fix_backup_generation_publication.sql',
  '20261019162537_verify_and_reserve_backup_generations.sql',
  '20261020090000_enforce_backup_publication_provenance.sql',
];

function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superhabits-pg-'));
  const logFile = path.join(dataDir, 'postgres.log');
  const setupSqlPath = path.join(dataDir, 'setup.sql');
  const legacySqlPath = path.join(dataDir, 'legacy.sql');
  const testSqlPath = path.join(dataDir, 'test.sql');
  const connection = ['-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', 'postgres'];
  let started = false;
  try {
    console.log(`[pg] creating isolated cluster at ${dataDir} (port ${PORT})`);
    execFileSync(
      path.join(PG_BIN, 'initdb.exe'),
      ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    execFileSync(
      path.join(PG_BIN, 'pg_ctl.exe'),
      ['-D', dataDir, '-l', logFile, '-o', `-p ${PORT} -h 127.0.0.1`, '-w', 'start'],
      // `pg_ctl` starts a long-lived postgres child. Do not leave inherited
      // stdout/stderr pipes open or Node's sync spawn can wait on the server.
      { stdio: 'ignore' },
    );
    started = true;
    console.log('[pg] cluster ready; creating auth fixtures and applying migrations');

    runSql(
      connection,
      `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
-- Model Supabase's broad default grants so explicit revokes are exercised.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated, anon, service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO auth.users(id) VALUES ('${USER_ID}');
INSERT INTO auth.users(id) VALUES ('${USER_ID_2}');
`,
      setupSqlPath,
    );

    for (const migration of migrations.slice(0, 3)) {
      console.log(`[pg] applying ${migration}`);
      psql(connection, ['-f', path.join(REPO_ROOT, 'supabase', 'migrations', migration)]);
    }
    console.log('[pg] seeding pre-migration provenance-0 staging and published history');
    runSql(
      connection,
      `
INSERT INTO public.backup_generation_sequence_reservation(user_id, snapshot_id, sequence)
VALUES ('${USER_ID}', 'legacy_stale', 1);
INSERT INTO public.backup_generation
  (user_id, snapshot_id, sequence, protocol_version, backup_schema_version, scope_version,
   settings_version, manifest, manifest_checksum, captured_at)
VALUES ('${USER_ID}', 'legacy_stale', 1, 1, 2, 7, 5, '{}', repeat('a', 64),
        '2026-10-20T00:00:00.000Z');
-- Published pre-provenance history for a second owner: the cleanup must keep
-- every journal/head-visible row (W-1 review case).
INSERT INTO public.backup_generation_sequence_reservation(user_id, snapshot_id, sequence)
VALUES ('${USER_ID_2}', 'legacy_kept', 2);
INSERT INTO public.backup_generation
  (user_id, snapshot_id, sequence, protocol_version, backup_schema_version, scope_version,
   settings_version, manifest, manifest_checksum, captured_at)
VALUES ('${USER_ID_2}', 'legacy_kept', 2, 1, 2, 7, 5, '{}', repeat('a', 64),
        '2026-10-20T00:00:00.000Z');
INSERT INTO public.backup_generation_publication (user_id, snapshot_id, sequence)
VALUES ('${USER_ID_2}', 'legacy_kept', 2);
INSERT INTO public.backup_generation_head (user_id, snapshot_id, sequence)
VALUES ('${USER_ID_2}', 'legacy_kept', 2);
`,
      legacySqlPath,
    );
    console.log(`[pg] applying ${migrations[3]}`);
    psql(connection, ['-f', path.join(REPO_ROOT, 'supabase', 'migrations', migrations[3])]);
    console.log('[pg] running provenance assertions');
    runSql(connection, testSql, testSqlPath);
    console.log('PASS: backup publication provenance PostgreSQL qualification');
    console.log(`  migrations: ${migrations.join(', ')}`);
    console.log(
      '  cases: capability v2, RPC fences, base reservation, stale race, stale head, valid publication, idempotent retry, reservation idempotency, provenance-0 hijack resistance, cleanup preservation',
    );
  } finally {
    if (started) {
      try {
        execFileSync(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', dataDir, '-m', 'fast', '-w', 'stop'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 120_000,
        });
      } catch {
        // Best-effort cleanup; the data directory is still removed below.
      }
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      console.warn(`WARN: could not remove temporary PostgreSQL directory ${dataDir}`);
    }
  }
}

run();
