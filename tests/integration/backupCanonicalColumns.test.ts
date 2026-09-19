import { describe, expect, it } from 'vitest';
import { BACKUP_ENTITIES, BACKUP_ENTITY_COLUMNS } from '@/core/backup/backup.types';
import { freshDatabase } from './helpers/db';

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
});
