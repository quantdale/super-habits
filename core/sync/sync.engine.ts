import { SupabaseSyncAdapter } from '@/core/sync/supabase.adapter';
import { SqliteSyncPersistence } from '@/core/sync/syncPersistence';
import { SyncPushPartialFailureError } from '@/core/sync/syncErrors';

export type SyncRecord = {
  entity: string;
  id: string;
  updatedAt: string;
  operation: 'create' | 'update' | 'delete';
};

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
  saveOutbox(records: SyncRecord[]): Promise<void>;
  loadStatus(): Promise<SyncStatus | null>;
  saveStatus(status: SyncStatus): Promise<void>;
}

export class NoopSyncPersistence implements SyncPersistence {
  loadOutbox() {
    return Promise.resolve<SyncRecord[]>([]);
  }
  async saveOutbox(_records: SyncRecord[]) {}
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
  private status: SyncStatus = { ...INITIAL_SYNC_STATUS };
  private flushing: Promise<void> | null = null;

  /** Loads the persisted outbox/status. Call once during app bootstrap, before the first flush. */
  async hydrate(): Promise<void> {
    const [outbox, status] = await Promise.all([
      this.persistence.loadOutbox(),
      this.persistence.loadStatus(),
    ]);
    for (const record of outbox) {
      this.replaceOrAppend(record);
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

  private replaceOrAppend(record: SyncRecord): void {
    const key = dedupeKey(record);
    const existingIndex = this.queue.findIndex((r) => dedupeKey(r) === key);
    if (existingIndex === -1) {
      this.queue.push(record);
    } else {
      this.queue[existingIndex] = record;
    }
  }

  /** Idempotent per (entity,id): a later enqueue replaces an earlier still-pending one instead of piling up duplicates. */
  enqueue(record: SyncRecord) {
    this.replaceOrAppend(record);
    this.persistence.saveOutbox(this.queue).catch((error: unknown) => {
      console.error('[sync] failed to persist outbox', error);
    });
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
    const snapshot = [...this.queue];
    this.queue = [];
    // Never pass this to `push` — adapters may mutate the batch array; recovery must
    // still restore the original records.
    const preservedForRetry = [...snapshot];
    try {
      await this.adapter.push(snapshot);
      this.recordSuccess();
    } catch (error) {
      const failedRecords =
        error instanceof SyncPushPartialFailureError ? error.failedRecords : preservedForRetry;
      // Anything not reported as failed succeeded and should stay dropped;
      // only the actually-failed records go back, ahead of anything enqueued
      // while this flush was in flight.
      this.queue = [...failedRecords, ...this.queue];
      this.recordFailure(error);
      throw error;
    } finally {
      this.persistence.saveOutbox(this.queue).catch((persistError: unknown) => {
        console.error('[sync] failed to persist outbox', persistError);
      });
    }
  }

  private recordSuccess(): void {
    this.status = {
      lastSuccessAt: new Date().toISOString(),
      consecutiveFailures: 0,
      lastErrorMessage: null,
      nextRetryAt: null,
    };
    this.persistence.saveStatus(this.status).catch((error: unknown) => {
      console.error('[sync] failed to persist status', error);
    });
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
    this.persistence.saveStatus(this.status).catch((persistError: unknown) => {
      console.error('[sync] failed to persist status', persistError);
    });
  }
}

export const syncEngine = new SyncEngine(new SupabaseSyncAdapter(), new SqliteSyncPersistence());
