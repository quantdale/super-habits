import { createHash } from 'node:crypto';
import type { Route } from '@playwright/test';
import { BACKUP_REST_ENTITIES } from './accountBackupEntities';

type Row = Record<string, unknown>;
const entities = BACKUP_REST_ENTITIES.filter(
  (entity) => entity !== 'user_backup_settings' && entity !== 'backup_manifest',
);
const protocolTables = new Set([
  'backup_generation',
  'backup_generation_chunk',
  'backup_generation_head',
  'backup_generation_publication',
]);
const headers = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'content-range',
};
const sha = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const canonical = (rows: Row[]) =>
  JSON.stringify(
    rows.map((row) =>
      Object.fromEntries(
        Object.keys(row)
          .sort()
          .map((key) => [key, row[key]]),
      ),
    ),
  );

/** Stateful HTTP transport fake. SQL/RLS/domain qualification belongs to the
 * independently executed PostgreSQL lane; this models upload/read-back/CAS
 * contracts so browser journeys reach their intended product boundaries. */
export class GenerationSupabaseMock {
  private metadata = new Map<string, Row>();
  private chunks = new Map<string, Row>();
  private heads = new Map<string, Row>();
  private journal = new Map<string, Row>();
  private reservations = new Map<string, number>();
  private reservationProvenance = new Map<
    string,
    { baseHeadSnapshotId: string | null; baseHeadSequence: number | null }
  >();
  private stored = new Map<string, Map<string, Row>>();

  isDataEntity(entity: string): boolean {
    return (BACKUP_REST_ENTITIES as readonly string[]).includes(entity);
  }

  reset(): void {
    this.metadata.clear();
    this.chunks.clear();
    this.heads.clear();
    this.journal.clear();
    this.reservations.clear();
    this.reservationProvenance.clear();
    this.stored.clear();
  }

  /** A valid, empty retained point isolates entity-failure tests from first
   * publication/cutover. Do not use it for legacy restore fixtures. */
  seedEmptyPublishedPoint(owner: string): void {
    const snapshot = 'e2e_empty_generation';
    const settings = JSON.stringify({
      calorieGoal: null,
      pomodoroSettings: null,
      theme: { mode: null, slots: null },
      macroTargets: null,
      pomodoroPresets: null,
      workoutRestSeconds: null,
      notificationPreferences: null,
      workoutPreferences: null,
    });
    const descriptions = Object.fromEntries(
      entities.map((entity) => [entity, { rows: 0, checksum: sha('[]') }]),
    );
    descriptions.user_backup_settings = { rows: 1, checksum: sha(settings) };
    const capturedAt = '2026-10-20T00:00:00.000Z';
    const manifest = canonical([
      {
        protocolVersion: 1,
        backupSchemaVersion: 2,
        scopeVersion: 7,
        settingsVersion: 5,
        snapshotId: snapshot,
        sequence: 1,
        capturedAt,
        entities: descriptions,
        settingsChecksum: sha(settings),
      },
    ]);
    this.metadata.set(`${owner}:${snapshot}`, {
      user_id: owner,
      snapshot_id: snapshot,
      sequence: 1,
      protocol_version: 1,
      backup_schema_version: 2,
      scope_version: 7,
      settings_version: 5,
      manifest,
      manifest_checksum: sha(manifest),
      captured_at: capturedAt,
      base_head_snapshot_id: null,
      base_head_sequence: null,
      publication_provenance_version: 1,
    });
    this.chunks.set(`${owner}:${snapshot}:user_backup_settings:0`, {
      user_id: owner,
      snapshot_id: snapshot,
      entity: 'user_backup_settings',
      ordinal: 0,
      payload: settings,
      checksum: sha(settings),
    });
    const head = { user_id: owner, snapshot_id: snapshot, sequence: 1 };
    this.heads.set(owner, head);
    this.journal.set(`${owner}:${snapshot}`, head);
  }

  /** Record only writes that the journey has decided to accept. */
  recordWrite(entity: string, posted: unknown, owner: string): Row[] {
    if (!this.isDataEntity(entity)) throw new Error('Unknown dummy backup entity');
    const rows = (Array.isArray(posted) ? posted : [posted]) as Row[];
    const store = this.stored.get(entity) ?? new Map<string, Row>();
    for (const row of rows) {
      if (!row || typeof row !== 'object' || row.user_id !== owner)
        throw new Error('Dummy backup write owner mismatch');
      store.set(`${owner}:${String(row.id ?? 'singleton')}`, { ...row });
    }
    this.stored.set(entity, store);
    return rows;
  }

  /** Match production's filtered verification query, never manufacture IDs for
   * a successful HTTP response that did not actually store those records. */
  async handleReadBack(route: Route, owner: string): Promise<boolean> {
    const request = route.request();
    const url = new URL(request.url());
    const entity = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1];
    if (!entity || request.method() !== 'GET' || url.searchParams.get('select') !== 'id')
      return false;
    const store = this.stored.get(entity);
    if (!store) return false;
    const rows = this.filter([...store.values()], url, owner).map((row) => ({ id: row.id }));
    await route.fulfill({ status: 200, headers, body: JSON.stringify(rows) });
    return true;
  }

  async handle(route: Route, owner: string): Promise<boolean> {
    const request = route.request();
    const url = new URL(request.url());
    const rpc = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url.pathname)?.[1];
    const entity = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1];
    if (!rpc && (!entity || !protocolTables.has(entity))) return false;
    const respond = async (data: unknown, status = 200) => {
      await route.fulfill({ status, headers, body: JSON.stringify(data) });
      return true;
    };
    try {
      if (rpc) {
        if (rpc === 'backup_generation_capabilities')
          return respond({
            protocol_version: 2,
            publication_provenance_version: 1,
            content_verification_version: 1,
            sequence_reservation_version: 1,
            backup_schema_version: 2,
            scope_version: 7,
            settings_version: 5,
          });
        const args = request.postDataJSON() as Row;
        const snapshot = String(args.p_snapshot_id);
        const key = `${owner}:${snapshot}`;
        const baseHeadSnapshotId =
          args.p_base_head_snapshot_id == null ? null : String(args.p_base_head_snapshot_id);
        const baseHeadSequence =
          args.p_base_head_sequence == null ? null : Number(args.p_base_head_sequence);
        if (rpc === 'reserve_backup_generation_sequence') {
          if (Number(args.p_provenance_version) !== 1)
            throw new Error('Unsupported publication provenance version');
          const existingMetadata = this.metadata.get(key);
          if (existingMetadata) {
            if (
              Number(existingMetadata.publication_provenance_version) !== 1 ||
              (existingMetadata.base_head_snapshot_id ?? null) !== baseHeadSnapshotId ||
              (existingMetadata.base_head_sequence ?? null) !== baseHeadSequence
            )
              throw new Error('Snapshot provenance mismatch');
            return respond(Number(existingMetadata.sequence));
          }
          const existingProvenance = this.reservationProvenance.get(key);
          if (existingProvenance) {
            if (
              existingProvenance.baseHeadSnapshotId !== baseHeadSnapshotId ||
              existingProvenance.baseHeadSequence !== baseHeadSequence
            )
              throw new Error('Reservation provenance mismatch');
            return respond(this.reservations.get(key));
          }
          const currentHead = this.heads.get(owner);
          if (currentHead) {
            if (
              currentHead.snapshot_id !== baseHeadSnapshotId ||
              currentHead.sequence !== baseHeadSequence
            )
              throw new Error('Capture base head is not current');
          } else if (baseHeadSnapshotId !== null || baseHeadSequence !== null) {
            throw new Error('Capture claims a missing base head');
          }
          let sequence = Number(this.metadata.get(key)?.sequence ?? this.reservations.get(key));
          if (!Number.isSafeInteger(sequence)) {
            sequence =
              Math.max(
                0,
                ...[...this.metadata.values()]
                  .filter((row) => row.user_id === owner)
                  .map((row) => Number(row.sequence)),
                ...[...this.reservations]
                  .filter(([id]) => id.startsWith(`${owner}:`))
                  .map(([, n]) => n),
              ) + 1;
            this.reservations.set(key, sequence);
            this.reservationProvenance.set(key, { baseHeadSnapshotId, baseHeadSequence });
          }
          return respond(sequence);
        }
        if (rpc !== 'publish_backup_generation') return false;
        if (Number(args.p_provenance_version) !== 1)
          throw new Error('Unsupported publication provenance version');
        const metadata = this.metadata.get(key);
        if (
          !metadata ||
          Number(metadata.publication_provenance_version) !== 1 ||
          sha(String(metadata.manifest)) !== metadata.manifest_checksum ||
          args.p_manifest_checksum !== metadata.manifest_checksum
        )
          throw new Error('Generation metadata/checksum missing');
        const parsed = JSON.parse(String(metadata.manifest)) as Row[];
        const manifest = parsed[0];
        if (
          parsed.length !== 1 ||
          manifest.snapshotId !== snapshot ||
          manifest.sequence !== metadata.sequence
        )
          throw new Error('Invalid generation manifest');
        const descriptions = manifest.entities as Record<
          string,
          { rows: number; checksum: string }
        >;
        const staged = [...this.chunks.values()].filter(
          (row) => row.user_id === owner && row.snapshot_id === snapshot,
        );
        if (staged.length !== args.p_expected_chunk_count) throw new Error('Incomplete generation');
        for (const name of [...entities, 'user_backup_settings']) {
          const expected = descriptions[name];
          const pieces = staged
            .filter((row) => row.entity === name)
            .sort((a, b) => Number(a.ordinal) - Number(b.ordinal));
          if (
            !expected ||
            pieces.some(
              (row, ordinal) =>
                row.ordinal !== ordinal ||
                Buffer.byteLength(String(row.payload), 'utf8') > 131072 ||
                sha(String(row.payload)) !== row.checksum,
            )
          )
            throw new Error('Invalid generation chunk');
          if (name === 'user_backup_settings') {
            if (
              pieces.length !== 1 ||
              pieces[0].checksum !== expected.checksum ||
              expected.checksum !== manifest.settingsChecksum
            )
              throw new Error('Invalid settings chunk');
          } else {
            const values = pieces.flatMap((row) => JSON.parse(String(row.payload)) as Row[]);
            if (values.length !== expected.rows || sha(canonical(values)) !== expected.checksum)
              throw new Error('Invalid entity content');
          }
        }
        const previous = this.heads.get(owner);
        if (previous?.snapshot_id === snapshot && previous.sequence === metadata.sequence)
          return respond(previous);
        if (previous) {
          if (
            (metadata.base_head_snapshot_id ?? null) !== previous.snapshot_id ||
            (metadata.base_head_sequence ?? null) !== previous.sequence
          )
            throw new Error('Generation base head is not current');
        } else if (
          (metadata.base_head_snapshot_id ?? null) !== null ||
          (metadata.base_head_sequence ?? null) !== null
        ) {
          throw new Error('Generation claims a missing base head');
        }
        if (
          Number(metadata.sequence) <= Number(previous?.sequence ?? 0) ||
          Number(args.p_expected_previous_sequence) !== Number(previous?.sequence ?? 0)
        )
          throw new Error('Publication conflict');
        const head = { user_id: owner, snapshot_id: snapshot, sequence: metadata.sequence };
        this.heads.set(owner, head);
        this.journal.set(key, head);
        return respond(head);
      }
      if (request.method() === 'POST') {
        if (entity !== 'backup_generation' && entity !== 'backup_generation_chunk')
          throw new Error('Direct head/publication writes forbidden');
        const posted = request.postDataJSON() as Row | Row[];
        const rows = Array.isArray(posted) ? posted : [posted];
        const store = entity === 'backup_generation' ? this.metadata : this.chunks;
        for (const row of rows) {
          if (row.user_id !== owner) throw new Error('Generation owner mismatch');
          const key =
            `${owner}:${String(row.snapshot_id)}` +
            (entity === 'backup_generation_chunk'
              ? `:${String(row.entity)}:${String(row.ordinal)}`
              : '');
          const existing = store.get(key);
          if (existing && JSON.stringify(existing) !== JSON.stringify(row))
            throw new Error('Generation content is immutable');
          store.set(key, { ...row });
        }
        return respond(rows, 201);
      }
      const values =
        entity === 'backup_generation_head'
          ? [...this.heads.values()]
          : entity === 'backup_generation'
            ? [...this.metadata.values()]
            : entity === 'backup_generation_chunk'
              ? [...this.chunks.values()]
              : [...this.journal.values()];
      return respond(this.filter(values, url, owner));
    } catch (error) {
      return respond(
        { code: '23514', message: error instanceof Error ? error.message : String(error) },
        409,
      );
    }
  }

  private filter(rows: Row[], url: URL, owner: string): Row[] {
    let result = rows.filter((row) => row.user_id === owner);
    for (const [column, value] of url.searchParams) {
      if (value.startsWith('eq.'))
        result = result.filter((row) => String(row[column]) === value.slice(3));
      if (value.startsWith('in.(')) {
        const ids = value
          .slice(4, -1)
          .split(',')
          .map((id) => id.replace(/^"|"$/g, ''));
        result = result.filter((row) => ids.includes(String(row[column])));
      }
    }
    result.sort((a, b) => {
      const left = String(a.entity ?? a.id ?? '');
      const right = String(b.entity ?? b.id ?? '');
      return (
        (left < right ? -1 : left > right ? 1 : 0) ||
        Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0)
      );
    });
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number(url.searchParams.get('limit') ?? result.length);
    return result.slice(offset, offset + limit);
  }
}
