import { describe, expect, it } from 'vitest';
import { parseManifestRow } from '@/core/backup/backupRestore';

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
