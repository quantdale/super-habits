import type { SyncRecord } from '@/core/sync/sync.engine';

/**
 * An adapter may throw this instead of a plain Error to report that some
 * entities pushed successfully while others failed, so the engine only
 * requeues `failedRecords` rather than the entire batch — one poisoned
 * entity no longer blocks every other entity's records behind it.
 */
export class SyncPushPartialFailureError extends Error {
  constructor(
    message: string,
    public readonly failedRecords: SyncRecord[],
  ) {
    super(message);
    this.name = 'SyncPushPartialFailureError';
  }
}
