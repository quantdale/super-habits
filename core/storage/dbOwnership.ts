/**
 * Cross-tab database ownership for the web (OPFS) build — CORR-A-03.
 *
 * WHY THIS EXISTS
 * ---------------
 * On web the SQLite database lives in OPFS behind one origin-wide write lock.
 * `openDatabaseAsync` in a second tab does not fail fast: it STALLS until the
 * first tab releases its access handle. PR #87 bounds that stall with a 30 s
 * timeout, but a timeout only changes what the user sees — it cannot create a
 * second writer. This module implements the other half: a single authoritative
 * database WRITER model per origin, detected BEFORE the open is attempted.
 *
 * Mechanism: the Web Locks API (`navigator.locks`), which mirrors the OPFS
 * handle lifecycle almost exactly — both are released automatically when the
 * owning tab closes or crashes, and both are per-origin. The first tab holds
 * `superhabits.db.owner` for its whole session; a later tab finds the lock
 * taken and is told immediately ("open in another tab") instead of hanging in
 * the OPFS open. When the owning tab closes, the lock frees and a retry in the
 * other tab acquires it and proceeds.
 *
 * Honesty about the model:
 * - Where `navigator.locks` is unavailable, this returns `'unavailable'` and
 *   the caller falls back to the timeout-bounded open (PR #87's behavior).
 *   Detection is best-effort; it is not claimed to be universal.
 * - This does not weaken transactional isolation: it restricts WRITERS, the
 *   same restriction OPFS already enforces, just with an honest signal.
 * - No polling: acquisition attempts happen on explicit user retries only.
 */

/** The per-origin lock name. One database writer per origin. */
export const DB_OWNERSHIP_LOCK_NAME = 'superhabits.db.owner';

/**
 * Bound for the acquisition probe itself. `ifAvailable` resolves immediately
 * when the lock is free OR held, so this only guards a wedged locks
 * implementation; it is not a wait-for-the-lock timeout.
 */
export const DB_OWNERSHIP_PROBE_TIMEOUT_MS = 2_000;

/** Minimal surface of `navigator.locks` this module consumes. */
export type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable?: boolean },
    callback: (lock: { name: string; mode: string } | null) => Promise<void> | void,
  ) => Promise<unknown>;
};

export type DbOwnershipStatus =
  /** This tab now owns the database writer role; `release` gives it up. */
  | 'acquired'
  /** Another live tab owns it — show recovery UX, do NOT attempt the open. */
  | 'contended'
  /** Web Locks unsupported or the probe failed — fall back to the bounded open. */
  | 'unavailable';

export type DbOwnership = {
  status: DbOwnershipStatus;
  /** Releases a held ownership claim (idempotent; no-op unless acquired). */
  release: () => void;
};

function resolveLockManager(): LockManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
  return locks ?? null;
}

/**
 * Try to claim the per-origin database writer role without waiting for another
 * tab. Never throws: contention is a status, and an API failure degrades to
 * `'unavailable'` so the caller's existing bounded-open path still runs.
 */
export async function tryAcquireDbOwnership(locks?: LockManagerLike | null): Promise<DbOwnership> {
  const manager = locks === undefined ? resolveLockManager() : locks;
  if (!manager || typeof manager.request !== 'function') {
    return { status: 'unavailable', release: () => {} };
  }

  let releaseOwnership = () => {};
  const held = new Promise<void>((resolve) => {
    releaseOwnership = resolve;
  });

  let settle: (status: DbOwnershipStatus) => void = () => {};
  const probed = new Promise<DbOwnershipStatus>((resolve) => {
    settle = resolve;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const bounded = Promise.race([
    probed,
    new Promise<DbOwnershipStatus>((resolve) => {
      timer = setTimeout(() => resolve('unavailable'), DB_OWNERSHIP_PROBE_TIMEOUT_MS);
    }),
  ]);

  // Not awaited: the request promise stays pending for as long as ownership is
  // held (that IS the hold). Only the probe result is awaited, bounded.
  void manager
    .request(DB_OWNERSHIP_LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (lock === null) {
        settle('contended');
        return;
      }
      settle('acquired');
      return held;
    })
    .catch(() => settle('unavailable'));

  const status = await bounded;
  clearTimeout(timer);

  if (status === 'acquired') {
    return { status, release: () => releaseOwnership() };
  }
  // Nothing was acquired (or the probe degraded): make sure a late
  // acquisition from the timed-out probe cannot linger as an orphaned hold.
  releaseOwnership();
  return { status, release: () => {} };
}

/**
 * User-facing copy when another tab owns the database. Deliberately actionable
 * and honest: this is a writer-exclusivity situation, not data loss, and it
 * never advises clearing site data.
 */
export function getDbOwnedByOtherTabMessage(): string {
  return (
    'super-habits is already open in another tab, and only one tab can write to ' +
    'the local database at a time. Close the other tab, then try again here. ' +
    'Your data is still safe on this device.'
  );
}

/**
 * The writer claim for THIS page load, shared across provider remounts.
 *
 * WHY MODULE SCOPE (CORR-A-05): the claim is per TAB, but it used to be held in
 * a component ref released on unmount. A history navigation that resets the
 * shell (browser back/forward between entries) unmounts `AppProviders` and
 * immediately remounts it, and `release()` only resolves the callback promise —
 * the browser releases the actual Web Lock ASYNCHRONOUSLY afterwards. The
 * remount's `ifAvailable` probe therefore ran while this same tab's dying hold
 * was still in place and reported `contended`, surfacing the fatal "already open
 * in another tab" gate for a lock nobody else held.
 *
 * A page load owns at most one claim, so it lives for the page: an unmount
 * keeps it, a remount reuses it, and closing/reloading the tab lets the browser
 * drop the lock automatically (Web Locks and the OPFS handle both die with the
 * document). That is strictly safer than an explicit early release: the lock is
 * never handed to another tab while this one is still alive and writing.
 */
let pageOwnership: DbOwnership | null = null;
let pageOwnershipAttempt: Promise<DbOwnership> | null = null;

/**
 * Acquire (once per page load) or reuse this tab's writer claim. Concurrent
 * callers share one in-flight probe, so a remount racing the previous
 * bootstrap can never probe against itself.
 */
export function acquirePageDbOwnership(locks?: LockManagerLike | null): Promise<DbOwnership> {
  if (pageOwnership && pageOwnership.status === 'acquired') {
    return Promise.resolve(pageOwnership);
  }
  if (pageOwnershipAttempt) return pageOwnershipAttempt;
  pageOwnershipAttempt = tryAcquireDbOwnership(locks)
    .then((ownership) => {
      // A contended/unavailable result is NOT cached for the page: the owning
      // tab may close later, and the startup gate's retry must be able to
      // acquire then (matches the shipped "close the other tab, then retry"
      // copy). Only a real hold is page-scoped.
      if (ownership.status === 'acquired') pageOwnership = ownership;
      return ownership;
    })
    .finally(() => {
      pageOwnershipAttempt = null;
    });
  return pageOwnershipAttempt;
}

/** Test-only: forget the page-level claim so each case starts clean. */
export function __resetPageDbOwnershipForTests(): void {
  pageOwnership = null;
  pageOwnershipAttempt = null;
}
