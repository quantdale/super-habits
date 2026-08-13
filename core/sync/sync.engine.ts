import { SupabaseSyncAdapter } from '@/core/sync/supabase.adapter';
import { SqliteSyncPersistence } from '@/core/sync/syncPersistence';
import { SyncPushPartialFailureError } from '@/core/sync/syncErrors';

export type SyncRecord = {
  entity: string;
  id: string;
  updatedAt: string;
  operation: 'create' | 'update' | 'delete';
  /** Internal durable ordering metadata. Adapters never receive this field. */
  revision?: number;
};

export type PreparedSyncRecord = SyncRecord & { revision: number };

export interface SyncAdapter {
  push(records: SyncRecord[]): Promise<void>;
  pull(since: string | null): Promise<SyncRecord[]>;
}

export class NoopSyncAdapter implements SyncAdapter {
  push(_records: SyncRecord[]) {
    return Promise.resolve();
  }

  pull(_since: string | null) {
    return Promise.resolve<SyncRecord[]>([]);
  }
}

export { SyncPushPartialFailureError };

export type SyncStatus = {
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  lastErrorMessage: string | null;
  nextRetryAt: string | null;
};

export const INITIAL_SYNC_STATUS: SyncStatus = {
  lastSuccessAt: null,
  consecutiveFailures: 0,
  lastErrorMessage: null,
  nextRetryAt: null,
};

/** Durable storage for the outbox/status so a killed process doesn't lose pending records. */
export interface SyncPersistence {
  loadOutbox(): Promise<SyncRecord[]>;
  /** Legacy snapshot API retained for simple test/adaptor implementations. */
  saveOutbox(records: SyncRecord[]): Promise<void>;
  /** Preferred row-level API used by the SQLite outbox. */
  upsertOutbox?(record: SyncRecord, revision: number): Promise<void>;
  /** Remove only the exact revisions that were successfully pushed. */
  removeOutbox?(records: SyncRecord[]): Promise<void>;
  loadStatus(): Promise<SyncStatus | null>;
  saveStatus(status: SyncStatus): Promise<void>;
}

export class NoopSyncPersistence implements SyncPersistence {
  loadOutbox() {
    return Promise.resolve<SyncRecord[]>([]);
  }
  async saveOutbox(_records: SyncRecord[]) {}
  async upsertOutbox(_record: SyncRecord, _revision: number) {}
  async removeOutbox(_records: SyncRecord[]) {}
  loadStatus() {
    return Promise.resolve<SyncStatus | null>(null);
  }
  async saveStatus(_status: SyncStatus) {}
}

// Delay before the next retry, keyed by consecutive-failure count. Caps at
// the last entry so a persistently-broken backend settles into a steady
// retry cadence instead of hammering it every 30s forever.
const BACKOFF_SCHEDULE_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000];

function backoffDelayMs(consecutiveFailures: number): number {
  const index = Math.min(Math.max(consecutiveFailures, 1) - 1, BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index];
}

function dedupeKey(record: SyncRecord): string {
  return `${record.entity}:${record.id}`;
}

export class SyncEngine {
  constructor(
    private readonly adapter: SyncAdapter = new NoopSyncAdapter(),
    private readonly persistence: SyncPersistence = new NoopSyncPersistence(),
  ) {}

  private queue: SyncRecord[] = [];
  private readonly revisions = new Map<string, number>();
  private nextRevision = 0;
  private status: SyncStatus = { ...INITIAL_SYNC_STATUS };
  private flushing: Promise<void> | null = null;
  private persistenceTail: Promise<void> = Promise.resolve();

  /** Loads the persisted outbox/status. Call once during app bootstrap, before the first flush. */
  async hydrate(): Promise<void> {
    const [outbox, status] = await Promise.all([
      this.persistence.loadOutbox(),
      this.persistence.loadStatus(),
    ]);
    for (const record of outbox) {
      const revision = record.revision ?? ++this.nextRevision;
      this.nextRevision = Math.max(this.nextRevision, revision);
      this.replaceOrAppend(record, revision);
    }
    if (status) this.status = status;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /** Records waiting to push — includes any still queued from an in-flight flush's requeue. */
  getPendingCount(): number {
    return this.queue.length;
  }

  /**
   * True once enough time has passed since the last failure to retry.
   * Fixed-interval callers should check this before calling flush(); event-driven
   * callers (visibility/reconnect) may bypass it for an opportunistic retry.
   */
  shouldAttemptFlush(): boolean {
    if (!this.status.nextRetryAt) return true;
    return Date.now() >= new Date(this.status.nextRetryAt).getTime();
  }

  private bareRecord(record: SyncRecord): SyncRecord {
    const { revision: _revision, ...bare } = record;
    return bare;
  }

  private replaceOrAppend(record: SyncRecord, revision: number): void {
    const bareRecord = this.bareRecord(record);
    const key = dedupeKey(bareRecord);
    const currentRevision = this.revisions.get(key);
    if (currentRevision !== undefined && currentRevision > revision) {
      return;
    }
    const existingIndex = this.queue.findIndex((r) => dedupeKey(r) === key);
    if (existingIndex === -1) {
      this.queue.push(bareRecord);
    } else {
      this.queue[existingIndex] = bareRecord;
    }
    this.revisions.set(key, revision);
  }

  /** Allocate a monotonic durable revision before a local transaction commits. */
  prepare(record: SyncRecord): PreparedSyncRecord {
    return { ...this.bareRecord(record), revision: ++this.nextRevision };
  }

  private schedulePersistence(operation: () => Promise<void>): void {
    void this.chainPersistence(operation).catch((error: unknown) => {
      console.error('[sync] failed to persist durable state', error);
    });
  }

  private chainPersistence(operation: () => Promise<void>): Promise<void> {
    const next = this.persistenceTail.then(operation, operation);
    this.persistenceTail = next;
    return next;
  }

  private async persistRecord(
    record: SyncRecord,
    revision: number,
    snapshot: SyncRecord[],
  ): Promise<void> {
    if (this.persistence.upsertOutbox) {
      await this.persistence.upsertOutbox(this.bareRecord(record), revision);
      return;
    }
    await this.persistence.saveOutbox(snapshot);
  }

  private async persistRemoval(records: SyncRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (this.persistence.removeOutbox) {
      await this.chainPersistence(() => this.persistence.removeOutbox!(records));
      return;
    }
    const snapshot = this.queue.map((queued) => this.bareRecord(queued));
    await this.chainPersistence(() => this.persistence.saveOutbox(snapshot));
  }

  /**
   * Enqueue a record after its local SQLite transaction has already persisted
   * the matching outbox row. This updates process-local signals without
   * issuing a second asynchronous snapshot write.
   */
  enqueuePrepared(record: PreparedSyncRecord, options?: { durablyPersisted?: boolean }): void {
    this.replaceOrAppend(record, record.revision);
    if (options?.durablyPersisted) return;
    const revision = record.revision;
    const snapshot = this.queue.map((queued) => this.bareRecord(queued));
    this.schedulePersistence(() => this.persistRecord(record, revision, snapshot));
  }

  /** Idempotent per (entity,id): a later enqueue replaces an earlier still-pending one. */
  enqueue(record: SyncRecord): PreparedSyncRecord {
    const prepared = this.prepare(record);
    this.enqueuePrepared(prepared);
    return prepared;
  }

  /** Concurrent callers (interval + visibility + NetInfo) share the same in-flight push instead of racing. */
  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    const run = this.doFlush().finally(() => {
      this.flushing = null;
    });
    this.flushing = run;
    return run;
  }

  private async doFlush(): Promise<void> {
    if (this.queue.length === 0) return;
    const snapshot = this.queue.map((record) => this.bareRecord(record));
    const snapshotWithRevisions = snapshot.map((record) => ({
      ...record,
      revision: this.revisions.get(dedupeKey(record)) ?? 0,
    }));
    this.queue = [];
    // Select the batch synchronously before yielding. This preserves the
    // enqueue-during-flush boundary: a record added after flush() starts stays
    // in the next batch even if the first enqueue's durable write is pending.
    const persistenceAtSelection = this.persistenceTail;
    try {
      await persistenceAtSelection;
    } catch (error) {
      this.queue = [...snapshot, ...this.queue];
      this.recordFailure(error);
      throw error;
    }
    // Never pass this to `push` — adapters may mutate the batch array; recovery must
    // still restore the original records.
    const preservedForRetry = [...snapshot];
    try {
      await this.adapter.push(snapshot);
      await this.persistRemoval(snapshotWithRevisions);
      this.recordSuccess();
    } catch (error) {
      const failedRecords =
        error instanceof SyncPushPartialFailureError ? error.failedRecords : preservedForRetry;
      const failedKeys = new Set(failedRecords.map(dedupeKey));
      const succeeded = snapshotWithRevisions.filter(
        (record) => !failedKeys.has(dedupeKey(record)),
      );
      if (error instanceof SyncPushPartialFailureError) {
        try {
          await this.persistRemoval(succeeded);
        } catch (persistenceError) {
          const currentKeys = new Set(this.queue.map(dedupeKey));
          const retryAll = snapshot.filter((record) => !currentKeys.has(dedupeKey(record)));
          this.queue = [...retryAll, ...this.queue];
          this.recordFailure(persistenceError);
          throw persistenceError;
        }
      }
      // Anything not reported as failed succeeded and should stay dropped;
      // only the actually-failed records go back, ahead of anything enqueued
      // while this flush was in flight.
      const currentKeys = new Set(this.queue.map(dedupeKey));
      const retryRecords = failedRecords.filter((record) => !currentKeys.has(dedupeKey(record)));
      this.queue = [...retryRecords, ...this.queue];
      for (const failed of retryRecords) {
        const original = snapshotWithRevisions.find(
          (record) => dedupeKey(record) === dedupeKey(failed),
        );
        if (original) this.revisions.set(dedupeKey(failed), original.revision ?? 0);
      }
      this.recordFailure(error);
      throw error;
    }
    await this.persistenceTail;
  }

  private recordSuccess(): void {
    this.status = {
      lastSuccessAt: new Date().toISOString(),
      consecutiveFailures: 0,
      lastErrorMessage: null,
      nextRetryAt: null,
    };
    this.schedulePersistence(() => this.persistence.saveStatus(this.status));
  }

  private recordFailure(error: unknown): void {
    const consecutiveFailures = this.status.consecutiveFailures + 1;
    const nextRetryAt = new Date(Date.now() + backoffDelayMs(consecutiveFailures)).toISOString();
    this.status = {
      ...this.status,
      consecutiveFailures,
      lastErrorMessage: error instanceof Error ? error.message : String(error),
      nextRetryAt,
    };
    this.schedulePersistence(() => this.persistence.saveStatus(this.status));
  }
}

export const syncEngine = new SyncEngine(new SupabaseSyncAdapter(), new SqliteSyncPersistence());
