import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SETTINGS_VERSION,
  backupEntityColumnsForScope,
  resolveBackupScope,
  type BackupEntity,
  type BackupManifest,
} from './backup.types';
import { checksumRows } from '@/lib/checksum';
import { validateBackupGraph, validateBackupRow } from './backupValidators';
import {
  canonicalizeSettingsPayload,
  isValidRecoverableSettings,
  normalizeRecoverableSettings,
} from './backupSettings';

export function parseManifestRow(row: unknown): BackupManifest | null {
  if (!row || typeof row !== 'object') return null;
  const candidate = row as Record<string, unknown>;
  if (
    typeof candidate.backup_schema_version !== 'number' ||
    typeof candidate.generation !== 'number' ||
    typeof candidate.completed_at !== 'string' ||
    typeof candidate.entity_metadata !== 'object' ||
    candidate.entity_metadata === null ||
    typeof candidate.settings_version !== 'number'
  ) {
    return null;
  }
  const entityMetadata = candidate.entity_metadata as Record<string, unknown>;
  const metadata: BackupManifest['entityMetadata'] = {};
  for (const [entity, value] of Object.entries(entityMetadata)) {
    if (!value || typeof value !== 'object') return null;
    const meta = value as Record<string, unknown>;
    if (typeof meta.count !== 'number' || !Number.isInteger(meta.count) || meta.count < 0) {
      return null;
    }
    if (typeof meta.checksum !== 'string' || !/^[0-9a-f]{64}$/.test(meta.checksum)) {
      return null;
    }
    // Unknown/future entity keys are not cast into the BackupEntity type:
    // they are excluded here so scope resolution downstream still classifies
    // the manifest honestly (unknown scopes fail closed) instead of this
    // parser inventing entity names it does not understand.
    if (!(BACKUP_ENTITIES as readonly string[]).includes(entity)) continue;
    metadata[entity as BackupEntity] = { count: meta.count, checksum: meta.checksum };
  }
  // Settings integrity metadata (closure contract). A v2 manifest without it
  // cannot certify the settings payload — the caller treats it as incomplete.
  let settingsMetadata: BackupManifest['settingsMetadata'];
  const rawSettingsMetadata = candidate.settings_metadata;
  if (rawSettingsMetadata !== null && rawSettingsMetadata !== undefined) {
    if (typeof rawSettingsMetadata !== 'object') return null;
    const meta = rawSettingsMetadata as Record<string, unknown>;
    if (typeof meta.version !== 'number' || typeof meta.checksum !== 'string') return null;
    if (!/^[0-9a-f]{64}$/.test(meta.checksum)) return null;
    settingsMetadata = { version: meta.version, checksum: meta.checksum };
  }
  return {
    backupSchemaVersion: candidate.backup_schema_version,
    backupScopeVersion:
      typeof candidate.backup_scope_version === 'number' ? candidate.backup_scope_version : -1,
    generation: candidate.generation,
    completedAt: candidate.completed_at,
    entityMetadata: metadata,
    settingsVersion: candidate.settings_version,
    settingsMetadata,
  };
}

/** Read and certify the old contract before staging a safe first-generation cutover. */
export async function readVerifiedLegacySnapshot(
  client: SupabaseClient,
  ownerUserId: string,
): Promise<{
  rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
  settingsPayload: ReturnType<typeof normalizeRecoverableSettings>;
} | null> {
  const manifestResult = await client
    .from('backup_manifest')
    .select('*')
    .eq('user_id', ownerUserId)
    .limit(1);
  if (manifestResult.error)
    throw new Error(
      `Backup upgrade paused: cannot inspect the previous manifest (${manifestResult.error.message}). Apply the current backup migrations and retry.`,
    );
  const raw: unknown = manifestResult.data?.[0];
  if (!raw) {
    // V1 partial content must keep its existing reader and partial label. An
    // incomplete upload or old partial account is not an empty new account.
    for (const entity of [...BACKUP_ENTITIES, 'user_backup_settings']) {
      const result = await client.from(entity).select('*').eq('user_id', ownerUserId).limit(1);
      if (result.error)
        throw new Error(
          `Backup upgrade paused: cannot establish that ${entity} is empty (${result.error.message}).`,
        );
      if ((result.data ?? []).length > 0)
        throw new Error(
          'Backup upgrade paused: this account contains a legacy partial backup without an integrity manifest. Restore it through the legacy path on an empty device and export a portable recovery file before upgrading; the existing remote bytes have been preserved.',
        );
    }
    return null;
  }
  const manifest = parseManifestRow(raw);
  const scope =
    manifest &&
    resolveBackupScope({
      backupScopeVersion: manifest.backupScopeVersion,
      entityMetadata: manifest.entityMetadata,
    });
  if (
    !manifest ||
    manifest.backupSchemaVersion !== BACKUP_SCHEMA_VERSION ||
    !scope ||
    !manifest.settingsMetadata
  ) {
    throw new Error(
      'Backup upgrade paused: the previous backup has an unsupported or incomplete integrity contract; its recovery content has been preserved.',
    );
  }
  const rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
  const columns = backupEntityColumnsForScope(scope.scope);
  for (const entity of scope.entitySet) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += 250) {
      const result = await client
        .from(entity)
        .select('*')
        .eq('user_id', ownerUserId)
        .order('id', { ascending: true })
        .range(from, from + 249);
      if (result.error)
        throw new Error(`Backup upgrade paused: cannot read ${entity} (${result.error.message}).`);
      rows.push(...((result.data ?? []) as Record<string, unknown>[]));
      if ((result.data ?? []).length < 250) break;
    }
    if (rows.some((row) => row.user_id !== ownerUserId || !validateBackupRow(entity, row).ok))
      throw new Error(`Backup upgrade paused: invalid or unowned ${entity} rows.`);
    const actual = checksumRows(rows, columns[entity]);
    const expected = manifest.entityMetadata[entity];
    if (!expected || expected.count !== actual.count || expected.checksum !== actual.checksum)
      throw new Error(
        `Backup upgrade paused: the previous ${entity} recovery bytes do not match their manifest.`,
      );
    rowsByEntity[entity] = rows;
  }
  if (validateBackupGraph(rowsByEntity).length > 0)
    throw new Error('Backup upgrade paused: previous recovery relationships are invalid.');
  const settingsResult = await client
    .from('user_backup_settings')
    .select('*')
    .eq('user_id', ownerUserId)
    .limit(1);
  if (settingsResult.error)
    throw new Error(
      `Backup upgrade paused: cannot inspect settings (${settingsResult.error.message}).`,
    );
  const settings = settingsResult.data?.[0] as Record<string, unknown> | undefined;
  const version = settings?.settings_version;
  if (
    !settings ||
    settings.user_id !== ownerUserId ||
    typeof version !== 'number' ||
    ![2, 3, 4, BACKUP_SETTINGS_VERSION].includes(version) ||
    version !== manifest.settingsVersion ||
    version !== manifest.settingsMetadata.version ||
    !isValidRecoverableSettings(settings.payload)
  )
    throw new Error(
      'Backup upgrade paused: previous settings contract is unsupported or malformed.',
    );
  const normalized = normalizeRecoverableSettings(settings.payload);
  if (
    canonicalizeSettingsPayload(normalized, { settingsVersion: version }) !==
    manifest.settingsMetadata.checksum
  )
    throw new Error(
      'Backup upgrade paused: previous settings fail their frozen integrity contract.',
    );
  return { rowsByEntity, settingsPayload: normalized };
}
