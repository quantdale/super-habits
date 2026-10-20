/**
 * Published recovery generations — protocol contract (`AUD-SH02-A`…`D`).
 *
 * ## The audited defect
 *
 * The specification requires an earlier complete checkpoint to remain restorable
 * while newer changes are pending or publication fails. The transport instead
 * OVERWROTE the current remote entity rows before publishing a new manifest, so
 * "keeping the old manifest" preserved only its pointer, not the bytes it
 * certified. Measured: with a valid generation-1 manifest for a Todo titled
 * `Original`, one successful update to `Changed` followed by an interrupted
 * publication left generation 1 in place but Restore V2 returned
 * `invalid`/`integrity_mismatch`. A local-only transaction or a different status
 * label cannot fix a MUTABLE store: the recovery data itself is being rewritten.
 *
 * ## The architecture this module implements
 *
 * Immutable published content is separated from mutable staging/transport:
 *
 *   - a GENERATION is identified by an owner-scoped snapshot id and carries
 *     immutable chunks plus a canonical manifest;
 *   - chunks are content-addressed within the generation: re-uploading identical
 *     bytes is idempotent, and changing bytes under an existing chunk identity is
 *     REFUSED (that would silently rewrite published history);
 *   - only an atomic HEAD advance makes a generation restore-visible, so an
 *     interrupted upload can never be mistaken for a complete recovery point;
 *   - restore resolves ONE head generation and reads only that generation's
 *     chunks, so concurrent publication cannot mix content.
 *
 * Everything here is pure and side-effect free: it is the contract the client
 * and the (separately authorized) backend must both satisfy. The server-side
 * transactional publication, RLS and cross-client race proof require a
 * disposable backend and remain an explicit external gate.
 */

/** Generation CONTENT format version. Distinct from backup schema 2. */
export const GENERATION_PROTOCOL_VERSION = 1;

/**
 * Transport/capability version. Version 2 requires server-verified base-head
 * provenance at reservation and publication. The content format stays protocol
 * 1 so already-published generations remain readable.
 */
export const GENERATION_CAPABILITY_VERSION = 2;

/** Version of the server-verified publication provenance contract. */
export const PUBLICATION_PROVENANCE_VERSION = 1;

/** The recovery-scope version this protocol publishes. */
export interface GenerationScope {
  protocolVersion: number;
  backupSchemaVersion: number;
  scopeVersion: number;
  settingsVersion: number;
}

/** One immutable chunk of a generation's payload. */
export interface GenerationChunk {
  /** Owning snapshot (generation) identity. */
  snapshotId: string;
  /** The recoverable entity, or the synthetic settings/manifest records. */
  entity: string;
  /** Ordinal within (snapshot, entity); stable across retries. */
  ordinal: number;
  /** Canonical serialized payload bytes, as text. */
  payload: string;
  /** SHA-256 of `payload`. */
  checksum: string;
}

/** A fully verified generation, eligible to become the owner head. */
export interface PublishedGeneration {
  snapshotId: string;
  /** Monotonic publication sequence per owner. */
  sequence: number;
  scope: GenerationScope;
  /** Canonical manifest describing every entity count/checksum + settings. */
  manifest: string;
  /** SHA-256 of the canonical manifest. */
  manifestChecksum: string;
  publishedAt: string;
}

/** The owner's current restore-visible generation. */
export interface OwnerHead {
  snapshotId: string;
  sequence: number;
}

/** Why a generation operation was refused. */
export type GenerationRefusal =
  | 'owner_mismatch'
  | 'chunk_content_changed'
  | 'incomplete_generation'
  | 'stale_sequence'
  | 'unsupported_protocol'
  | 'generation_not_retained';

/** Result of a generation operation. */
export type GenerationResult<T> = { ok: true; value: T } | { ok: false; reason: GenerationRefusal };

/**
 * Validate a manifest-carried scope against what this client supports.
 *
 * A NEWER protocol is refused explicitly rather than approximated: a best-effort
 * import of semantics this client does not understand is how a recovery point
 * becomes silently wrong.
 *
 * @param scope the generation's declared scope
 * @param supported what this client can read
 */
export function checkGenerationScope(
  scope: GenerationScope,
  supported: GenerationScope,
): GenerationResult<GenerationScope> {
  if (scope.protocolVersion > supported.protocolVersion) {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  if (scope.backupSchemaVersion > supported.backupSchemaVersion) {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  if (scope.settingsVersion > supported.settingsVersion) {
    return { ok: false, reason: 'unsupported_protocol' };
  }
  return { ok: true, value: scope };
}

/**
 * Decide whether an existing chunk may be replaced.
 *
 * Identical bytes are idempotent (a retried upload after a lost response).
 * DIFFERENT bytes under an existing `(snapshotId, entity, ordinal)` would rewrite
 * already-published history, so it is refused.
 *
 * @param existing the chunk already stored, when present
 * @param incoming the chunk being uploaded
 */
export function checkChunkReplacement(
  existing: GenerationChunk | null,
  incoming: GenerationChunk,
): GenerationResult<'inserted' | 'unchanged'> {
  if (!existing) return { ok: true, value: 'inserted' };
  if (existing.checksum === incoming.checksum && existing.payload === incoming.payload) {
    return { ok: true, value: 'unchanged' };
  }
  return { ok: false, reason: 'chunk_content_changed' };
}

/**
 * Verify a generation is complete and internally consistent before publication.
 *
 * Publication must be a decided act, not a hopeful one: every expected identity
 * needs all of its ordinals, every ordinal must appear once, and every checksum
 * must match its payload.
 *
 * @param expected per-entity expected ordinals, from the captured snapshot
 * @param chunks the chunks actually staged for this snapshot
 */
export function verifyGenerationCompleteness(
  expected: Record<string, number>,
  chunks: readonly GenerationChunk[],
): GenerationResult<{ totalChunks: number }> {
  const byEntity = new Map<string, GenerationChunk[]>();
  for (const chunk of chunks) {
    const list = byEntity.get(chunk.entity) ?? [];
    list.push(chunk);
    byEntity.set(chunk.entity, list);
  }
  for (const [entity, count] of Object.entries(expected)) {
    const staged = byEntity.get(entity) ?? [];
    if (staged.length !== count) return { ok: false, reason: 'incomplete_generation' };
    const ordinals = new Set(staged.map((chunk) => chunk.ordinal));
    if (ordinals.size !== staged.length) return { ok: false, reason: 'incomplete_generation' };
    for (let ordinal = 0; ordinal < count; ordinal += 1) {
      if (!ordinals.has(ordinal)) return { ok: false, reason: 'incomplete_generation' };
    }
  }
  for (const entity of byEntity.keys()) {
    if (!(entity in expected)) return { ok: false, reason: 'incomplete_generation' };
  }
  return { ok: true, value: { totalChunks: chunks.length } };
}

/**
 * The atomic head-advance decision.
 *
 * This is the single serialization point. A stale retry (its `sequence` is not
 * ahead of the current head) must never regress a newer publication, and an
 * out-of-order advance is refused rather than applied.
 *
 * @param current the owner's current head, or `null` for the first publication
 * @param candidate the generation attempting to publish
 */
export function decideHeadAdvance(
  current: OwnerHead | null,
  candidate: PublishedGeneration,
): GenerationResult<OwnerHead> {
  if (!current)
    return { ok: true, value: { snapshotId: candidate.snapshotId, sequence: candidate.sequence } };
  if (candidate.sequence <= current.sequence) {
    // A retry of the SAME generation whose response was lost is not a stale
    // regression: the head already names it, so the outcome is idempotent.
    if (candidate.snapshotId === current.snapshotId && candidate.sequence === current.sequence) {
      return { ok: true, value: current };
    }
    return { ok: false, reason: 'stale_sequence' };
  }
  return { ok: true, value: { snapshotId: candidate.snapshotId, sequence: candidate.sequence } };
}

/**
 * Which generations remain restorable for one owner.
 *
 * The contract is "at least the current and the previous complete generation".
 * A failed or staged upload can never displace either, and an active reader's
 * generation is never collected.
 *
 * @param published generations in ascending sequence order
 * @param retained how many complete generations to keep (minimum 2)
 */
export function retainedGenerations(
  published: readonly PublishedGeneration[],
  retained = 2,
): PublishedGeneration[] {
  const keep = Math.max(2, retained);
  return [...published]
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, keep)
    .reverse();
}

/**
 * Collections that automatic cleanup must skip.
 *
 * For this campaign automatic production garbage collection is DISABLED, so this
 * exists to make the eventual policy testable rather than to be exercised.
 *
 * @param published generations in ascending sequence order
 * @param activeReaderSnapshot a snapshot a restore is currently reading, if any
 */
export function generatableForCleanup(
  published: readonly PublishedGeneration[],
  activeReaderSnapshot: string | null,
): PublishedGeneration[] {
  const kept = new Set(retainedGenerations(published).map((generation) => generation.snapshotId));
  if (activeReaderSnapshot) kept.add(activeReaderSnapshot);
  return published.filter((generation) => !kept.has(generation.snapshotId));
}

/**
 * Resolve the ONE generation a restore must read.
 *
 * Pinning to a single generation before any fetch is what guarantees a restore
 * cannot mix rows or settings from two publications: everything it later reads is
 * addressed by this snapshot id.
 *
 * @param head the owner's current head
 * @param published the generations known to be complete
 */
export function resolveRestoreGeneration(
  head: OwnerHead,
  published: readonly PublishedGeneration[],
): GenerationResult<PublishedGeneration> {
  const match = published.find((generation) => generation.snapshotId === head.snapshotId);
  if (!match) return { ok: false, reason: 'generation_not_retained' };
  if (match.sequence !== head.sequence) return { ok: false, reason: 'stale_sequence' };
  return { ok: true, value: match };
}

/** The scope this build publishes and can read. */
export function currentGenerationScope(input: {
  backupSchemaVersion: number;
  scopeVersion: number;
  settingsVersion: number;
}): GenerationScope {
  return {
    protocolVersion: GENERATION_PROTOCOL_VERSION,
    backupSchemaVersion: input.backupSchemaVersion,
    scopeVersion: input.scopeVersion,
    settingsVersion: input.settingsVersion,
  };
}
