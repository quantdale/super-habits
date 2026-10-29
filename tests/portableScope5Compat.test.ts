import { describe, expect, it } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_SETTINGS_VERSION,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V5_ENTITY_SET,
  type BackupEntity,
} from '@/core/backup/backup.types';
import {
  canonicalizeSettingsPayload,
  normalizeRecoverableSettings,
} from '@/core/backup/backupSettings';
import { checksumRows } from '@/lib/checksum';
import {
  computePortablePayloadChecksum,
  validatePortableBackupFile,
} from '@/core/portable/portableFormat';
import {
  PORTABLE_BACKUP_FORMAT,
  PORTABLE_BACKUP_FORMAT_VERSION,
} from '@/core/portable/portable.types';

/**
 * Historical compatibility: a genuine Scope-5-era portable file (formatVersion
 * 2, backupScopeVersion 5) must validate against the frozen column contract
 * that produced its stored checksums.
 *
 * The era column lists below are written out literally (NOT derived from
 * `backupEntityColumnsForScope`) so this test independently models the file
 * the scope-5 exporter actually produced: every entity hashed with the era's
 * full column list — non-workout entities identical to today's contract, the
 * six pre-Gym-V2 workout entities with their frozen (smaller) column sets.
 */
const ERA_TODO_COLUMNS = [
  'id',
  'title',
  'notes',
  'completed',
  'due_date',
  'priority',
  'sort_order',
  'recurrence',
  'recurrence_id',
  'created_at',
  'updated_at',
  'deleted_at',
  'project_id',
  'goal_id',
  'completed_at',
] as const;

/** Frozen at the end of scope 5 — before `goal_tag` joined Gym V2 (scope 6). */
const ERA_WORKOUT_ROUTINE_COLUMNS = [
  'id',
  'name',
  'description',
  'created_at',
  'updated_at',
  'deleted_at',
] as const;

const ERA_ROWS: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {
  todos: [
    {
      id: 'todo_1700000000000_aaaaaaaa',
      title: 'Ship the scope-5 restore fix',
      notes: null,
      completed: 0,
      due_date: null,
      priority: 'normal',
      sort_order: 0,
      recurrence: null,
      recurrence_id: null,
      created_at: '2026-08-01T01:02:03.000Z',
      updated_at: '2026-08-01T01:02:03.000Z',
      deleted_at: null,
      project_id: null,
      goal_id: null,
      completed_at: null,
    },
  ],
  workout_routines: [
    {
      id: 'wrk_1700000000001_bbbbbbbb',
      name: 'Push day',
      description: null,
      created_at: '2026-08-02T01:02:03.000Z',
      updated_at: '2026-08-02T01:02:03.000Z',
      deleted_at: null,
    },
  ],
};

function buildGenuineScope5File(): Record<string, unknown> {
  const scopeEntities = [...KNOWN_HISTORICAL_BACKUP_SCOPE_V5_ENTITY_SET];
  const entities: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
  const entityIntegrity: Record<string, { count: number; checksum: string }> = {};
  for (const entity of scopeEntities) {
    const rows = ERA_ROWS[entity] ?? [];
    entities[entity] = rows;
    // Only row-bearing entities need their real era columns: checksumRows
    // canonicalizes per row, so an empty row set hashes to the same digest
    // regardless of the column list.
    const columns =
      entity === 'todos'
        ? ERA_TODO_COLUMNS
        : entity === 'workout_routines'
          ? ERA_WORKOUT_ROUTINE_COLUMNS
          : (['id'] as const);
    entityIntegrity[entity] = checksumRows(rows, columns);
  }

  const settings = normalizeRecoverableSettings({});
  const settingsChecksum = canonicalizeSettingsPayload(settings, {
    settingsVersion: BACKUP_SETTINGS_VERSION,
  });

  const file = {
    format: PORTABLE_BACKUP_FORMAT,
    formatVersion: PORTABLE_BACKUP_FORMAT_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    backupScopeVersion: 5,
    exportedAt: '2026-08-15T00:00:00.000Z',
    source: { appVersion: '1.0.0', platform: 'web', ownerFingerprint: null },
    entities,
    settings,
    integrity: {
      entities: entityIntegrity,
      settings: { version: BACKUP_SETTINGS_VERSION, checksum: settingsChecksum },
      payloadChecksum: '',
    },
  };
  file.integrity.payloadChecksum = computePortablePayloadChecksum(file as never, {
    entities: scopeEntities,
    columns: {
      todos: ERA_TODO_COLUMNS,
      workout_routines: ERA_WORKOUT_ROUTINE_COLUMNS,
    } as unknown as Record<BackupEntity, readonly string[]>,
    settingsVersion: BACKUP_SETTINGS_VERSION,
  });
  return file;
}

describe('portable import: historical scope-5 files', () => {
  it('validates a genuine scope-5-era file (frozen columns, full entity set)', () => {
    const file = buildGenuineScope5File();
    const result = validatePortableBackupFile(file);
    if (!result.ok) {
      throw new Error(`expected ok, got: ${result.errors.join(' | ')}`);
    }
    expect(result.ok).toBe(true);
  });

  it('still rejects a scope-5 file whose rows were tampered with', () => {
    const file = buildGenuineScope5File();
    (file.entities as Record<string, Record<string, unknown>[]>).todos[0].title = 'Tampered';
    const result = validatePortableBackupFile(file);
    expect(result.ok).toBe(false);
  });
});
