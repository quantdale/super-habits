import type { SyncRecord } from '@/core/sync/sync.engine';

/**
 * One record's own failure evidence (`AUD-SH03-B`).
 *
 * The audited defect: the adapter threw a single aggregate error carrying a
 * JOINED message string plus the list of failed records. The engine then
 * classified that joined string — `'relation "todos" does not exist; HTTP 503'`
 * — for EVERY failed record, so one entity's missing table made an
 * independently-transient Habits failure look permanently broken, and both were
 * blocked. A record's fate must be decided from its own error.
 */
export interface SyncRecordFailure {
  /** The record that failed. */
  record: SyncRecord;
  /** The error thrown for THIS record's push (never another record's). */
  error: Error;
  /** Optional safe diagnostic code from the adapter (transport/PostgREST code). */
  code?: string;
}

/**
 * An adapter may throw this instead of a plain Error to report that some
 * entities pushed successfully while others failed, so the engine only
 * requeues `failedRecords` rather than the entire batch — one poisoned
 * entity no longer blocks every other entity's records behind it.
 *
 * It also carries `failures`, the per-record evidence the engine uses to
 * classify each record independently. `failures` always covers exactly
 * `failedRecords`; `classifyFailureFor` is the only supported way to read it so
 * a caller cannot accidentally fall back to the aggregate message.
 */
export class SyncPushPartialFailureError extends Error {
  /**
   * @param message aggregate human-readable summary (diagnostics only — never
   *   used to classify a record)
   * @param failedRecords every record that did not reach the remote
   * @param failures per-record evidence, one entry per failed record
   */
  constructor(
    message: string,
    public readonly failedRecords: SyncRecord[],
    public readonly failures: SyncRecordFailure[] = [],
    /**
     * Records that DID store within the same entity push (`AUD-SH03-B`).
     *
     * A bounded write splits an entity into batches; a later batch failing must
     * not implicate the earlier ones, so these records are acknowledged (removed
     * from the outbox) rather than retried or terminally blocked.
     */
    public readonly succeededRecords: SyncRecord[] = [],
  ) {
    super(message);
    this.name = 'SyncPushPartialFailureError';
  }

  /**
   * The error that belongs to `record`.
   *
   * Falls back to the aggregate error only when the adapter supplied no
   * per-record evidence at all (a legacy/third-party adapter), which keeps
   * behaviour no worse than before while making the structured path authoritative
   * whenever it exists.
   */
  failureFor(record: SyncRecord): Error {
    const match = this.failures.find(
      (failure) => failure.record.entity === record.entity && failure.record.id === record.id,
    );
    if (match) return match.error;
    return this;
  }

  /** The adapter-supplied diagnostic code for `record`, when there is one. */
  codeFor(record: SyncRecord): string | undefined {
    return this.failures.find(
      (failure) => failure.record.entity === record.entity && failure.record.id === record.id,
    )?.code;
  }
}

/**
 * A bounded-write batch failed after earlier batches of the SAME entity already
 * stored (`AUD-SH03-B`).
 *
 * Carries both sets so the caller can acknowledge the stored ids and report only
 * the truly-failed ones. Without this the adapter had a single aggregate error
 * per entity, and every record inherited it.
 */
export class EntityBatchPushError extends Error {
  constructor(
    message: string,
    /** Ids whose earlier batch already stored. */
    public readonly acknowledgedIds: readonly string[],
    /** Ids in the batch that failed. */
    public readonly failedIds: ReadonlySet<string>,
  ) {
    super(message);
    this.name = 'EntityBatchPushError';
  }
}
