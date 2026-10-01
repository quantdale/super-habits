import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BACKUP_ENTITIES, BACKUP_ENTITY_COLUMNS } from '@/core/backup/backup.types';
import { freshDatabase } from './helpers/db';

const repositoryRoot = resolve(__dirname, '..', '..');

/**
 * Every column the client PUSHES must be declared by the remote DDL the
 * repository ships, or the push fails at runtime with an unknown-column error on
 * a device against a remote that was migrated from these files. The local
 * `PRAGMA` comparison above catches the opposite direction (local drift); this
 * one closes the remote half, and it needs no network and no database.
 */
function remoteSchemaSql(): string {
  const migrationsDir = join(repositoryRoot, 'supabase', 'migrations');
  const migrations = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
    .join('\n');
  return `${migrations}\n${readFileSync(
    join(repositoryRoot, 'simulation', 'backend', 'schema.sql'),
    'utf8',
  )}`;
}

/** Column names a `CREATE TABLE`/`ALTER TABLE` block declares for `entity`. */
function remoteColumnsFor(entity: string, sql: string): Set<string> {
  const columns = new Set<string>();
  const createTable = new RegExp(
    `CREATE TABLE(?: IF NOT EXISTS)? (?:public\\.)?${entity}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`,
    'gi',
  );
  for (const match of sql.matchAll(createTable)) {
    const body = match[1] ?? '';
    for (const line of body.split('\n')) {
      const column = /^\s{2,}([a-z_][a-z0-9_]*)\s+[A-Za-z]/.exec(line);
      if (!column) continue;
      const name = column[1] ?? '';
      // Skip table-level constraint keywords.
      if (['constraint', 'primary', 'foreign', 'unique', 'check'].includes(name.toLowerCase())) {
        continue;
      }
      columns.add(name);
    }
  }
  for (const match of sql.matchAll(
    new RegExp(
      `ALTER TABLE (?:public\\.)?${entity}\\s+ADD COLUMN(?: IF NOT EXISTS)?\\s+([a-z_][a-z0-9_]*)`,
      'gi',
    ),
  )) {
    if (match[1]) columns.add(match[1]);
  }
  return columns;
}

/**
 * Canonical-column coherence: `BACKUP_ENTITY_COLUMNS` is the exact column
 * contract used by checksum, backfill, checkpoint, and restore verification.
 * A migration that adds (or renames) a column without updating the canonical
 * list would previously fail silently — new user data excluded from every
 * manifest checksum while restore still reported success. These assertions
 * make that divergence loud. Canonical *order* is checksum-stable by design
 * and differs from PRAGMA order, so the live comparison is set equality.
 */
describe('backup canonical columns track the live schema', () => {
  it('covers exactly the backup entities with duplicate-free canonical lists', () => {
    expect([...Object.keys(BACKUP_ENTITY_COLUMNS)].sort()).toEqual([...BACKUP_ENTITIES].sort());
    for (const entity of BACKUP_ENTITIES) {
      const columns = BACKUP_ENTITY_COLUMNS[entity];
      expect(columns.length).toBeGreaterThan(0);
      expect(new Set(columns).size).toBe(columns.length);
    }
  });

  it('matches PRAGMA table_info for every backup entity as sets', async () => {
    const db = await freshDatabase();
    try {
      const diffs: Record<string, { liveOnly: string[]; canonicalOnly: string[] }> = {};
      for (const entity of BACKUP_ENTITIES) {
        const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${entity})`);
        const live = new Set(rows.map((row) => row.name));
        const canonical = new Set<string>(BACKUP_ENTITY_COLUMNS[entity]);
        const liveOnly = [...live].filter((column) => !canonical.has(column)).sort();
        const canonicalOnly = [...canonical].filter((column) => !live.has(column)).sort();
        if (liveOnly.length > 0 || canonicalOnly.length > 0) {
          diffs[entity] = { liveOnly, canonicalOnly };
        }
      }
      expect(diffs).toEqual({});
    } finally {
      await db.closeAsync();
    }
  });

  it('is declared by the repository remote DDL for every canonical column (5.4)', () => {
    // Without this, a column can be added to the canonical projection while the
    // remote migration SQL never declares it, and every push of that entity
    // fails on a real device with an unknown-column error the local suite
    // cannot see.
    const sql = remoteSchemaSql();
    const missing: Record<string, string[]> = {};
    for (const entity of BACKUP_ENTITIES) {
      const declared = remoteColumnsFor(entity, sql);
      expect(declared.size, `no remote DDL found for ${entity}`).toBeGreaterThan(0);
      const absent = BACKUP_ENTITY_COLUMNS[entity].filter((column) => !declared.has(column));
      if (absent.length > 0) missing[entity] = absent;
    }
    expect(missing).toEqual({});
  });
});
