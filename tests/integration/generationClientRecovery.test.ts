import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { GenerationRemoteDouble } from './helpers/generationRemoteDouble';
import {
  BACKUP_ENTITIES,
  BACKUP_SCOPE_VERSION,
  BACKUP_SETTINGS_VERSION,
} from '@/core/backup/backup.types';
import { checksumRows } from '@/lib/checksum';
import {
  BACKUP_REQUEST_BYTES,
  GENERATION_PAYLOAD_BYTES,
} from '@/core/backup/generations/requestBudget';

/** Full transport double, not a second backup implementation: actual capture,
 * adapter, validators and restore run against real SQLite. SQL contract proof is
 * separately exercised by the disposable PostgreSQL qualification script. */
function remote() {
  const generations = new GenerationRemoteDouble();
  const tables = new Map<string, Record<string, unknown>[]>();
  const writes: string[] = [];
  const requests: { entity: string; bytes: number }[] = [];
  let failPublish = false;
  let capabilities = true;
  let capabilityProtocol = 2;
  let failManifestRead = false;
  let raceNextPublish = false;
  let loseAcknowledgement = false;
  let loseAcknowledgementThenNewerHead = false;
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
      if (!capabilities) return { data: null, error: { message: 'missing capability RPC' } };
      if (name === 'backup_generation_capabilities' && capabilityProtocol !== 2) {
        return {
          data: {
            protocol_version: capabilityProtocol,
            publication_provenance_version: 1,
            content_verification_version: 1,
            sequence_reservation_version: 1,
            backup_schema_version: 2,
            scope_version: 7,
            settings_version: 5,
          },
          error: null,
        };
      }
      if (name === 'publish_backup_generation' && failPublish)
        return { data: null, error: { message: 'publication interrupted' } };
      if (name === 'publish_backup_generation' && raceNextPublish) {
        raceNextPublish = false;
        const candidate = generations.generations.get(`user_a:${String(args.p_snapshot_id)}`)!;
        const sequence = Number(candidate.sequence) + 1;
        generations.generations.set('user_a:concurrent', { sequence });
        generations.heads.set('user_a', { snapshot_id: 'concurrent', sequence });
        return { data: null, error: { message: 'stale sequence' } };
      }
      if (name === 'publish_backup_generation' && loseAcknowledgementThenNewerHead) {
        loseAcknowledgementThenNewerHead = false;
        generations.rpc(name, args);
        const sequence = generations.heads.get('user_a')!.sequence + 1;
        generations.generations.set('user_a:later', { sequence });
        generations.heads.set('user_a', { snapshot_id: 'later', sequence });
        return { data: null, error: { message: 'response lost after commit' } };
      }
      if (name === 'publish_backup_generation' && loseAcknowledgement) {
        loseAcknowledgement = false;
        generations.rpc(name, args);
        return { data: null, error: { message: 'response lost after commit' } };
      }
      return generations.rpc(name, args);
    }),
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (input: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(input) ? input : [input];
        writes.push(entity);
        requests.push({ entity, bytes: Buffer.byteLength(JSON.stringify(input), 'utf8') });
        if (entity.startsWith('backup_generation')) return generations.upsert(entity, rows);
        const previous = tables.get(entity) ?? [];
        for (const row of rows) {
          const index = previous.findIndex(
            (candidate) =>
              candidate.user_id === row.user_id &&
              (row.id === undefined || row.id === candidate.id),
          );
          if (index === -1) previous.push({ ...row });
          else previous[index] = { ...row };
        }
        tables.set(entity, previous);
        return { error: null };
      }),
      select: vi.fn(() => {
        const filters: [string, unknown][] = [];
        let ids: string[] | undefined;
        const rows = () => {
          const candidates =
            entity === 'backup_generation_head'
              ? [...generations.heads].map(([user_id, head]) => ({ user_id, ...head }))
              : entity === 'backup_generation_publication'
                ? [...generations.publications.values()]
                : entity === 'backup_generation'
                  ? [...generations.generations.values()]
                  : entity === 'backup_generation_chunk'
                    ? [...generations.chunks.values()]
                    : (tables.get(entity) ?? []);
          return candidates
            .filter((row) => filters.every(([column, value]) => row[column] === value))
            .filter((row) => !ids || ids.includes(String(row.id)))
            .sort(
              (a, b) =>
                String(a.entity ?? a.id).localeCompare(String(b.entity ?? b.id)) ||
                Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0),
            );
        };
        const answer = (from: number, to: number) =>
          failManifestRead && entity === 'backup_manifest'
            ? { data: null, error: { message: 'mutable manifest unavailable' } }
            : { data: rows().slice(from, to + 1), error: null };
        const query = {
          eq: vi.fn((column: string, value: unknown) => {
            filters.push([column, value]);
            return query;
          }),
          in: vi.fn((_column: string, values: string[]) => {
            ids = values;
            return query;
          }),
          order: vi.fn(() => query),
          limit: vi.fn(async (count: number) => answer(0, count - 1)),
          range: vi.fn(async (from: number, to: number) => answer(from, to)),
        };
        return query;
      }),
    })),
  };
  return {
    client,
    generations,
    tables,
    writes,
    requests,
    setFailPublish: (value: boolean) => {
      failPublish = value;
    },
    setCapabilities: (value: boolean) => {
      capabilities = value;
    },
    setCapabilityProtocol: (value: number) => {
      capabilityProtocol = value;
    },
    setFailManifestRead: (value: boolean) => {
      failManifestRead = value;
    },
    raceNextPublish: () => {
      raceNextPublish = true;
    },
    loseAcknowledgement: () => {
      loseAcknowledgement = true;
    },
    loseAcknowledgementThenNewerHead: () => {
      loseAcknowledgementThenNewerHead = true;
    },
  };
}

function install(client: ReturnType<typeof remote>['client']) {
  vi.doMock('@/lib/supabase', () => ({
    supabase: client,
    isRemoteEnabled: () => true,
    getSupabaseAuthUserId: async () => 'user_a',
    getSupabaseSessionUserId: async () => 'user_a',
  }));
}

async function device(
  client: ReturnType<typeof remote>['client'],
  populated = true,
  filename?: string,
) {
  install(client);
  const db = await freshDatabase(filename);
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  if (populated)
    await db.runAsync(
      `INSERT INTO todos(id,title,completed,priority,sort_order,created_at,updated_at) VALUES('todo_1792195200000_abcdef12','Original',0,'normal',1,'2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z')`,
    );
  return db;
}

async function seedLegacy(
  db: TestDatabase,
  target: ReturnType<typeof remote>,
  scope = BACKUP_SCOPE_VERSION,
) {
  const { readRecoverableSettings, canonicalizeSettingsPayload } =
    await import('@/core/backup/backupSettings');
  const { backupEntityColumnsForScope } = await import('@/core/backup/backup.types');
  const payload = await readRecoverableSettings(db as never);
  const entityMetadata: Record<string, unknown> = {};
  for (const entity of BACKUP_ENTITIES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${entity} ORDER BY id`,
    );
    entityMetadata[entity] = checksumRows(rows, backupEntityColumnsForScope(scope)[entity]);
    target.tables.set(
      entity,
      rows.map((row) => ({ ...row, user_id: 'user_a' })),
    );
  }
  target.tables.set('user_backup_settings', [
    { user_id: 'user_a', settings_version: BACKUP_SETTINGS_VERSION, payload },
  ]);
  target.tables.set('backup_manifest', [
    {
      user_id: 'user_a',
      backup_schema_version: 2,
      backup_scope_version: scope,
      generation: 1,
      completed_at: '2026-10-18T00:00:00.000Z',
      entity_metadata: entityMetadata,
      settings_version: BACKUP_SETTINGS_VERSION,
      settings_metadata: {
        version: BACKUP_SETTINGS_VERSION,
        checksum: canonicalizeSettingsPayload(payload),
      },
    },
  ]);
}

const todoRecord = {
  entity: 'todos',
  id: 'todo_1792195200000_abcdef12',
  operation: 'update' as const,
  updatedAt: '2026-10-19T00:00:00.000Z',
  ownerUserId: 'user_a',
};

describe('review R3: actual capture → publication → restore contracts', () => {
  it.each(['user_backup_settings', 'backup_manifest'])(
    'refuses over-budget synthetic %s uploads while preserving the published point',
    async (entity) => {
      const target = remote();
      const db = await device(target.client);
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const adapter = new SupabaseSyncAdapter();
      await adapter.push([todoRecord]);
      const head = { ...target.generations.heads.get('user_a')! };
      const { appMetaKeys, setAppMetaJson } = await import('@/core/db/appMeta');
      const { readRecoverableSettings, canonicalizeSettingsPayload } =
        await import('@/core/backup/backupSettings');
      const payload = await readRecoverableSettings(db as never);
      payload.theme.slots = Object.fromEntries(
        Array.from({ length: 6000 }, (_, index) => [`slot_${index}`, 'a'.repeat(100)]),
      );
      await setAppMetaJson(db as never, appMetaKeys.backupPendingSettings, { payload });
      await setAppMetaJson(db as never, appMetaKeys.backupPendingManifest, {
        backupSchemaVersion: 2,
        backupScopeVersion: 7,
        generation: 2,
        completedAt: todoRecord.updatedAt,
        entityMetadata: {},
        settingsVersion: BACKUP_SETTINGS_VERSION,
        settingsMetadata: {
          version: BACKUP_SETTINGS_VERSION,
          checksum: canonicalizeSettingsPayload(payload),
        },
      });
      const previousRequests = target.requests.length;
      await expect(adapter.push([{ ...todoRecord, entity, id: 'snapshot' }])).rejects.toThrow(
        /encoded request budget/,
      );
      expect(target.requests.length).toBe(previousRequests);
      expect(target.generations.heads.get('user_a')).toEqual(head);
      expect(await db.getFirstAsync('SELECT title FROM todos')).toEqual({ title: 'Original' });
      await db.closeAsync();
    },
  );
  it('bounds encoded wide Unicode and escaped-text uploads and restores every row', async () => {
    const target = remote();
    const db = await device(target.client, false);
    const notes = '😀"\\'.repeat(1500);
    const records = [];
    for (let index = 0; index < 65; index++) {
      const id = `todo_1792195200000_${String(index).padStart(8, '0')}`;
      await db.runAsync(
        "INSERT INTO todos(id,title,notes,completed,priority,sort_order,created_at,updated_at) VALUES(?,?,?,0,'normal',?,'2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z')",
        [id, `Wide ${index}`, notes, index],
      );
      records.push({ ...todoRecord, id });
    }
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push(records);
    const chunks = [...target.generations.chunks.values()].filter(
      (entry) => entry.entity === 'todos',
    );
    expect(chunks.length).toBeGreaterThan(1); // row-count-only capture produced one huge chunk
    expect(
      chunks.every(
        (entry) => Buffer.byteLength(String(entry.payload), 'utf8') <= GENERATION_PAYLOAD_BYTES,
      ),
    ).toBe(true);
    expect(
      target.requests.filter((request) => request.entity === 'backup_generation_chunk').length,
    ).toBeGreaterThan(1);
    expect(target.requests.every((request) => request.bytes <= BACKUP_REQUEST_BYTES)).toBe(true);
    await db.closeAsync();
    const empty = await device(target.client, false);
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
    expect(
      await empty.getFirstAsync('SELECT count(*) AS n FROM todos WHERE notes=?', [notes]),
    ).toEqual({ n: 65 });
    await empty.closeAsync();
  });
  it('publishes a fresh account before mutable writes and restores without any mutable manifest', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push([todoRecord]);
    expect(target.writes.indexOf('backup_generation_chunk')).toBeLessThan(
      target.writes.indexOf('todos'),
    );
    const head = target.generations.heads.get('user_a')!;
    expect(head.sequence).toBe(1);
    target.setFailManifestRead(true);
    await db.closeAsync();
    const empty = await device(target.client, false);
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
    expect(await empty.getFirstAsync('SELECT title FROM todos')).toEqual({ title: 'Original' });
    const { readVerifiedGenerationBaseHead, captureCurrentGeneration } =
      await import('@/core/backup/generations/capture');
    expect(await readVerifiedGenerationBaseHead(empty as never, 'user_a')).toEqual({
      ownerUserId: 'user_a',
      snapshotId: head.snapshot_id,
      sequence: head.sequence,
    });
    await empty.runAsync("UPDATE todos SET title='Edited after restore'");
    const continued = await captureCurrentGeneration();
    const { SupabaseSyncAdapter: RestoredAdapter } = await import('@/core/sync/supabase.adapter');
    await new RestoredAdapter().push([todoRecord]);
    expect(target.generations.heads.get('user_a')).toEqual({
      snapshot_id: continued.capture.snapshotId,
      sequence: 2,
    });
    expect(
      target.client.from.mock.calls.filter(([entity]) => entity === 'backup_manifest'),
    ).toHaveLength(1); // cutover inspection only
    await empty.closeAsync();
  });

  it.each([6, 7])(
    'preserves a verified scope-%s legacy point through cutover interruption and owner review',
    async (scope) => {
      const target = remote();
      const db = await device(target.client);
      await seedLegacy(db, target, scope);
      await db.runAsync("UPDATE todos SET title='Changed'");
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const adapter = new SupabaseSyncAdapter();
      target.setFailPublish(true);
      await expect(adapter.push([todoRecord])).rejects.toThrow('publication interrupted');
      expect(target.generations.heads.get('user_a')).toBeUndefined();
      expect(target.tables.get('todos')?.[0].title).toBe('Original');

      target.setFailPublish(false);
      await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);
      const retained = target.generations.heads.get('user_a')!;
      expect(retained.sequence).toBe(1);
      expect(target.tables.get('todos')?.[0].title).toBe('Original');
      expect(target.writes.filter((entity) => !entity.startsWith('backup_generation'))).toEqual([]);
      const { readCapturedChunks } = await import('@/core/backup/generations/capture');
      expect((await readCapturedChunks(db as never))?.chunks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ payload: expect.stringContaining('Changed') }),
        ]),
      );
      await db.closeAsync();
      const empty = await device(target.client, false);
      const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
      expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
      expect(await empty.getFirstAsync('SELECT title FROM todos')).toEqual({ title: 'Original' });
      await empty.closeAsync();
    },
  );

  it.each(['unchanged', 'changed remotely', 'other owner'] as const)(
    'continues from a verified legacy restore only for the same owner and %s baseline',
    async (scenario) => {
      const target = remote();
      const source = await device(target.client);
      await seedLegacy(source, target);
      await source.closeAsync();
      const db = await device(target.client, false);
      const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
      expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
      await db.runAsync("UPDATE todos SET title='Edit after legacy restore'");
      if (scenario === 'changed remotely') {
        target.tables.get('todos')![0].title = 'Newer legacy remote';
        const { BACKUP_ENTITY_COLUMNS } = await import('@/core/backup/backup.types');
        const metadata = target.tables.get('backup_manifest')![0].entity_metadata as Record<
          string,
          unknown
        >;
        metadata.todos = checksumRows(target.tables.get('todos')!, BACKUP_ENTITY_COLUMNS.todos);
      }
      if (scenario === 'other owner') {
        const { appMetaKeys, getAppMetaJson, setAppMetaJson } = await import('@/core/db/appMeta');
        const proof = await getAppMetaJson<Record<string, unknown>>(
          db as never,
          appMetaKeys.backupVerifiedLegacyRestore,
        );
        await setAppMetaJson(db as never, appMetaKeys.backupVerifiedLegacyRestore, {
          ...proof,
          ownerUserId: 'user_b',
        });
      }
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const pushing = new SupabaseSyncAdapter().push([todoRecord]);
      if (scenario === 'unchanged') {
        await expect(pushing).resolves.toBeUndefined();
        expect(target.tables.get('todos')?.[0].title).toBe('Edit after legacy restore');
        const { readVerifiedGenerationBaseHead, captureCurrentGeneration } =
          await import('@/core/backup/generations/capture');
        const base = await readVerifiedGenerationBaseHead(db as never, 'user_a');
        expect(base?.snapshotId).toBe(target.generations.heads.get('user_a')?.snapshot_id);
        await captureCurrentGeneration();
        await new SupabaseSyncAdapter().push([todoRecord]);
        expect(target.generations.heads.get('user_a')?.sequence).toBe(2);
      } else {
        await expect(pushing).rejects.toThrow(/conflict|review/i);
        expect(target.writes.filter((entity) => !entity.startsWith('backup_generation'))).toEqual(
          [],
        );
        expect(target.tables.get('todos')?.[0].title).toBe(
          scenario === 'changed remotely' ? 'Newer legacy remote' : 'Original',
        );
      }
      await db.closeAsync();
    },
  );

  it('does not adopt a preserved remote legacy snapshot as the divergent local baseline', async () => {
    const target = remote();
    const db = await device(target.client);
    await seedLegacy(db, target);
    await db.runAsync("UPDATE todos SET title='Divergent local data'");
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');

    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(/conflict|review/i);

    const head = target.generations.heads.get('user_a')!;
    expect(target.generations.generationRows('user_a', head.snapshot_id, 'todos')).toMatchObject([
      { title: 'Original' },
    ]);
    expect(target.tables.get('todos')?.[0].title).toBe('Original');
    expect(target.writes.filter((entity) => !entity.startsWith('backup_generation'))).toEqual([]);
    const { readVerifiedGenerationBaseHead, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    expect(await readVerifiedGenerationBaseHead(db as never, 'user_a')).toBeNull();
    const pending = await readCapturedChunks(db as never);
    expect(pending?.capture.baseHeadSnapshotId).toBeNull();
    expect(pending?.chunks.find((entry) => entry.entity === 'todos')?.payload).toContain(
      'Divergent local data',
    );
    await db.closeAsync();
  });

  it('preserves remote legacy recovery before a previously captured local first upload', async () => {
    const target = remote();
    const db = await device(target.client);
    await seedLegacy(db, target);
    await db.runAsync("UPDATE todos SET title='Previously captured local data'");
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    const local = await captureGeneration({
      settingsPayload: await readRecoverableSettings(db as never),
    });
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');

    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(/conflict|review/i);

    const head = target.generations.heads.get('user_a')!;
    expect(head.snapshot_id).not.toBe(local.capture.snapshotId);
    expect(target.generations.generationRows('user_a', head.snapshot_id, 'todos')).toMatchObject([
      { title: 'Original' },
    ]);
    expect(target.writes.filter((entity) => !entity.startsWith('backup_generation'))).toEqual([]);
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      local.capture.snapshotId,
    );
    await db.closeAsync();
  });

  it('fails closed before any write for unsupported capability or corrupt legacy content', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    target.setCapabilities(false);
    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(
      'does not advertise',
    );
    expect(target.writes).toEqual([]);
    target.setCapabilities(true);
    await seedLegacy(db, target);
    target.tables.get('todos')![0].title = 'Uncertified';
    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow('do not match');
    expect(target.writes).toEqual([]);
    await db.closeAsync();
  });

  it('does not overwrite a newer published head with an unreserved stale legacy capture', async () => {
    const target = remote();
    const deviceA = await device(target.client);
    await seedLegacy(deviceA, target);
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    const { captureVerifiedRows } = await import('@/core/backup/generations/capture');
    const { appMetaKeys, setAppMetaJson, getAppMetaJson } = await import('@/core/db/appMeta');
    const rowsByEntity: Record<string, Record<string, unknown>[]> = {};
    for (const entity of BACKUP_ENTITIES) rowsByEntity[entity] = target.tables.get(entity) ?? [];
    const stale = captureVerifiedRows({
      ownerUserId: 'user_a',
      rowsByEntity,
      settingsPayload: await readRecoverableSettings(deviceA as never),
    });
    await setAppMetaJson(deviceA as never, appMetaKeys.backupLegacyGenerationCapture, stale);

    // Another device published a newer immutable generation while A was
    // interrupted. Keep A as the active local database so its retry is what the
    // real adapter path exercises (a second freshDatabase would replace the
    // module-level singleton and silently drop A's pending capture).
    const newerHead = { snapshot_id: 'snap_from_b', sequence: 2 };
    target.generations.generations.set('user_a:snap_from_b', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b',
      sequence: 2,
      manifest_checksum: 'checksum_from_b',
    });
    target.generations.publications.set('user_a:snap_from_b', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b',
      sequence: 2,
    });
    target.generations.heads.set('user_a', newerHead);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    expect(newerHead.snapshot_id).not.toBe(stale.capture.snapshotId);

    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(target.generations.heads.get('user_a')).toEqual(newerHead);
    const retained = await getAppMetaJson<{ capture: { snapshotId: string } }>(
      deviceA as never,
      appMetaKeys.backupLegacyGenerationCapture,
    );
    expect(retained?.capture.snapshotId).toBe(stale.capture.snapshotId);
    await deviceA.closeAsync();
  });

  it('does not reassign a pending capture after another device publishes a newer head', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push([todoRecord]);
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    await captureGeneration({ settingsPayload: await readRecoverableSettings(db as never) });
    const pending = await readCapturedChunks(db as never);
    expect(pending).not.toBeNull();

    const newerHead = { snapshot_id: 'snap_from_b_pending', sequence: 2 };
    target.generations.generations.set('user_a:snap_from_b_pending', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_pending',
      sequence: 2,
      manifest_checksum: 'checksum_from_b_pending',
    });
    target.generations.publications.set('user_a:snap_from_b_pending', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_pending',
      sequence: 2,
    });
    target.generations.heads.set('user_a', newerHead);

    const adapter = new SupabaseSyncAdapter();
    const writesBefore = target.writes.length;
    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(target.writes.slice(writesBefore)).toEqual([]);
    expect(target.generations.heads.get('user_a')).toEqual(newerHead);
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      pending!.capture.snapshotId,
    );
    await db.closeAsync();
  });

  it('does not promote the device-global sequence counter into publication authority', async () => {
    const target = remote();
    const db = await device(target.client);
    const { setAppMetaText, appMetaKeys } = await import('@/core/db/appMeta');
    await setAppMetaText(db as never, appMetaKeys.backupGenerationSequence, '1');
    const head = { snapshot_id: 'snap_existing_f1', sequence: 1 };
    target.generations.heads.set('user_a', head);
    const writesBefore = target.writes.length;
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(target.generations.heads.get('user_a')).toEqual(head);
    expect(target.writes.slice(writesBefore)).toEqual([]);
    await db.closeAsync();
  });

  it('F4: a capability-protocol-1 server response pauses before any mutable write', async () => {
    const target = remote();
    const db = await device(target.client);
    target.setCapabilityProtocol(1);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await expect(new SupabaseSyncAdapter().push([todoRecord])).rejects.toThrow(
      'does not advertise',
    );
    expect(target.writes).toEqual([]);
    expect(target.generations.heads.size).toBe(0);
    await db.closeAsync();
  });

  it('restored devices reserve above remote history and keep the same reservation on retry', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    target.generations.reservations.set('user_a:other_device', 40);
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    const pending = await captureGeneration({
      settingsPayload: await readRecoverableSettings(db as never),
    });
    target.setFailPublish(true);
    const publish = () => adapter.push([todoRecord]);
    await expect(publish()).rejects.toThrow('publication interrupted');
    const reserved = await readCapturedChunks(db as never);
    expect(reserved?.capture.sequence).toBe(41);
    expect(reserved?.capture.snapshotId).toBe(pending.capture.snapshotId);
    expect(reserved?.chunks).toEqual(pending.chunks);
    target.setFailPublish(false);
    await publish();
    expect(target.generations.heads.get('user_a')?.sequence).toBe(41);
    await db.closeAsync();
  });

  it('reopens the durable pending generation and retries the same reservation after restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'superhabits-generation-restart-'));
    const filename = join(directory, 'backup.sqlite');
    const target = remote();
    let db = await device(target.client, true, filename);
    let closed = false;
    try {
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const adapter = new SupabaseSyncAdapter();
      await adapter.push([todoRecord]);
      await db.runAsync("UPDATE todos SET title='Captured before restart'");
      const { captureCurrentGeneration, readCapturedChunks } =
        await import('@/core/backup/generations/capture');
      await captureCurrentGeneration();
      target.setFailPublish(true);
      await expect(adapter.push([todoRecord])).rejects.toThrow('publication interrupted');
      const reserved = await readCapturedChunks(db as never);
      expect(reserved).not.toBeNull();
      await db.closeAsync();
      closed = true;

      db = await freshDatabase(filename);
      closed = false;
      const { readCapturedChunks: reloadedCapture } =
        await import('@/core/backup/generations/capture');
      expect(await reloadedCapture(db as never)).toEqual(reserved);
      target.setFailPublish(false);
      const { SupabaseSyncAdapter: RestartedAdapter } =
        await import('@/core/sync/supabase.adapter');
      await new RestartedAdapter().push([todoRecord]);
      expect(target.generations.heads.get('user_a')).toEqual({
        snapshot_id: reserved!.capture.snapshotId,
        sequence: reserved!.capture.sequence,
      });
      expect(await reloadedCapture(db as never)).toBeNull();
      expect(await db.getFirstAsync('SELECT title FROM todos')).toEqual({
        title: 'Captured before restart',
      });
    } finally {
      if (!closed) await db.closeAsync();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('refuses a corrupt pinned generation without consulting mutable fallback content', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push([todoRecord]);
    await seedLegacy(db, target);
    const chunk = [...target.generations.chunks.values()].find((row) => row.entity === 'todos')!;
    chunk.payload = String(chunk.payload).replace('Original', 'Corrupt');
    await db.closeAsync();
    const empty = await device(target.client, false);
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    const before = target.client.from.mock.calls.filter(
      ([entity]) => entity === 'backup_manifest',
    ).length;
    expect((await restoreFromRemoteBackupV2()).status).toBe('invalid');
    expect(await empty.getAllAsync('SELECT * FROM todos')).toEqual([]);
    expect(
      target.client.from.mock.calls.filter(([entity]) => entity === 'backup_manifest'),
    ).toHaveLength(before);
    await empty.closeAsync();
  });

  it.each(['racing writer', 'lost acknowledgement'] as const)(
    'reconciles %s without losing captured bytes or regressing head',
    async (failure) => {
      const target = remote();
      const db = await device(target.client);
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const adapter = new SupabaseSyncAdapter();
      await adapter.push([todoRecord]);
      const { captureGeneration, readCapturedChunks } =
        await import('@/core/backup/generations/capture');
      const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
      const original = await captureGeneration({
        settingsPayload: await readRecoverableSettings(db as never),
      });
      await db.runAsync("UPDATE todos SET title='Newer local write'");
      if (failure === 'racing writer') target.raceNextPublish();
      else target.loseAcknowledgement();
      const publishing = adapter.push([todoRecord]);
      if (failure === 'racing writer')
        await expect(publishing).rejects.toThrow('publication paused');
      else await publishing;
      const head = target.generations.heads.get('user_a')!;
      if (failure === 'racing writer') {
        expect(head).toEqual({ snapshot_id: 'concurrent', sequence: 3 });
        const retained = await readCapturedChunks(db as never);
        expect(retained?.capture.snapshotId).toBe(original.capture.snapshotId);
        expect(retained?.chunks).toEqual(original.chunks);
      } else {
        expect(await readCapturedChunks(db as never)).toBeNull();
        expect(head).toEqual({
          snapshot_id: original.capture.snapshotId,
          sequence: original.capture.sequence,
        });
        expect(target.generations.publications.has(`user_a:${original.capture.snapshotId}`)).toBe(
          true,
        );
      }
      expect(await db.getFirstAsync('SELECT title FROM todos')).toEqual({
        title: 'Newer local write',
      });
      await db.closeAsync();
    },
  );

  it('treats a lost acknowledgement followed by a newer head as a conflict, not success', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    const original = await captureGeneration({
      settingsPayload: await readRecoverableSettings(db as never),
    });
    target.loseAcknowledgementThenNewerHead();
    const writesBefore = target.writes.length;
    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(
      target.writes.slice(writesBefore).filter((entity) => !entity.startsWith('backup_generation')),
    ).toEqual([]);
    expect(target.generations.heads.get('user_a')).toMatchObject({ snapshot_id: 'later' });
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      original.capture.snapshotId,
    );
    await db.closeAsync();
  });

  it('F1: stale dirty device without a capture conflicts before any remote mutation', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    const firstHead = { ...target.generations.heads.get('user_a')! };

    await db.runAsync("UPDATE todos SET title='Stale local edit'");
    const writesBefore = target.writes.length;
    const newerHead = { snapshot_id: 'snap_from_b_f1', sequence: 2 };
    target.generations.generations.set('user_a:snap_from_b_f1', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_f1',
      sequence: 2,
      manifest_checksum: 'checksum_from_b_f1',
    });
    target.generations.publications.set('user_a:snap_from_b_f1', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_f1',
      sequence: 2,
    });
    target.generations.heads.set('user_a', newerHead);

    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(target.generations.heads.get('user_a')).toEqual(newerHead);
    expect(target.writes.slice(writesBefore)).toEqual([]);
    const { readCapturedChunks } = await import('@/core/backup/generations/capture');
    const retained = await readCapturedChunks(db as never);
    expect(retained?.capture.baseHeadSnapshotId).toBe(firstHead.snapshot_id);
    expect(retained?.capture.baseHeadSequence).toBe(firstHead.sequence);
    await db.closeAsync();
  });

  it('rejects an unverified migrated capture even when its base values equal the head', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    const head = { ...target.generations.heads.get('user_a')! };
    const { captureCurrentGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const pending = await captureCurrentGeneration();
    const { baseHeadProof: _proof, ...migrated } = pending.capture;
    const { setAppMetaJson, appMetaKeys } = await import('@/core/db/appMeta');
    await setAppMetaJson(db as never, appMetaKeys.backupGenerationCapture, {
      ...migrated,
      chunks: pending.chunks,
    });
    const before = target.writes.length;

    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);

    expect(target.writes.slice(before)).toEqual([]);
    expect(target.generations.heads.get('user_a')).toEqual(head);
    expect((await readCapturedChunks(db as never))?.capture.baseHeadProof).toBe('unverified');
    await db.closeAsync();
  });

  it('records the current durable capture when it changes before conflict persistence', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    const { captureCurrentGeneration } = await import('@/core/backup/generations/capture');
    const old = await captureCurrentGeneration();
    const replacement = await captureCurrentGeneration();
    const { setAppMetaJson, appMetaKeys } = await import('@/core/db/appMeta');
    await setAppMetaJson(db as never, appMetaKeys.backupGenerationCapture, {
      ...old.capture,
      chunks: old.chunks,
    });
    target.generations.heads.set('user_a', { snapshot_id: 'other_device', sequence: 3 });
    const transaction = db.withTransactionAsync.bind(db);
    vi.spyOn(db, 'withTransactionAsync').mockImplementationOnce(async (task) => {
      // Inject an already-admitted competing commit at the raw adapter seam,
      // after push read its capture but before conflict's transaction opens.
      // Calling the public queued metadata helper here would wait on the very
      // transaction whose adapter entry this spy is holding (not a real caller).
      // The conflict must still refer to the durable replacement.
      await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [
        appMetaKeys.backupGenerationCapture.key,
        JSON.stringify({ ...replacement.capture, chunks: replacement.chunks }),
      ]);
      await transaction(task);
    });
    const before = target.writes.length;

    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);

    const { readActiveBackupGenerationConflict } =
      await import('@/core/backup/generations/conflict');
    expect((await readActiveBackupGenerationConflict(db as never))?.localSnapshotId).toBe(
      replacement.capture.snapshotId,
    );
    expect(target.writes.slice(before)).toEqual([]);
    await db.closeAsync();
  });

  it('F2: stale normal pending capture rejects before any mutable write', async () => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([todoRecord]);
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
    const pendingBefore = await captureGeneration({
      settingsPayload: await readRecoverableSettings(db as never),
    });
    await db.runAsync("UPDATE todos SET title='Stale pending capture edit'");
    const writesBefore = target.writes.length;

    const newerHead = { snapshot_id: 'snap_from_b_f2', sequence: 2 };
    target.generations.generations.set('user_a:snap_from_b_f2', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_f2',
      sequence: 2,
      manifest_checksum: 'checksum_from_b_f2',
    });
    target.generations.publications.set('user_a:snap_from_b_f2', {
      user_id: 'user_a',
      snapshot_id: 'snap_from_b_f2',
      sequence: 2,
    });
    target.generations.heads.set('user_a', newerHead);

    await expect(adapter.push([todoRecord])).rejects.toThrow(/conflict|review/i);
    expect(target.generations.heads.get('user_a')).toEqual(newerHead);
    expect(target.writes.slice(writesBefore)).toEqual([]);
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      pendingBefore.capture.snapshotId,
    );
    await db.closeAsync();
  });

  it('preserves binary ID ordering when cutting over supported legacy identifiers', async () => {
    const target = remote();
    const db = await device(target.client);
    await db.runAsync("UPDATE todos SET id='todo_1_a'");
    await db.runAsync(
      "INSERT INTO todos(id,title,completed,priority,sort_order,created_at,updated_at) VALUES('todo_10_a','Second',0,'normal',2,'2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z')",
    );
    await seedLegacy(db, target);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await expect(
      new SupabaseSyncAdapter().push([{ ...todoRecord, id: 'todo_1_a' }]),
    ).rejects.toThrow(/conflict|review/i);
    const chunk = [...target.generations.chunks.values()].find(
      (entry) => entry.entity === 'todos',
    )!;
    expect((JSON.parse(String(chunk.payload)) as { id: string }[]).map((row) => row.id)).toEqual([
      'todo_10_a',
      'todo_1_a',
    ]);
    await db.closeAsync();
  });

  it.each([
    'metadata missing',
    'settings missing',
    'ordinal gap',
    'unsupported version',
    'head mismatch',
  ] as const)('rejects %s before importing any local rows', async (failure) => {
    const target = remote();
    const db = await device(target.client);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push([todoRecord]);
    const head = target.generations.heads.get('user_a')!;
    if (failure === 'metadata missing') target.generations.generations.clear();
    if (failure === 'settings missing')
      for (const [key, entry] of target.generations.chunks) {
        if (entry.entity === 'user_backup_settings') target.generations.chunks.delete(key);
      }
    if (failure === 'ordinal gap')
      [...target.generations.chunks.values()].find((entry) => entry.entity === 'todos')!.ordinal =
        2;
    if (failure === 'unsupported version')
      target.generations.generations.get(`user_a:${head.snapshot_id}`)!.protocol_version = 2;
    if (failure === 'head mismatch')
      target.generations.heads.set('user_a', { ...head, sequence: 2 });
    await db.closeAsync();
    const empty = await device(target.client, false);
    const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
    expect((await restoreFromRemoteBackupV2()).status).toBe('invalid');
    expect(await empty.getAllAsync('SELECT * FROM todos')).toEqual([]);
    await empty.closeAsync();
  });
});
