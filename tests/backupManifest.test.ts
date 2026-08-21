import { describe, expect, it } from 'vitest';
import { parseManifestRow } from '@/core/backup/backupRestore';
import {
  BACKUP_ENTITIES,
  BACKUP_SCOPE_VERSION,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET,
  resolveBackupScope,
} from '@/core/backup/backup.types';

/**
 * Backup V2 closure — manifest parsing contract for the settings integrity
 * metadata (`settings_metadata = { version, checksum }`).
 */

function validManifestRow(): Record<string, unknown> {
  return {
    user_id: 'user_a',
    backup_schema_version: 2,
    generation: 7,
    completed_at: '2026-08-15T10:00:00.000Z',
    entity_metadata: {
      todos: { count: 1, checksum: 'a'.repeat(64) },
    },
    settings_version: 2,
    settings_metadata: { version: 2, checksum: 'b'.repeat(64) },
    updated_at: '2026-08-15T10:05:00.000Z',
  };
}

describe('backup manifest parsing with settings integrity metadata', () => {
  it('parses a v2 manifest with settings_metadata', () => {
    const manifest = parseManifestRow(validManifestRow());
    expect(manifest).not.toBeNull();
    expect(manifest?.backupSchemaVersion).toBe(2);
    expect(manifest?.generation).toBe(7);
    expect(manifest?.settingsVersion).toBe(2);
    expect(manifest?.settingsMetadata).toEqual({ version: 2, checksum: 'b'.repeat(64) });
    expect(manifest?.entityMetadata.todos).toEqual({
      count: 1,
      checksum: 'a'.repeat(64),
    });
  });

  it('leaves settingsMetadata undefined when settings_metadata is absent', () => {
    const row = validManifestRow();
    delete row.settings_metadata;
    const manifest = parseManifestRow(row);
    expect(manifest).not.toBeNull();
    expect(manifest?.settingsMetadata).toBeUndefined();
  });

  it('accepts an explicit null settings_metadata as absent', () => {
    const row = validManifestRow();
    row.settings_metadata = null;
    const manifest = parseManifestRow(row);
    expect(manifest).not.toBeNull();
    expect(manifest?.settingsMetadata).toBeUndefined();
  });

  it('rejects a malformed settings_metadata checksum', () => {
    const row = validManifestRow();
    row.settings_metadata = { version: 2, checksum: 'not-hex' };
    expect(parseManifestRow(row)).toBeNull();
  });

  it('rejects a non-object settings_metadata', () => {
    const row = validManifestRow();
    row.settings_metadata = 'garbage';
    expect(parseManifestRow(row)).toBeNull();
  });

  it('rejects settings_metadata without a numeric version', () => {
    const row = validManifestRow();
    row.settings_metadata = { version: 'two', checksum: 'c'.repeat(64) };
    expect(parseManifestRow(row)).toBeNull();
  });

  it('rejects a row with missing core manifest fields regardless of settings metadata', () => {
    const row = validManifestRow();
    delete row.generation;
    expect(parseManifestRow(row)).toBeNull();
  });
});

describe('resolveBackupScope epoch matrix', () => {
  const metadataFor = (entities: readonly string[]) =>
    Object.fromEntries(entities.map((entity) => [entity, { count: 0, checksum: 'a'.repeat(64) }]));

  it('resolves the current explicit scope version to the live entity set', () => {
    const scope = resolveBackupScope({
      backupScopeVersion: BACKUP_SCOPE_VERSION,
      entityMetadata: metadataFor(BACKUP_ENTITIES),
    });
    expect(scope).not.toBeNull();
    expect(scope?.scope).toBe(BACKUP_SCOPE_VERSION);
    expect([...scope!.entitySet].sort()).toEqual([...BACKUP_ENTITIES].sort());
  });

  it('resolves each explicit historical scope version (2/3/4)', () => {
    const v2 = resolveBackupScope({
      backupScopeVersion: 2,
      entityMetadata: metadataFor(KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET),
    });
    expect(v2?.scope).toBe(2);
    expect([...v2!.entitySet].sort()).toEqual(
      [...KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET].sort(),
    );

    const v3 = resolveBackupScope({
      backupScopeVersion: 3,
      entityMetadata: metadataFor(KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET),
    });
    expect(v3?.scope).toBe(3);

    const v4 = resolveBackupScope({
      backupScopeVersion: 4,
      entityMetadata: metadataFor(KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET),
    });
    expect(v4?.scope).toBe(4);
  });

  it('returns null for a FUTURE scope version so restore reports unsupported_version', () => {
    // A newer app's manifest must never silently verify as "current" on an
    // older app — that would misclassify "requires newer app" as a checksum
    // failure (integrity_mismatch).
    expect(
      resolveBackupScope({
        backupScopeVersion: BACKUP_SCOPE_VERSION + 1,
        entityMetadata: metadataFor(BACKUP_ENTITIES),
      }),
    ).toBeNull();
    expect(
      resolveBackupScope({
        backupScopeVersion: 99,
        entityMetadata: metadataFor(BACKUP_ENTITIES),
      }),
    ).toBeNull();
  });

  it('falls back to exact entity-set matching when no explicit scope version exists', () => {
    for (const [expected, set] of [
      [BACKUP_SCOPE_VERSION, BACKUP_ENTITIES],
      [4, KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET],
      [3, KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET],
      [2, KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET],
    ] as const) {
      const scope = resolveBackupScope({
        backupScopeVersion: null,
        entityMetadata: metadataFor(set),
      });
      expect(scope?.scope).toBe(expected);
    }
  });

  it('returns null for unknown or partial entity sets (never inferred permissively)', () => {
    expect(
      resolveBackupScope({
        backupScopeVersion: null,
        entityMetadata: metadataFor(['todos', 'habits']),
      }),
    ).toBeNull();
    // A superset that matches no epoch is also rejected.
    expect(
      resolveBackupScope({
        backupScopeVersion: null,
        entityMetadata: metadataFor([...BACKUP_ENTITIES, 'future_entity']),
      }),
    ).toBeNull();
  });
});
