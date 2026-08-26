import { describe, expect, it } from 'vitest';
import {
  BACKUP_ENTITIES,
  BACKUP_HARD_DELETE_ENTITIES,
  BACKUP_NEVER_DELETED_ENTITIES,
  BACKUP_SOFT_DELETE_ENTITIES,
} from '@/core/backup/backup.types';
import { RESTORE_IMPORTERS } from '@/core/backup/backupRestore';
import { SYNCABLE_ENTITIES } from '@/core/sync/supabase.adapter';
import { ACCOUNT_USER_TABLES } from '@/core/auth/account.types';

/**
 * Inventory coherence: several consumers hand-write entity/table inventories
 * that must stay aligned with the canonical BACKUP_ENTITIES list. A new
 * backup entity that forgets any of these surfaces would previously fail
 * silently (restore reported success while never importing the rows, or an
 * emptiness gate that did not count the new table let a destructive import
 * run over live data). These assertions make divergence loud.
 */
describe('backup inventory coherence', () => {
  it('covers every backup entity with exactly one V2 restore importer', () => {
    const importerEntities = RESTORE_IMPORTERS.map(([entity]) => entity);
    expect([...importerEntities].sort()).toEqual([...BACKUP_ENTITIES].sort());
    // Dependency order relies on each importer appearing once.
    expect(new Set(importerEntities).size).toBe(importerEntities.length);
  });

  it('syncs every backup entity through the durable outbox adapter', () => {
    const dataEntities: readonly string[] = SYNCABLE_ENTITIES.filter(
      (entity) => entity !== 'user_backup_settings' && entity !== 'backup_manifest',
    );
    expect([...dataEntities].sort()).toEqual([...BACKUP_ENTITIES].sort());
  });

  it('counts every backup entity in the local account-data (emptiness gate) inventory', () => {
    for (const entity of BACKUP_ENTITIES) {
      expect(ACCOUNT_USER_TABLES).toContain(entity);
    }
  });

  it('partitions every backup entity into exactly one delete semantic', () => {
    const soft = [...BACKUP_SOFT_DELETE_ENTITIES];
    const hard = [...BACKUP_HARD_DELETE_ENTITIES];
    const never = [...BACKUP_NEVER_DELETED_ENTITIES];
    // Soft ∪ hard ∪ never covers every entity.
    expect([...soft, ...hard, ...never].sort()).toEqual([...BACKUP_ENTITIES].sort());
    // No entity belongs to two categories.
    for (const entity of soft) {
      expect(BACKUP_HARD_DELETE_ENTITIES.has(entity)).toBe(false);
      expect(BACKUP_NEVER_DELETED_ENTITIES.has(entity)).toBe(false);
    }
    for (const entity of hard) {
      expect(BACKUP_NEVER_DELETED_ENTITIES.has(entity)).toBe(false);
    }
  });
});
