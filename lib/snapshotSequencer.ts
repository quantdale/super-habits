/**
 * Monotonic sequencer for asynchronous snapshot applications.
 *
 * A fetch that starts later can resolve earlier than a slower older fetch.
 * Applying snapshots in completion order lets the older result win the last
 * `setState` and regress the UI to stale rows. `begin()` is called when a
 * fetch starts, `claim(seq)` is called with the fetch's sequence number right
 * before applying its result; it returns `true` only for the newest result
 * that has not been superseded by an already-applied newer one.
 *
 * Pure logic, no React, no DB — the interleaving rules are exercised through
 * the routine-detail save path in `features/workout/RoutineDetailScreen.tsx`.
 */

export type SnapshotSequencer = {
  /** Start a new snapshot read; returns its sequence number. */
  begin: () => number;
  /**
   * Claim the right to apply a fetched snapshot. Returns false when a newer
   * snapshot has already been applied (the caller must drop its result).
   */
  claim: (seq: number) => boolean;
};

export function createSnapshotSequencer(): SnapshotSequencer {
  let issued = 0;
  let applied = 0;
  return {
    begin: () => {
      issued += 1;
      return issued;
    },
    claim: (seq: number) => {
      if (!Number.isInteger(seq) || seq <= applied) return false;
      applied = seq;
      return true;
    },
  };
}
