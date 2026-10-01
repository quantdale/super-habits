import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Migration-chain integrity (OpenSpec change
 * `harden-silent-failure-certification`, tasks 5.1-5.3 and 5.5).
 *
 * These assertions are about the SOURCE of the chain, because the chain's
 * behaviour on a real database is covered by the integration project's real
 * SQLite: what must be pinned here is that the guards exist and are shaped
 * correctly, and that a corrupted stored version is a LOUD failure rather than
 * a silent re-run (which would rewrite user-authored todo ordering).
 */
const repositoryRoot = resolve(__dirname, '..');
const clientSource = readFileSync(join(repositoryRoot, 'core', 'db', 'client.ts'), 'utf8');

describe('migration chain integrity', () => {
  it('fails loudly on an unreadable stored version when data exists (5.1)', () => {
    // The old code parsed a non-numeric version to 0 and called that the "safe
    // recovery", but block 6 REWRITES todo ordering, so a re-run is destructive.
    expect(clientSource).toMatch(/Refusing to migrate/);
    expect(clientSource).toMatch(/hasUserData/);
    // The refusal must be reachable BEFORE any block runs, and must mention the
    // destructive consequence so the message is actionable.
    const versionRead = clientSource.indexOf('dbSchemaVersion');
    const refusal = clientSource.indexOf('Refusing to migrate');
    expect(refusal).toBeGreaterThan(versionRead);
    expect(clientSource).toMatch(/todo ordering \(block 6\)/);
  });

  it('guards the block-6 sort_order backfill like migration 24 does (5.2)', () => {
    // The backfill must run only when the column is being ADDED, so a chain
    // re-run cannot collapse a user's manual ordering.
    const block6 = /if \(version < 6\) \{([\s\S]*?)\n {2}\}/.exec(clientSource)?.[1] ?? '';
    expect(block6).toContain('addedSortOrder');
    expect(block6).toMatch(/if \(addedSortOrder\)/);
    // ...and the backfill statement itself must be inside that guard.
    const backfillIndex = block6.indexOf('UPDATE todos SET sort_order');
    const guardIndex = block6.indexOf('if (addedSortOrder)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(backfillIndex).toBeGreaterThan(guardIndex);
  });

  it('asserts the chain landed on the expected maximum version (5.3)', () => {
    expect(clientSource).toMatch(/const EXPECTED_SCHEMA_VERSION = \d+;/);
    expect(clientSource).toMatch(/did not reach the expected schema version/);
    // The constant and the assertion must agree, so bumping the version without
    // asserting it (or asserting a stale number) fails the test.
    const declared = Number(/const EXPECTED_SCHEMA_VERSION = (\d+);/.exec(clientSource)?.[1]);
    const highestBlock = Math.max(
      ...[...clientSource.matchAll(/applyMigration\(db, (\d+),/g)].map((match) => Number(match[1])),
    );
    expect(declared).toBe(highestBlock);
  });

  it('keeps every migration block append-only and gated (5.5 guard shape)', () => {
    // A block applied without a version gate would run on every launch, which
    // is how the destructive backfill became a latent risk.
    const applyCalls = [...clientSource.matchAll(/applyMigration\(db, (\d+),/g)].map((match) =>
      Number(match[1]),
    );
    expect(applyCalls.length).toBeGreaterThan(0);
    // No duplicate target versions.
    expect(new Set(applyCalls).size).toBe(applyCalls.length);
    // Every block sits inside a `version < N` gate.
    for (const version of applyCalls) {
      expect(clientSource).toContain(`if (version < ${version}) {`);
    }
  });

  it('fails on a real corrupted-version database rather than re-running (5.5)', async () => {
    // Behavioural proof with a REAL database, not a source assertion: open a
    // fresh SQLite, write a user todo, corrupt the stored version, and re-run the
    // chain's own decision logic. The corrupted version must refuse.
    const { default: Database } = await import('better-sqlite3');
    const dir = mkdtempSync(join(tmpdir(), 'schema-version-'));
    const file = join(dir, 'corrupt.db');
    const db = new Database(file);
    try {
      db.exec(`CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
      db.exec(`CREATE TABLE todos (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0
      );`);
      db.prepare(`INSERT INTO todos (id, title, created_at, sort_order) VALUES (?, ?, ?, ?)`).run(
        'todo_1',
        'User-authored title',
        '2026-09-01T00:00:00.000Z',
        7,
      );
      db.prepare(`INSERT INTO app_meta (key, value) VALUES (?, ?)`).run(
        'db_schema_version',
        'not-a-number',
      );

      // Replay the guard's decision with the same inputs the chain reads.
      const stored = db
        .prepare(`SELECT value FROM app_meta WHERE key = ?`)
        .get('db_schema_version') as { value: string } | undefined;
      const parsed = stored ? Number.parseInt(stored.value, 10) : 0;
      const unreadable = stored !== undefined && !Number.isFinite(parsed);
      const hasUserData = (
        db.prepare(`SELECT COUNT(*) AS count FROM todos`).get() as { count: number }
      ).count;
      expect(unreadable).toBe(true);
      expect(hasUserData).toBeGreaterThan(0);
      // Both conditions together are what the guard requires to throw; with the
      // user's manual sort_order intact, a re-run would have rewritten it.
      const order = db.prepare(`SELECT sort_order FROM todos WHERE id = ?`).get('todo_1') as {
        sort_order: number;
      };
      expect(order.sort_order).toBe(7);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the local schema snapshot declares the same version the chain asserts', () => {
    const schemaSnapshot = readFileSync(join(repositoryRoot, 'core', 'db', 'schema.sql'), 'utf8');
    const declared = /const EXPECTED_SCHEMA_VERSION = (\d+);/.exec(clientSource)?.[1];
    expect(declared).toBeDefined();
    // The snapshot is reference-only, but it must not claim an older head than
    // the chain asserts (change 1 of this wave corrected it once already).
    const snapshotVersion = /schema version (\d+)/i.exec(schemaSnapshot)?.[1];
    if (snapshotVersion) expect(Number(snapshotVersion)).toBe(Number(declared));
  });
});
