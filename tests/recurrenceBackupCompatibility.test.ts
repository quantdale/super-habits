import { describe, expect, it } from 'vitest';
import {
  BACKUP_ENTITIES,
  BACKUP_SCOPE_VERSION,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V6_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V8_ENTITY_SET,
  backupEntityColumnsForScope,
  resolveBackupScope,
} from '@/core/backup/backup.types';
import {
  buildPortableBackupFile,
  computePortablePayloadChecksum,
  validatePortableBackupFile,
} from '@/core/portable/portableFormat';
import { checksumRows } from '@/lib/checksum';
import { parseManifestRow } from '@/core/backup/legacySnapshot';

const ISO = '2026-11-15T00:00:00.000Z';
function fileForScope(scope = BACKUP_SCOPE_VERSION) {
  const file = buildPortableBackupFile({
    exportedAt: ISO,
    appVersion: '1.0.0',
    platform: 'web',
    ownerFingerprint: null,
    rowsByEntity: {
      todos: [
        {
          id: 'todo_1',
          title: 'Only today',
          notes: null,
          completed: 0,
          due_date: '2026-11-15',
          priority: 'urgent',
          sort_order: 0,
          recurrence: 'daily',
          recurrence_id: 'rec_1',
          created_at: ISO,
          updated_at: ISO,
          deleted_at: null,
          recurrence_date_key: '2026-11-14',
          recurrence_touched: 1,
          recurrence_spawned_by_id: null,
        },
      ],
      todo_recurrence_series: [
        {
          id: 'rec_1',
          title: 'Series title',
          notes: 'Series notes',
          priority: 'normal',
          created_at: ISO,
          updated_at: ISO,
          deleted_at: null,
        },
      ],
    },
    settings: {},
  });
  if (scope !== BACKUP_SCOPE_VERSION) {
    file.backupScopeVersion = scope;
    if (scope < 8) {
      delete file.entities.todo_recurrence_series;
      delete file.integrity.entities.todo_recurrence_series;
    }
    const columns = backupEntityColumnsForScope(scope);
    const historicalEntities =
      scope === 8
        ? KNOWN_HISTORICAL_BACKUP_SCOPE_V8_ENTITY_SET
        : KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET;
    for (const entity of historicalEntities) {
      file.entities[entity] = (file.entities[entity] ?? []).map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => columns[entity].includes(key))),
      );
      file.integrity.entities[entity] = checksumRows(file.entities[entity], columns[entity]);
    }
    file.integrity.payloadChecksum = computePortablePayloadChecksum(file, {
      entities: historicalEntities,
      columns,
    });
  }
  return file;
}

describe('recoverable recurring-series scope compatibility', () => {
  it('keeps historical entity sets and occurrence columns frozen', () => {
    expect(KNOWN_HISTORICAL_BACKUP_SCOPE_V6_ENTITY_SET).toHaveLength(21);
    expect(KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET).toHaveLength(21);
    expect(BACKUP_ENTITIES).toHaveLength(22);
    for (const scope of [6, 7]) {
      expect(backupEntityColumnsForScope(scope).todos).not.toContain('recurrence_date_key');
      expect(backupEntityColumnsForScope(scope).todos).not.toContain('recurrence_touched');
    }
    const file = fileForScope(7);
    expect(
      resolveBackupScope({ backupScopeVersion: 7, entityMetadata: file.integrity.entities })
        ?.entitySet,
    ).toEqual(KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET);
  });

  it.each(['missing', 'extra', 'wrong-scope'] as const)(
    'rejects an explicit scope with %s entity metadata',
    (mode) => {
      const file = fileForScope(7);
      const metadata = { ...file.integrity.entities };
      if (mode === 'missing') delete metadata.todos;
      if (mode === 'extra')
        metadata.todo_recurrence_series = { count: 0, checksum: 'a'.repeat(64) };
      expect(
        resolveBackupScope({
          backupScopeVersion: mode === 'wrong-scope' ? BACKUP_SCOPE_VERSION : 7,
          entityMetadata: metadata,
        }),
      ).toBeNull();
    },
  );

  it('does not discard an unknown data group before resolving the recovery contract', () => {
    const file = fileForScope(7);
    expect(
      parseManifestRow({
        backup_schema_version: 2,
        backup_scope_version: 7,
        generation: 1,
        completed_at: ISO,
        settings_version: 5,
        settings_metadata: file.integrity.settings,
        entity_metadata: {
          ...file.integrity.entities,
          future_entity: { count: 1, checksum: 'a'.repeat(64) },
        },
      }),
    ).toBeNull();
  });

  it('accepts frozen Scope-7 checksums without inventing certified series state', () => {
    const file = fileForScope(7);
    expect(validatePortableBackupFile(file)).toMatchObject({ ok: true });
    expect(file.entities.todo_recurrence_series).toBeUndefined();
  });

  it('never restores occurrence metadata not certified by the historical scope', () => {
    const file = fileForScope(7);
    file.entities.todos![0].recurrence_date_key = '2099-01-01';
    file.entities.todos![0].recurrence_touched = 1;
    const validated = validatePortableBackupFile(file);
    expect(validated.ok).toBe(true);
    if (!validated.ok) throw new Error(validated.errors.join('; '));
    expect(validated.file.entities.todos![0].recurrence_date_key).toBeUndefined();
    expect(validated.file.entities.todos![0].recurrence_touched).toBeUndefined();
    // Validation is read-only: input supplied by the caller is never mutated.
    expect(file.entities.todos![0].recurrence_date_key).toBe('2099-01-01');
  });

  it.each(['recurrence_date_key', 'recurrence_touched'] as const)(
    'certifies %s in current files, rather than silently ignoring edits',
    (field) => {
      const file = fileForScope();
      expect(validatePortableBackupFile(file).ok).toBe(true);
      file.entities.todos![0][field] = field === 'recurrence_touched' ? 0 : '2099-01-01';
      expect(validatePortableBackupFile(file).ok).toBe(false);
    },
  );

  it('keeps Scope-8 bytes and never restores uncertified completion-parent fields', () => {
    const file = fileForScope(8);
    expect(validatePortableBackupFile(file).ok).toBe(true);
    expect(backupEntityColumnsForScope(8).todos).toContain('recurrence_touched');
    expect(backupEntityColumnsForScope(8).todos).not.toContain('recurrence_spawned_by_id');
    file.entities.todos![0].recurrence_spawned_by_id = 'todo_999';
    const checked = validatePortableBackupFile(file);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error(checked.errors.join(';'));
    expect(checked.file.entities.todos![0].recurrence_spawned_by_id).toBeUndefined();
    expect(file.entities.todos![0].recurrence_spawned_by_id).toBe('todo_999');
  });

  it('requires the explicit Scope-9 stamp rather than inferring new columns from old entity names', () => {
    const file = fileForScope();
    expect(resolveBackupScope({ entityMetadata: file.integrity.entities })?.scope).toBe(8);
    expect(
      resolveBackupScope({ backupScopeVersion: 9, entityMetadata: file.integrity.entities })?.scope,
    ).toBe(9);
  });

  it('certifies the current completion-parent column', () => {
    const file = fileForScope();
    expect(validatePortableBackupFile(file).ok).toBe(true);
    file.entities.todos![0].recurrence_spawned_by_id = 'todo_999';
    expect(validatePortableBackupFile(file).ok).toBe(false);
  });

  it('certifies series content and refuses a missing series parent', () => {
    const file = fileForScope();
    file.entities.todo_recurrence_series![0].title = 'Tampered';
    expect(validatePortableBackupFile(file).ok).toBe(false);
    const missing = fileForScope();
    missing.entities.todo_recurrence_series = [];
    missing.integrity.entities.todo_recurrence_series = checksumRows(
      [],
      backupEntityColumnsForScope(BACKUP_SCOPE_VERSION).todo_recurrence_series,
    );
    missing.integrity.payloadChecksum = computePortablePayloadChecksum(missing);
    const validated = validatePortableBackupFile(missing);
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.errors.join('; ')).toMatch(/missing.*series/i);
  });
});
