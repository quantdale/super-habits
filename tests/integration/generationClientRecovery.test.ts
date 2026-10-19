import { describe, expect, it, vi } from 'vitest';
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
  let failManifestRead = false;
  let raceNextPublish = false;
  let loseAcknowledgement = false;
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
      if (!capabilities) return { data: null, error: { message: 'missing capability RPC' } };
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
      if (name === 'publish_backup_generation' && loseAcknowledgement) {
        loseAcknowledgement = false;
        generations.rpc(name, args);
        const sequence = generations.heads.get('user_a')!.sequence + 1;
        generations.generations.set('user_a:later', { sequence });
        generations.heads.set('user_a', { snapshot_id: 'later', sequence });
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
    setFailManifestRead: (value: boolean) => {
      failManifestRead = value;
    },
    raceNextPublish: () => {
      raceNextPublish = true;
    },
    loseAcknowledgement: () => {
      loseAcknowledgement = true;
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

async function device(client: ReturnType<typeof remote>['client'], populated = true) {
  install(client);
  const db = await freshDatabase();
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
    expect(
      target.client.from.mock.calls.filter(([entity]) => entity === 'backup_manifest'),
    ).toHaveLength(1); // cutover inspection only
    await empty.closeAsync();
  });

  it.each([6, 7])(
    'preserves a verified scope-%s legacy point through a failed newer publication',
    async (scope) => {
      const target = remote();
      const db = await device(target.client);
      await seedLegacy(db, target, scope);
      await db.runAsync("UPDATE todos SET title='Changed'");
      const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
      const adapter = new SupabaseSyncAdapter();
      await adapter.push([todoRecord]);
      const retained = target.generations.heads.get('user_a')!;
      expect(retained.sequence).toBe(1);
      expect(target.tables.get('todos')?.[0].title).toBe('Changed');
      const { captureGeneration } = await import('@/core/backup/generations/capture');
      const { readRecoverableSettings } = await import('@/core/backup/backupSettings');
      await captureGeneration({ settingsPayload: await readRecoverableSettings(db as never) });
      target.setFailPublish(true);
      await expect(
        (
          adapter as unknown as {
            publishGenerationContents: (
              client: unknown,
              db: unknown,
              owner: string,
            ) => Promise<void>;
          }
        ).publishGenerationContents(target.client, db, 'user_a'),
      ).rejects.toThrow('publication interrupted');
      expect(target.generations.heads.get('user_a')).toEqual(retained);
      await db.closeAsync();
      const empty = await device(target.client, false);
      const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
      expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
      expect(await empty.getFirstAsync('SELECT title FROM todos')).toEqual({ title: 'Original' });
      await empty.closeAsync();
    },
  );

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
    const publish = () =>
      (
        adapter as unknown as {
          publishGenerationContents: (client: unknown, db: unknown, owner: string) => Promise<void>;
        }
      ).publishGenerationContents(target.client, db, 'user_a');
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
      const publishing = (
        adapter as unknown as {
          publishGenerationContents: (client: unknown, db: unknown, owner: string) => Promise<void>;
        }
      ).publishGenerationContents(target.client, db, 'user_a');
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
        expect(head).toEqual({ snapshot_id: 'later', sequence: 3 });
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

  it('preserves binary ID ordering when cutting over supported legacy identifiers', async () => {
    const target = remote();
    const db = await device(target.client);
    await db.runAsync("UPDATE todos SET id='todo_1_a'");
    await db.runAsync(
      "INSERT INTO todos(id,title,completed,priority,sort_order,created_at,updated_at) VALUES('todo_10_a','Second',0,'normal',2,'2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z')",
    );
    await seedLegacy(db, target);
    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    await new SupabaseSyncAdapter().push([{ ...todoRecord, id: 'todo_1_a' }]);
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
