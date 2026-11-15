import { createHash } from 'node:crypto';
import type { Route } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import {
  BACKUP_ENTITIES,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V5_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V6_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET,
  KNOWN_HISTORICAL_BACKUP_SCOPE_V8_ENTITY_SET,
} from '@/core/backup/backup.types';
import { GenerationSupabaseMock } from '../e2e/helpers/generationSupabaseMock';

const OWNER = 'mock-owner';
const SNAPSHOT = 'mock-snapshot';
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const SCOPES = [
  [2, KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET],
  [3, KNOWN_HISTORICAL_BACKUP_SCOPE_V3_ENTITY_SET],
  [4, KNOWN_HISTORICAL_BACKUP_SCOPE_V4_ENTITY_SET],
  [5, KNOWN_HISTORICAL_BACKUP_SCOPE_V5_ENTITY_SET],
  [6, KNOWN_HISTORICAL_BACKUP_SCOPE_V6_ENTITY_SET],
  [7, KNOWN_HISTORICAL_BACKUP_SCOPE_V7_ENTITY_SET],
  [8, KNOWN_HISTORICAL_BACKUP_SCOPE_V8_ENTITY_SET],
  [9, BACKUP_ENTITIES],
] as const;

type Reply = { status?: number; body?: string; headers?: Record<string, string> };
async function request(mock: GenerationSupabaseMock, name: string, body?: unknown) {
  let reply: Reply | null = null;
  const route = {
    request: () => ({
      url: () => `https://dummy.supabase.co/rest/v1/${name}`,
      method: () => (body === undefined ? 'GET' : 'POST'),
      postDataJSON: () => body,
    }),
    fulfill: async (value: Reply) => {
      reply = value;
    },
  };
  expect(await mock.handle(route as unknown as Route, OWNER)).toBe(true);
  return reply as Reply | null;
}

async function publish(
  scope: number,
  names: readonly string[],
  options: {
    metadataScope?: number;
    ordinal?: number;
    checksum?: string;
    extraChunk?: boolean;
  } = {},
) {
  const mock = new GenerationSupabaseMock();
  // Transport-only fixtures: SQL row/domain/RLS qualification remains separate.
  const settings = '{}';
  const descriptions: Record<string, { rows: number; checksum: string }> = Object.fromEntries(
    names.map((name) => [name, { rows: 0, checksum: sha('[]') }]),
  );
  descriptions.user_backup_settings = { rows: 1, checksum: sha(settings) };
  const manifest = JSON.stringify([
    {
      protocolVersion: 1,
      backupSchemaVersion: 2,
      scopeVersion: scope,
      settingsVersion: 5,
      snapshotId: SNAPSHOT,
      sequence: 1,
      capturedAt: '2026-11-15T12:00:00.000Z',
      entities: descriptions,
      settingsChecksum: sha(settings),
    },
  ]);
  const base = {
    p_snapshot_id: SNAPSHOT,
    p_provenance_version: 1,
    p_base_head_snapshot_id: null,
    p_base_head_sequence: null,
  };
  expect((await request(mock, 'rpc/reserve_backup_generation_sequence', base))?.status).toBe(200);
  expect(
    (
      await request(mock, 'backup_generation', {
        user_id: OWNER,
        snapshot_id: SNAPSHOT,
        sequence: 1,
        protocol_version: 1,
        backup_schema_version: 2,
        scope_version: options.metadataScope ?? scope,
        settings_version: 5,
        manifest,
        manifest_checksum: sha(manifest),
        captured_at: '2026-11-15T12:00:00.000Z',
        base_head_snapshot_id: null,
        base_head_sequence: null,
        publication_provenance_version: 1,
      })
    )?.status,
  ).toBe(201);
  const chunks = [
    {
      user_id: OWNER,
      snapshot_id: SNAPSHOT,
      entity: 'user_backup_settings',
      ordinal: options.ordinal ?? 0,
      payload: settings,
      checksum: options.checksum ?? sha(settings),
    },
  ];
  if (options.extraChunk) {
    chunks.push({
      user_id: OWNER,
      snapshot_id: SNAPSHOT,
      entity: 'uncertified_table',
      ordinal: 0,
      payload: '[]',
      checksum: sha('[]'),
    });
  }
  expect((await request(mock, 'backup_generation_chunk', chunks))?.status).toBe(201);
  return request(mock, 'rpc/publish_backup_generation', {
    ...base,
    p_manifest_checksum: sha(manifest),
    p_expected_chunk_count: chunks.length,
    p_expected_previous_sequence: 0,
  });
}

describe('generation HTTP double preserves exact historical scopes', () => {
  it.each(SCOPES)('publishes a complete Scope %i transport envelope', async (scope, entities) => {
    const reply = await publish(scope, entities);
    expect(reply?.body).not.toContain('Invalid');
    expect(reply?.status).toBe(200);
  });

  it('rejects an unknown future epoch even with familiar current names', async () => {
    expect((await publish(10, BACKUP_ENTITIES))?.status).toBe(409);
  });

  it('rejects a current envelope missing the recurrence series group', async () => {
    const names = BACKUP_ENTITIES.filter((name) => name !== 'todo_recurrence_series');
    expect((await publish(9, names))?.status).toBe(409);
  });

  it('rejects future groups attached to a historical scope', async () => {
    expect((await publish(7, BACKUP_ENTITIES))?.status).toBe(409);
  });

  it('rejects an unknown manifest group even when its declared row count is zero', async () => {
    expect((await publish(9, [...BACKUP_ENTITIES, 'uncertified_table']))?.status).toBe(409);
  });

  it('rejects disagreement between metadata and manifest epochs', async () => {
    expect((await publish(9, BACKUP_ENTITIES, { metadataScope: 7 }))?.status).toBe(409);
  });

  it('rejects staged chunks outside the certified entity set', async () => {
    expect((await publish(9, BACKUP_ENTITIES, { extraChunk: true }))?.status).toBe(409);
  });

  it('seeds a truthful current empty retained point rather than mislabeled Scope 7', async () => {
    const mock = new GenerationSupabaseMock();
    mock.seedEmptyPublishedPoint(OWNER);
    const reply = await request(mock, 'backup_generation');
    const metadata = JSON.parse(reply?.body ?? '[]') as {
      scope_version: number;
      manifest: string;
    }[];
    expect(metadata).toHaveLength(1);
    expect(metadata[0].scope_version).toBe(9);
    const manifest = JSON.parse(metadata[0].manifest) as {
      scopeVersion: number;
      entities: Record<string, unknown>;
    }[];
    expect(manifest[0].scopeVersion).toBe(9);
    expect(Object.keys(manifest[0].entities).sort()).toEqual(
      [...BACKUP_ENTITIES, 'user_backup_settings'].sort(),
    );
  });

  it('continues rejecting wrong checksums', async () => {
    expect((await publish(9, BACKUP_ENTITIES, { checksum: sha('tampered') }))?.status).toBe(409);
  });

  it('continues rejecting noncontiguous chunk ordinals', async () => {
    expect((await publish(9, BACKUP_ENTITIES, { ordinal: 1 }))?.status).toBe(409);
  });
});
