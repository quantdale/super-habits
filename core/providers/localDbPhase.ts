/**
 * Bounds the LOCAL database bootstrap phase.
 *
 * WHY THIS EXISTS
 * ---------------
 * `initializeDatabase()` had no timeout, unlike every remote phase, which is
 * bounded by `withRemoteTimeout` (10 s). On web the database is opened through
 * OPFS, where `openDatabaseAsync` can STALL rather than reject — a second tab
 * holding the single origin-wide write lock is the documented case, and a
 * wedged WASM worker is another. A stall left the startup gate on
 * "Preparing local workspace" forever with NO retry affordance, because the
 * gate only offers "Try again" when `dbError` is set.
 *
 * The distinction matters beyond remote phases: a local stall is not a network
 * problem, so the copy must not blame connectivity. And a local bootstrap that
 * is only SLOW (first launch migrating a large database, cold OPFS) must not be
 * failed as if it were broken — so the timeout is deliberately generous and is
 * designed to route into the SAME retry the failure path already offers.
 *
 * The underlying task is NOT cancelled: it keeps running and, if it eventually
 * succeeds, the retry path re-adopts the same memoized connection
 * (`getDatabase()` resets its promise only on rejection). Only the await is
 * bounded.
 */

/**
 * How long a local database bootstrap may stay unresolved before the user is
 * offered a retry. Generous on purpose: this must not trip on a legitimate
 * first-launch migration, only on a genuine stall. 30 s is well past any
 * observed cold-start migration on the supported targets while still being far
 * short of "forever".
 */
export const LOCAL_DB_PHASE_TIMEOUT_MS = 30_000;

/** Marker so callers can distinguish a timeout from a real bootstrap failure. */
export class LocalDbPhaseTimeoutError extends Error {
  readonly label: string;

  constructor(label: string) {
    super(`[bootstrap] local phase "${label}" timed out`);
    this.name = 'LocalDbPhaseTimeoutError';
    this.label = label;
  }
}

export function isLocalDbPhaseTimeout(error: unknown): error is LocalDbPhaseTimeoutError {
  return error instanceof LocalDbPhaseTimeoutError;
}

/**
 * Await a local bootstrap task, rejecting with `LocalDbPhaseTimeoutError` once
 * `timeoutMs` elapses. `timeoutMs <= 0` disables the bound (used by tests and
 * by any caller that explicitly wants unbounded behaviour).
 */
export async function withLocalDbTimeout<T>(
  task: Promise<T>,
  label: string,
  timeoutMs: number = LOCAL_DB_PHASE_TIMEOUT_MS,
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return task;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new LocalDbPhaseTimeoutError(label)), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * User-facing copy when the local database phase times out.
 *
 * Deliberately different from the failure copy: a stall is not evidence the
 * browser is incapable, and advising "this browser is unsupported" would be
 * wrong. It never advises clearing site data, because on a local-first app that
 * destroys the user's only copy.
 */
export function getDbBootstrapTimeoutMessage(input: { platformOs: string }): string {
  if (input.platformOs !== 'web') {
    return (
      'The database is taking longer than expected to open. ' +
      'Try again — your data is still safe on this device.'
    );
  }

  return (
    'The local database is taking longer than expected to open. This usually means ' +
    'another tab still holds it — close other super-habits tabs, then try again. ' +
    'If it keeps happening, reload this page. ' +
    'Your data is still safe on this device.'
  );
}
