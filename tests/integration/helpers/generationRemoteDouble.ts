/**
 * Fake remote supporting the published-generation protocol
 * (`AUD-SH02-A`/`B`), for tests that drive the REAL backup/restore path.
 *
 * The production adapter now publishes immutable generation content and advances
 * an owner head before writing the legacy mutable manifest, and restore reads the
 * pinned generation. A fake that models only `upsert`/`select` cannot exercise
 * that path at all, so this helper provides the three generation tables plus the
 * `publish_backup_generation` RPC with the same observable semantics as the SQL
 * migration: content is append-only, the head advance is compare-and-swap, and an
 * incomplete generation is refused.
 */

export interface GenerationId {
  user_id: string;
  snapshot_id: string;
}

export class GenerationRemoteDouble {
  /** generation metadata keyed by `${user_id}:${snapshot_id}`. */
  readonly generations = new Map<string, Record<string, unknown>>();
  /** chunks keyed by `${user_id}:${snapshot_id}:${entity}:${ordinal}`. */
  readonly chunks = new Map<string, Record<string, unknown>>();
  /** owner head, one row per user. */
  readonly heads = new Map<string, { snapshot_id: string; sequence: number }>();
  readonly publications = new Map<
    string,
    { user_id: string; snapshot_id: string; sequence: number }
  >();
  /** Every RPC call, for assertions. */
  readonly rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  readonly reservations = new Map<string, number>();

  rpc(
    name: string,
    args: Record<string, unknown> = {},
  ): { data: unknown; error: { message: string } | null } {
    if (name === 'backup_generation_capabilities')
      return {
        data: {
          protocol_version: 1,
          content_verification_version: 1,
          sequence_reservation_version: 1,
          backup_schema_version: 2,
          scope_version: 7,
          settings_version: 5,
        },
        error: null,
      };
    if (name === 'reserve_backup_generation_sequence') {
      const key = this.key('user_a', String(args.p_snapshot_id));
      const previous = this.reservations.get(key) ?? this.generations.get(key)?.sequence;
      const sequence = Number(
        previous ??
          Math.max(
            0,
            ...this.reservations.values(),
            ...[...this.generations.values()].map((row) => Number(row.sequence)),
          ) + (previous === undefined ? 1 : 0),
      );
      this.reservations.set(key, sequence);
      return { data: sequence, error: null };
    }
    if (name === 'publish_backup_generation') return this.publish(args);
    return { data: null, error: { message: `unknown rpc ${name}` } };
  }

  private key(userId: string, snapshotId: string): string {
    return `${userId}:${snapshotId}`;
  }

  upsert(entity: string, rows: Record<string, unknown>[]): { error: { message: string } | null } {
    if (entity === 'backup_generation') {
      for (const row of rows) {
        const id = this.key(String(row.user_id), String(row.snapshot_id));
        const existing = this.generations.get(id);
        // Metadata is append-only for the fields that identify certified content.
        if (existing && existing.manifest_checksum !== row.manifest_checksum) {
          return { error: { message: 'backup_generation is append-only' } };
        }
        this.generations.set(id, { ...(existing ?? {}), ...row });
      }
      return { error: null };
    }
    if (entity === 'backup_generation_chunk') {
      for (const row of rows) {
        const id = [
          String(row.user_id),
          String(row.snapshot_id),
          String(row.entity),
          String(row.ordinal),
        ].join(':');
        const existing = this.chunks.get(id);
        // Identical bytes are idempotent; different bytes are refused.
        if (existing && existing.checksum !== row.checksum) {
          return { error: { message: 'backup_generation_chunk is immutable' } };
        }
        if (!existing) this.chunks.set(id, row);
      }
      return { error: null };
    }
    if (entity === 'backup_generation_head') {
      for (const row of rows) {
        this.heads.set(String(row.user_id), {
          snapshot_id: String(row.snapshot_id),
          sequence: Number(row.sequence),
        });
      }
      return { error: null };
    }
    return { error: null };
  }

  /** The `publish_backup_generation` RPC, mirroring the SQL function. */
  publish(args: Record<string, unknown>): { data: unknown; error: { message: string } | null } {
    this.rpcCalls.push({ name: 'publish_backup_generation', args });
    const userId = 'user_a';
    const snapshotId = String(args.p_snapshot_id);
    const generation = this.generations.get(this.key(userId, snapshotId));
    if (!generation) return { data: null, error: { message: 'generation does not exist' } };
    if (generation.manifest_checksum !== args.p_manifest_checksum) {
      return { data: null, error: { message: 'manifest checksum mismatch' } };
    }
    const staged = [...this.chunks.values()].filter(
      (chunk) => chunk.user_id === userId && chunk.snapshot_id === snapshotId,
    ).length;
    if (staged !== Number(args.p_expected_chunk_count)) {
      return { data: null, error: { message: `incomplete: ${staged} chunk(s) staged` } };
    }
    const head = this.heads.get(userId);
    const sequence = Number(generation.sequence);
    if (head) {
      if (sequence < head.sequence) return { data: null, error: { message: 'stale sequence' } };
      if (sequence === head.sequence && head.snapshot_id !== snapshotId) {
        return { data: null, error: { message: 'sequence already published' } };
      }
      if (sequence === head.sequence) return { data: head, error: null };
      if (head.sequence !== Number(args.p_expected_previous_sequence)) {
        return { data: null, error: { message: 'head advanced concurrently' } };
      }
    } else if (Number(args.p_expected_previous_sequence) !== 0) {
      return { data: null, error: { message: 'expected previous sequence but no head' } };
    }
    const next = { snapshot_id: snapshotId, sequence };
    this.heads.set(userId, next);
    this.publications.set(this.key(userId, snapshotId), { user_id: userId, ...next });
    return { data: next, error: null };
  }

  /** Rows of one entity from a published generation. */
  generationRows(userId: string, snapshotId: string, entity: string): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.user_id !== userId || chunk.snapshot_id !== snapshotId) continue;
      if (chunk.entity !== entity) continue;
      const parsed: unknown = JSON.parse(String(chunk.payload));
      if (Array.isArray(parsed)) rows.push(...(parsed as Record<string, unknown>[]));
    }
    return rows;
  }
}
