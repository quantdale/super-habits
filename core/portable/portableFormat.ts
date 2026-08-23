import {
  BACKUP_ENTITY_COLUMNS,
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCOPE_VERSION,
  BACKUP_SETTINGS_VERSION,
  BACKUP_SCOPE_V4_ENTITY_COLUMNS,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET,
  PORTABLE_V1_ENTITY_COLUMNS,
  type BackupEntity,
} from '@/core/backup/backup.types';
import {
  canonicalizeSettingsPayload,
  canonicalSettingsPayloadText,
  isValidRecoverableSettings,
  normalizeRecoverableSettings,
} from '@/core/backup/backupSettings';
import { validateBackupGraph, validateBackupRow } from '@/core/backup/backupValidators';
import { canonicalizeRow, checksumRows, sha256Hex } from '@/lib/checksum';
import {
  PORTABLE_BACKUP_FORMAT,
  PORTABLE_BACKUP_FORMAT_VERSION,
  type PortableBackupFile,
} from '@/core/portable/portable.types';

/**
 * Portable backup envelope — canonicalization + validation (pure).
 *
 * The payload checksum is computed over a documented canonical text that
 * covers the envelope identity fields and every canonical row, so a
 * user-edited file (row value, ordering, fingerprint, timestamp, integrity
 * block) is detected before any local write. Canonicalization rules:
 *
 *   - envelope identity fields in fixed order, one per line
 *     (`format`, `formatVersion`, `backupSchemaVersion`, `exportedAt`,
 *     `appVersion`, `platform`, `ownerFingerprint` — `null` renders as the
 *     literal `null`);
 *   - `entities:` marker, then one entity block per entity in
 *     `BACKUP_ENTITIES` order: the entity name line, then one canonical row
 *     line per row (`JSON.stringify` of `{column: value}` in
 *     `BACKUP_ENTITY_COLUMNS` order, `undefined` normalized to `null`),
 *     rows sorted by id — so row order and JSON key order never affect the
 *     checksum;
 *   - `settings:` marker, then the canonical settings text
 *     (`canonicalSettingsPayloadText`) as one line.
 *
 * `integrity.payloadChecksum` itself is excluded (no self-reference).
 */

const HEX64 = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Row comparator used by both the file layout and the payload text. */
function byId(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const aId = typeof a.id === 'string' ? a.id : '';
  const bId = typeof b.id === 'string' ? b.id : '';
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

function sortedRows(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort(byId);
}

function setEqualsExactly(keys: string[], expected: readonly string[]): boolean {
  if (keys.length !== expected.length) return false;
  const set = new Set(keys);
  return expected.every((entity) => set.has(entity));
}

/**
 * Deterministic canonical payload text for the portable envelope. Takes the
 * full file but reads only the covered fields, so `integrity` (including
 * `payloadChecksum`) is excluded by construction.
 *
 * The entity iteration order and column set are parameters so historical
 * Portable V1 files (formatVersion 1) canonicalize/verify with their original
 * column order/shape — otherwise their stored checksums would no longer match
 * after the recoverable scope grew. When omitted, the current scope is used.
 */
export function canonicalPortablePayloadText(
  file: PortableBackupFile,
  options?: {
    entities?: readonly BackupEntity[];
    columns?: Record<BackupEntity, readonly string[]>;
    settingsVersion?: number;
  },
): string {
  const entities = options?.entities ?? BACKUP_ENTITIES;
  const columns = options?.columns ?? BACKUP_ENTITY_COLUMNS;
  const settingsVersion = options?.settingsVersion ?? BACKUP_SETTINGS_VERSION;
  const lines: string[] = [
    `format:${PORTABLE_BACKUP_FORMAT}`,
    `formatVersion:${file.formatVersion}`,
    `backupSchemaVersion:${file.backupSchemaVersion}`,
    `exportedAt:${file.exportedAt}`,
    `appVersion:${file.source.appVersion}`,
    `platform:${file.source.platform}`,
    `ownerFingerprint:${file.source.ownerFingerprint ?? 'null'}`,
    'entities:',
  ];
  for (const entity of entities) {
    lines.push(entity);
    const entityColumns = columns[entity];
    for (const row of sortedRows(file.entities[entity] ?? [])) {
      lines.push(canonicalizeRow(row, entityColumns));
    }
  }
  lines.push('settings:');
  lines.push(canonicalSettingsPayloadText(file.settings, { settingsVersion }));
  return lines.join('\n');
}

export function computePortablePayloadChecksum(
  file: PortableBackupFile,
  options?: {
    entities?: readonly BackupEntity[];
    columns?: Record<BackupEntity, readonly string[]>;
    settingsVersion?: number;
  },
): string {
  return sha256Hex(canonicalPortablePayloadText(file, options));
}

/**
 * Build a complete, integrity-verified portable file from a coherent local
 * snapshot. Rows are stored sorted by id; entity + settings checksums and
 * the payload checksum are computed here.
 */
export function buildPortableBackupFile(input: {
  exportedAt: string;
  appVersion: string;
  platform: string;
  ownerFingerprint: string | null;
  rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
  settings: unknown;
}): PortableBackupFile {
  const entities: PortableBackupFile['entities'] = {};
  const entityIntegrity: PortableBackupFile['integrity']['entities'] = {};
  for (const entity of BACKUP_ENTITIES) {
    const rows = sortedRows(input.rowsByEntity[entity] ?? []);
    entities[entity] = rows;
    entityIntegrity[entity] = checksumRows(rows, BACKUP_ENTITY_COLUMNS[entity]);
  }
  const normalizedSettings = normalizeRecoverableSettings(input.settings);
  const settingsChecksum = canonicalizeSettingsPayload(normalizedSettings);
  const file: PortableBackupFile = {
    format: PORTABLE_BACKUP_FORMAT,
    formatVersion: PORTABLE_BACKUP_FORMAT_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    backupScopeVersion: BACKUP_SCOPE_VERSION,
    exportedAt: input.exportedAt,
    source: {
      appVersion: input.appVersion,
      platform: input.platform,
      ownerFingerprint: input.ownerFingerprint,
    },
    entities,
    settings: normalizedSettings,
    integrity: {
      entities: entityIntegrity,
      settings: { version: BACKUP_SETTINGS_VERSION, checksum: settingsChecksum },
      // Placeholder replaced below — the canonical payload text never reads
      // `integrity`, so the checksum excludes itself by construction.
      payloadChecksum: '',
    },
  };
  file.integrity.payloadChecksum = computePortablePayloadChecksum(file);
  return file;
}

/** Deterministic, archive-friendly filename from the export timestamp. */
export function portableExportFileName(exportedAt: string): string {
  const safe = exportedAt.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
  return `superhabits-backup-${safe}.json`;
}

/** Human-readable byte size for user-facing copy (no technical byte counts). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PortableValidationResult =
  { ok: true; file: PortableBackupFile } | { ok: false; errors: string[] };

/**
 * Validate an untrusted parsed portable file. EVERY check runs before any
 * local write; the strict contract (exact entity set, exact versions,
 * verified checksums, verified graph) rejects malformed, tampered, and
 * unsupported files safely.
 */
export function validatePortableBackupFile(input: unknown): PortableValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ['The selected file is not a JSON object.'] };
  }

  if (input.format !== PORTABLE_BACKUP_FORMAT) {
    errors.push(
      `The file is not a Super Habits portable backup (format "${String(input.format)}").`,
    );
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (typeof input.formatVersion !== 'number' || !Number.isInteger(input.formatVersion)) {
    errors.push('The file is missing a valid portable format version.');
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (input.formatVersion > PORTABLE_BACKUP_FORMAT_VERSION) {
    errors.push(
      `This file uses portable format version ${input.formatVersion}, which requires a newer app.`,
    );
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (input.formatVersion !== 1 && input.formatVersion !== PORTABLE_BACKUP_FORMAT_VERSION) {
    errors.push(`Portable format version ${input.formatVersion} is not supported.`);
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (
    typeof input.backupSchemaVersion !== 'number' ||
    !Number.isInteger(input.backupSchemaVersion)
  ) {
    errors.push('The file is missing a valid backup schema version.');
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (input.backupSchemaVersion > BACKUP_SCHEMA_VERSION) {
    errors.push(
      `This file uses backup schema version ${input.backupSchemaVersion}, which requires a newer app.`,
    );
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (input.backupSchemaVersion !== BACKUP_SCHEMA_VERSION) {
    errors.push(`Backup schema version ${input.backupSchemaVersion} is not supported.`);
    return { ok: false, errors: errors.slice(0, 50) };
  }
  if (typeof input.exportedAt !== 'string' || !Number.isFinite(Date.parse(input.exportedAt))) {
    errors.push('The file has an invalid export timestamp.');
  }
  if (!isRecord(input.source)) {
    errors.push('The file is missing source information.');
  } else {
    if (typeof input.source.appVersion !== 'string') errors.push('Source app version is invalid.');
    if (typeof input.source.platform !== 'string') errors.push('Source platform is invalid.');
    const fingerprint = input.source.ownerFingerprint;
    if (fingerprint !== null && (typeof fingerprint !== 'string' || !HEX64.test(fingerprint))) {
      errors.push('Source owner fingerprint is invalid.');
    }
  }
  if (!isRecord(input.entities)) {
    errors.push('The file is missing entity data.');
    return { ok: false, errors: errors.slice(0, 50) };
  }
  const entities = input.entities;
  const entityKeys = Object.keys(entities);

  // Resolve the exact recoverable scope this file claims. Historical V1 files
  // (formatVersion 1) are identified by their EXACT entity set; the known
  // historical epochs are the 12-entity pre-Weekly-Review scope, the 13-entity
  // Weekly-Review scope, and the 16-entity planning scope. FormatVersion-2
  // files carry an explicit scope version and may be scope 4 (frozen V4
  // columns) or the current scope — a future scope is rejected as requiring a
  // newer app. Any other/partial set is rejected — scope is never inferred
  // permissively ("missing table = empty").
  let scopeEntities: readonly BackupEntity[];
  let scopeColumns: Record<BackupEntity, readonly string[]>;
  if (input.formatVersion === 1) {
    if (setEqualsExactly(entityKeys, KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET)) {
      scopeEntities = KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET;
      scopeColumns = PORTABLE_V1_ENTITY_COLUMNS as Record<BackupEntity, readonly string[]>;
    } else if (setEqualsExactly(entityKeys, KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET)) {
      scopeEntities = KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET;
      scopeColumns = PORTABLE_V1_ENTITY_COLUMNS as Record<BackupEntity, readonly string[]>;
    } else {
      errors.push('The file uses an unrecognized or partial backup scope and cannot be imported.');
      return { ok: false, errors: errors.slice(0, 50) };
    }
  } else {
    const explicitScope = input.backupScopeVersion;
    const isCurrentScope =
      typeof explicitScope === 'number' &&
      Number.isInteger(explicitScope) &&
      explicitScope === BACKUP_SCOPE_VERSION;
    const isHistoricalScope4 =
      typeof explicitScope === 'number' && Number.isInteger(explicitScope) && explicitScope === 4;
    if (
      typeof explicitScope !== 'number' ||
      !Number.isInteger(explicitScope) ||
      (!isCurrentScope && !isHistoricalScope4)
    ) {
      errors.push(
        `This file uses backup scope version ${String(input.backupScopeVersion)}, which this app cannot import.`,
      );
      return { ok: false, errors: errors.slice(0, 50) };
    }
    const expectedEntities: readonly BackupEntity[] = isCurrentScope
      ? BACKUP_ENTITIES
      : KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET;
    const missing = [...expectedEntities].filter((entity) => !(entity in entities));
    const unknown = entityKeys.filter(
      (key) => !(expectedEntities as readonly string[]).includes(key),
    );
    if (missing.length > 0) {
      errors.push(`The file is missing the complete backup scope: ${missing.join(', ')}.`);
    }
    if (unknown.length > 0) {
      errors.push(`The file contains unsupported data groups: ${unknown.join(', ')}.`);
    }
    if (missing.length > 0 || unknown.length > 0) {
      return { ok: false, errors: errors.slice(0, 50) };
    }
    scopeEntities = expectedEntities;
    scopeColumns = isCurrentScope
      ? BACKUP_ENTITY_COLUMNS
      : (BACKUP_SCOPE_V4_ENTITY_COLUMNS as Record<BackupEntity, readonly string[]>);
  }

  for (const entity of scopeEntities) {
    if (!Array.isArray(entities[entity])) {
      errors.push(`The file's ${entity} data is not a list.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };

  const rowsByEntity = entities as unknown as Partial<
    Record<BackupEntity, Record<string, unknown>[]>
  >;

  // Per-row runtime validation (shared with cloud Restore V2). The validator
  // tolerates absent nullable columns, so it is safe for both current rows
  // (which carry `project_id`/`goal_id`/`completed_at`) and historical V1
  // rows (which omit them).
  let rowErrors = 0;
  for (const entity of scopeEntities) {
    for (const row of rowsByEntity[entity] ?? []) {
      const validation = validateBackupRow(entity, row);
      if (!validation.ok) {
        rowErrors += 1;
        if (rowErrors <= 50) errors.push(`${entity}: ${validation.errors.join('; ')}`);
      }
    }
  }
  if (rowErrors > 50) errors.push(`... and ${rowErrors - 50} more malformed rows.`);
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };

  if (!isRecord(input.integrity)) {
    errors.push('The file is missing integrity metadata.');
    return { ok: false, errors: errors.slice(0, 50) };
  }
  const integrity = input.integrity;
  const entityIntegrity = integrity.entities as Record<string, unknown> | undefined;
  if (!isRecord(entityIntegrity)) errors.push('Entity integrity metadata is missing.');
  if (!isRecord(integrity.settings)) errors.push('Settings integrity metadata is missing.');
  if (typeof integrity.payloadChecksum !== 'string' || !HEX64.test(integrity.payloadChecksum)) {
    errors.push('The payload checksum is missing or invalid.');
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };

  // Entity checksums: count + deterministic SHA-256 per entity, using the
  // resolved scope's column set (historical V1 columns for V1 files).
  const entityIntegrityRecord = isRecord(entityIntegrity) ? entityIntegrity : {};
  for (const entity of scopeEntities) {
    const expected = entityIntegrityRecord[entity] as Record<string, unknown> | undefined;
    if (
      !expected ||
      typeof expected.count !== 'number' ||
      !Number.isInteger(expected.count) ||
      expected.count < 0 ||
      typeof expected.checksum !== 'string' ||
      !HEX64.test(expected.checksum)
    ) {
      errors.push(`${entity}: integrity metadata is malformed.`);
      continue;
    }
    const actual = checksumRows(rowsByEntity[entity] ?? [], scopeColumns[entity]);
    if (expected.count !== actual.count || expected.checksum !== actual.checksum) {
      errors.push(
        `${entity}: integrity mismatch (expected ${expected.count} rows / ${expected.checksum}; found ${actual.count} / ${actual.checksum}).`,
      );
    }
  }

  // Settings: runtime validation, contract version, canonical checksum.
  // Historical V2/V3 payloads verify against their frozen canonical texts; the
  // current version canonicalizes with the live field set.
  const settings = integrity.settings as Record<string, unknown>;
  const settingsVersion = settings.version;
  const isCurrentSettingsVersion = settingsVersion === BACKUP_SETTINGS_VERSION;
  const isHistoricalSettingsV2 = settingsVersion === 2;
  const isHistoricalSettingsV3 = settingsVersion === 3;
  const historicalVersion = isHistoricalSettingsV2 ? 2 : isHistoricalSettingsV3 ? 3 : undefined;
  if (!isCurrentSettingsVersion && !isHistoricalSettingsV2 && !isHistoricalSettingsV3) {
    errors.push(`The file carries an unsupported settings version ${String(settings.version)}.`);
  }
  if (typeof settings.checksum !== 'string' || !HEX64.test(settings.checksum)) {
    errors.push('The settings checksum is missing or invalid.');
  }
  if (!isValidRecoverableSettings(input.settings)) {
    errors.push('The file\u2019s settings payload is malformed.');
  } else {
    const normalizedSettings = normalizeRecoverableSettings(input.settings);
    const actualSettingsChecksum = canonicalizeSettingsPayload(normalizedSettings, {
      settingsVersion: historicalVersion ?? BACKUP_SETTINGS_VERSION,
    });
    if (typeof settings.checksum === 'string' && settings.checksum !== actualSettingsChecksum) {
      errors.push('The file\u2019s settings failed integrity verification.');
    }
  }

  // Envelope payload checksum (covers identity fields + every canonical row).
  if (typeof integrity.payloadChecksum === 'string') {
    const candidate = {
      format: input.format,
      formatVersion: input.formatVersion,
      backupSchemaVersion: input.backupSchemaVersion,
      exportedAt: input.exportedAt,
      source: input.source,
      entities: rowsByEntity,
      settings: normalizeRecoverableSettings(input.settings),
    } as unknown as PortableBackupFile;
    const actualPayloadChecksum = computePortablePayloadChecksum(candidate, {
      entities: scopeEntities,
      columns: scopeColumns,
      settingsVersion: historicalVersion ?? BACKUP_SETTINGS_VERSION,
    });
    if (actualPayloadChecksum !== integrity.payloadChecksum) {
      errors.push(
        'The file\u2019s payload failed integrity verification; it may have been edited.',
      );
    }
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 50) };

  // Dependency graph (shared with cloud Restore V2).
  const graphErrors = validateBackupGraph(rowsByEntity);
  if (graphErrors.length > 0) {
    return {
      ok: false,
      errors: graphErrors.slice(0, 50).map((error) => `Broken relationship: ${error}`),
    };
  }

  return {
    ok: true,
    file: input as unknown as PortableBackupFile,
  };
}
