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
 *
 * ## Scope
 *
 * This module now carries only the versions and types the shipping client uses
 * (capture, upload and the sync adapter). The pure decision helpers that encoded
 * the same contract locally (`checkGenerationScope`, `checkChunkReplacement`,
 * `verifyGenerationCompleteness`, `decideHeadAdvance`, `retainedGenerations`,
 * `generatableForCleanup`, `resolveRestoreGeneration`) had no production caller —
 * the authoritative enforcement is the SQL published in
 * `supabase/migrations/20261018000000_add_backup_generation_protocol.sql` — so
 * they and their tests were removed rather than left as speculative duplicates.
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
