import { sha256Hex } from '@/lib/checksum';
import {
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCOPE_VERSION,
  BACKUP_SETTINGS_VERSION,
} from '@/core/backup/backup.types';
import { GENERATION_PROTOCOL_VERSION, type GenerationChunk } from './generationProtocol';
import { GENERATION_PAYLOAD_BYTES, utf8Bytes } from './requestBudget';

/** Row and byte bounds are independent: wide Unicode rows need smaller chunks. */
export function generationRowPayloads(rows: readonly Record<string, unknown>[]): string[] {
  const payloads: string[] = [];
  let batch: Record<string, unknown>[] = [];
  let bytes = 2;
  for (const row of rows) {
    const size = utf8Bytes(canonicalGenerationRows([row])) - 2;
    if (size + 2 > GENERATION_PAYLOAD_BYTES)
      throw new Error('Backup capture paused: one row exceeds the generation payload budget.');
    if (batch.length && (batch.length >= 250 || bytes + 1 + size > GENERATION_PAYLOAD_BYTES)) {
      payloads.push(canonicalGenerationRows(batch));
      batch = [];
      bytes = 2;
    }
    bytes += (batch.length ? 1 : 0) + size;
    batch.push(row);
  }
  if (batch.length) payloads.push(canonicalGenerationRows(batch));
  return payloads;
}

/** Protocol-1 row bytes. Kept separate from the frozen legacy checksum format. */
export function canonicalGenerationRows(rows: readonly Record<string, unknown>[]): string {
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

export interface GenerationManifest {
  protocolVersion: number;
  backupSchemaVersion: number;
  scopeVersion: number;
  settingsVersion: number;
  snapshotId: string;
  sequence: number;
  capturedAt: string;
  entities: Record<string, { rows: number; checksum: string }>;
  settingsChecksum: string;
}

export interface RemoteGenerationMetadata {
  user_id: string;
  snapshot_id: string;
  sequence: number;
  protocol_version: number;
  backup_schema_version: number;
  scope_version: number;
  settings_version: number;
  manifest: string;
  manifest_checksum: string;
  captured_at: string;
}

/** Verify the actual capture wire format, including metadata/head agreement. */
export function parseGenerationManifest(
  metadata: RemoteGenerationMetadata,
  head: { snapshot_id: string; sequence: number },
  ownerUserId: string,
): GenerationManifest {
  const fail = (detail: string): never => {
    throw new Error(`[restore] Invalid published generation: ${detail}`);
  };
  if (
    metadata.user_id !== ownerUserId ||
    metadata.snapshot_id !== head.snapshot_id ||
    metadata.sequence !== head.sequence ||
    !Number.isSafeInteger(metadata.sequence) ||
    metadata.sequence < 1
  ) {
    return fail('owner, snapshot or sequence disagrees with the pinned head');
  }
  if (
    typeof metadata.manifest !== 'string' ||
    sha256Hex(metadata.manifest) !== metadata.manifest_checksum
  ) {
    return fail('manifest checksum mismatch');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(metadata.manifest);
  } catch {
    return fail('manifest is not valid JSON');
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 1 ||
    !parsed[0] ||
    typeof parsed[0] !== 'object'
  ) {
    return fail('manifest must contain exactly one object');
  }
  const manifest = parsed[0] as GenerationManifest;
  // Content protocol 1 generations are already published history and must stay
  // restorable. GENERATION_PROTOCOL_VERSION is the current CONTENT format (also
  // 1 today — capability/provenance versioning is transport-only, see
  // generationProtocol.ts); a newer unknown content version is still refused.
  const supportedWriteProtocols = [1, GENERATION_PROTOCOL_VERSION];
  if (
    !supportedWriteProtocols.includes(manifest.protocolVersion) ||
    manifest.backupSchemaVersion !== BACKUP_SCHEMA_VERSION ||
    manifest.scopeVersion !== BACKUP_SCOPE_VERSION ||
    manifest.settingsVersion !== BACKUP_SETTINGS_VERSION
  )
    return fail('unsupported protocol or scope');
  if (
    manifest.protocolVersion !== metadata.protocol_version ||
    manifest.backupSchemaVersion !== metadata.backup_schema_version ||
    manifest.scopeVersion !== metadata.scope_version ||
    manifest.settingsVersion !== metadata.settings_version ||
    manifest.snapshotId !== metadata.snapshot_id ||
    manifest.sequence !== metadata.sequence ||
    typeof manifest.capturedAt !== 'string' ||
    Date.parse(manifest.capturedAt) !== Date.parse(metadata.captured_at)
  ) {
    return fail('manifest does not match its metadata');
  }
  if (
    !manifest.entities ||
    typeof manifest.entities !== 'object' ||
    Array.isArray(manifest.entities)
  ) {
    return fail('entity metadata missing');
  }
  const entities = [...BACKUP_ENTITIES, 'user_backup_settings'];
  if (
    Object.keys(manifest.entities).length !== entities.length ||
    Object.keys(manifest.entities).some((entity) => !entities.includes(entity))
  ) {
    return fail('recoverable entity set is incomplete or unknown');
  }
  for (const entity of entities) {
    const entry = manifest.entities[entity];
    if (
      !entry ||
      !Number.isSafeInteger(entry.rows) ||
      entry.rows < 0 ||
      typeof entry.checksum !== 'string' ||
      !/^[0-9a-f]{64}$/.test(entry.checksum)
    ) {
      return fail(`invalid metadata for ${entity}`);
    }
  }
  if (
    manifest.entities.user_backup_settings.rows !== 1 ||
    manifest.entities.user_backup_settings.checksum !== manifest.settingsChecksum
  )
    return fail('settings metadata mismatch');
  return manifest;
}

/** Validate completeness and bytes before accepting any row or settings value. */
export function decodeGenerationContents(
  manifest: GenerationManifest,
  chunks: readonly GenerationChunk[],
): {
  rowsByEntity: Map<string, Record<string, unknown>[]>;
  settingsPayload: unknown;
} {
  const fail = (detail: string): never => {
    throw new Error(`[restore] Invalid published generation: ${detail}`);
  };
  const rowsByEntity = new Map<string, Record<string, unknown>[]>();
  let settingsPayload: unknown;
  for (const chunk of chunks) {
    if (
      chunk.snapshotId !== manifest.snapshotId ||
      !(chunk.entity in manifest.entities) ||
      !Number.isSafeInteger(chunk.ordinal) ||
      chunk.ordinal < 0 ||
      typeof chunk.payload !== 'string' ||
      utf8Bytes(chunk.payload) > GENERATION_PAYLOAD_BYTES ||
      sha256Hex(chunk.payload) !== chunk.checksum
    ) {
      return fail('chunk identity or checksum mismatch');
    }
  }
  for (const [entity, expected] of Object.entries(manifest.entities)) {
    const entries = chunks
      .filter((chunk) => chunk.entity === entity)
      .sort((a, b) => a.ordinal - b.ordinal);
    // Chunks have both row and byte bounds. Byte-heavy rows yield more chunks.
    if (
      (entity === 'user_backup_settings'
        ? entries.length !== 1
        : expected.rows === 0
          ? entries.length !== 0
          : entries.length === 0) ||
      entries.some((entry, index) => entry.ordinal !== index)
    )
      return fail(`missing/duplicate ordinals for ${entity}`);
    if (entity === 'user_backup_settings') {
      if (entries[0].checksum !== expected.checksum) return fail('settings checksum mismatch');
      try {
        settingsPayload = JSON.parse(entries[0].payload) as unknown;
      } catch {
        return fail('settings payload is not valid JSON');
      }
      continue;
    }
    const rows: Record<string, unknown>[] = [];
    for (const entry of entries) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(entry.payload);
      } catch {
        return fail(`malformed JSON rows for ${entity}`);
      }
      if (
        !Array.isArray(parsed) ||
        parsed.length < 1 ||
        parsed.length > 250 ||
        parsed.some((row: unknown) => !row || typeof row !== 'object' || Array.isArray(row))
      )
        return fail(`malformed rows for ${entity}`);
      rows.push(...(parsed as Record<string, unknown>[]));
    }
    if (
      rows.length !== expected.rows ||
      sha256Hex(canonicalGenerationRows(rows)) !== expected.checksum
    )
      return fail(`entity integrity mismatch for ${entity}`);
    const ids = rows.map((row) => row.id);
    if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length)
      return fail(`invalid/duplicate ids for ${entity}`);
    rowsByEntity.set(entity, rows);
  }
  return { rowsByEntity, settingsPayload };
}
