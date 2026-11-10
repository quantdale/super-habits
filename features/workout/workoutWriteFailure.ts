import { classifyStorageError, describeStorageFailure } from '@/core/storage/storageSafety';

/**
 * Copy for a rejected Workout write at a UI catch site.
 *
 * A storage-classified failure (quota, blocked storage access) surfaces the
 * actionable, data-safe copy from `core/storage/storageSafety` — the user's
 * next step is there, and the generic sentence would hide it. Every other
 * rejection gets the site's own fixed sentence: an engine message ("Error
 * finalizing statement", a `RAISE(ABORT)` text) is not something a person can
 * act on, and pinning one sentence per site keeps the honesty contract
 * assertable.
 */
export function workoutWriteFailureCopy(error: unknown, fallback: string): string {
  const kind = classifyStorageError(error);
  return kind === 'unknown' ? fallback : describeStorageFailure(kind);
}
