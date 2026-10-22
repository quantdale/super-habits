/**
 * Storage-safety core: durable-write error classification, storage-pressure
 * estimates, and persistent-storage requests for the local-first database.
 *
 * WHY THIS EXISTS
 * ---------------
 * SuperHabits is local-first: on web the SQLite database lives in OPFS and the
 * user's data may exist ONLY on their device. Three platform realities must be
 * handled honestly:
 *
 * 1. Writes can fail for storage reasons (`QuotaExceededError`, blocked
 *    storage access, a full disk). A rejected write must never be presented as
 *    a success, and the user must get actionable copy — never a raw DOMException
 *    string, and NEVER advice to clear site data (that destroys the user's only
 *    copy).
 * 2. Browsers can evict origin storage (including OPFS) under storage pressure.
 *    `navigator.storage.persist()` reduces that risk substantially in Chromium
 *    and is worth requesting, but it is NOT a durability guarantee — no API can
 *    promise that the OS or the user cannot delete local data. The app must not
 *    claim otherwise.
 * 3. The quota/persistence APIs are optional and unavailable in some supported
 *    contexts. Every entry point here is guarded and degrades to an explicit
 *    `'unavailable'`/`'unknown'` result instead of throwing.
 *
 * Non-goals: this module does not require cloud backup for offline use, does
 * not prompt beyond the one-time persistence request (which is silent on
 * Chromium and a single native prompt elsewhere), and does not attempt to
 * outsmart deliberate data clearing by the user.
 */

/** How a failed durable write should be understood and reported. */
export type StorageFailureKind = 'quota' | 'storage-access' | 'unavailable' | 'unknown';

const QUOTA_NAME = 'QuotaExceededError';
const QUOTA_CODE = 22; // legacy DOMException.QUOTA_EXCEEDED_ERR
const STORAGE_ACCESS_NAMES = new Set(['SecurityError', 'NotAllowedError']);
const UNAVAILABLE_NAMES = new Set(['NotSupportedError', 'InvalidStateError']);
const QUOTA_MESSAGE =
  /quota|disk is full|database or disk is full|sqlite_full|no space|storage is full/i;

function errorName(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

function errorCode(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number') return code;
  }
  return null;
}

/**
 * Classify a rejected write/bootstrap error by its storage cause.
 *
 * Deliberately generous on evidence and strict on claims: a quota classification
 * needs a quota-shaped name, legacy code, or an explicit full-disk message;
 * anything unrecognized stays `'unknown'` and keeps its original message so an
 * ordinary application error is never misreported as a storage emergency.
 */
export function classifyStorageError(error: unknown): StorageFailureKind {
  const name = errorName(error);
  if (name === QUOTA_NAME) return 'quota';
  const code = errorCode(error);
  if (code === QUOTA_CODE) return 'quota';
  if (STORAGE_ACCESS_NAMES.has(name)) return 'storage-access';
  if (UNAVAILABLE_NAMES.has(name)) return 'unavailable';
  const message = errorMessage(error);
  if (QUOTA_MESSAGE.test(message)) return 'quota';
  return 'unknown';
}

export function isStorageFailure(error: unknown): boolean {
  return classifyStorageError(error) !== 'unknown';
}

/**
 * Actionable, honest copy for a storage-classified write failure.
 *
 * Contract: says the change was NOT saved, never blames connectivity for a
 * storage error, never advises clearing site data, and points at the tested
 * portable-export path (Settings → Portable data) when space is the problem.
 */
export function describeStorageFailure(kind: StorageFailureKind): string {
  switch (kind) {
    case 'quota':
      return (
        'Storage is full, so that change was not saved. Export a backup from ' +
        'Settings → Portable data, free up space, then try again.'
      );
    case 'storage-access':
      return (
        'This browser is blocking local storage, so that change was not saved. ' +
        'Allow storage for this site in your browser settings, then try again. ' +
        'Your saved data is still on this device.'
      );
    case 'unavailable':
      return (
        'This browser can not provide durable storage right now, so that change ' +
        'was not saved. Try again, or export a backup from Settings → Portable data.'
      );
    case 'unknown':
      return 'That change was not saved. Try again.';
  }
}

/**
 * Message for a failed save at a UI catch site: storage failures become
 * actionable copy; every other error keeps its own message (existing UX) with
 * the caller's fallback when there is none.
 */
export function getSaveFailureMessage(error: unknown, fallback: string): string {
  const kind = classifyStorageError(error);
  if (kind !== 'unknown') return describeStorageFailure(kind);
  const message = errorMessage(error);
  return message.length > 0 ? message : fallback;
}

/**
 * Copy for a storage-classified BOOTSTRAP failure (the database could not be
 * opened). Different from a failed save: nothing was at stake in a write, so
 * the message talks about opening the local database, keeps the data-safe
 * promise honest, and returns `null` for unrecognized errors so the caller can
 * use its existing bootstrap copy.
 */
export function describeStorageBootstrapFailure(error: unknown): string | null {
  switch (classifyStorageError(error)) {
    case 'quota':
      return (
        "The local database could not be opened because this site's storage is full. " +
        'Free up space, then try again. Your data is still on this device — do not ' +
        'clear site data.'
      );
    case 'storage-access':
      return (
        'This browser is blocking local storage, so the database could not be opened. ' +
        'Allow storage for this site in your browser settings, then try again.'
      );
    case 'unavailable':
      return (
        'This browser can not provide the durable storage super-habits needs. ' +
        'Try a recent version of Chrome, Edge, or Firefox.'
      );
    case 'unknown':
      return null;
  }
}

/** Backup recommendation copy for storage-pressure warnings. */
export function describeStoragePressure(status: 'warn' | 'critical'): string {
  return status === 'critical'
    ? 'Local storage is almost full. Export a backup from Settings → Portable data ' +
        'soon — a browser storage cleanup could otherwise cost you your data.'
    : 'Local storage is filling up. Export a backup from Settings → Portable data to ' +
        'protect your data.';
}

/**
 * Classified wrapper for a failed durable write. Non-storage failures are
 * rethrown UNWRAPPED (the exact original error) so ordinary error handling and
 * any test asserting a specific message are unaffected.
 */
export class StorageWriteError extends Error {
  readonly kind: StorageFailureKind;
  readonly action: string;

  constructor(kind: StorageFailureKind, action: string, cause: unknown) {
    super(describeStorageFailure(kind));
    this.name = 'StorageWriteError';
    this.kind = kind;
    this.action = action;
    (this as { cause?: unknown }).cause = cause;
  }
}

export function wrapDurableWriteError(error: unknown, action: string): unknown {
  // Idempotent: nested transactional layers must not re-wrap an already
  // classified failure (its message already carries the storage copy).
  if (error instanceof StorageWriteError) return error;
  const kind = classifyStorageError(error);
  if (kind === 'unknown') return error;
  return new StorageWriteError(kind, action, error);
}

/** Storage-pressure levels, worst-first. */
export type StoragePressureStatus = 'critical' | 'warn' | 'ok' | 'unknown';

export type StoragePressure = {
  status: StoragePressureStatus;
  usageBytes?: number;
  quotaBytes?: number;
  freeBytes?: number;
  /** Why the status is `'unknown'`, when it is. */
  reason?: 'unavailable' | 'error' | 'incomplete';
};

/**
 * Warning thresholds. These are advisory: the estimate API is approximate and
 * eviction decisions belong to the browser. A `'warn'` result recommends a
 * backup export; `'critical'` makes the same recommendation more loudly. No
 * status here can guarantee data survival.
 */
export const STORAGE_PRESSURE_THRESHOLDS = {
  /** usage/quota ratio that starts recommending a backup export */
  warnUsageRatio: 0.8,
  /** usage/quota ratio treated as critical */
  criticalUsageRatio: 0.95,
  /** free bytes that start recommending a backup export */
  warnFreeBytes: 50 * 1024 * 1024,
  /** free bytes treated as critical */
  criticalFreeBytes: 10 * 1024 * 1024,
} as const;

/** Minimal surface of `navigator.storage` this module consumes. */
export type StorageManagerLike = {
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

function resolveStorageManager(): StorageManagerLike | null {
  if (typeof navigator === 'undefined') return null;
  const manager = (navigator as Navigator & { storage?: StorageManagerLike }).storage;
  return manager ?? null;
}

function pressureFromNumbers(
  usage: number | undefined,
  quota: number | undefined,
): StoragePressure {
  const t = STORAGE_PRESSURE_THRESHOLDS;
  let status: StoragePressureStatus = 'ok';
  let free: number | undefined;

  if (typeof quota === 'number' && quota > 0 && typeof usage === 'number') {
    free = quota - usage;
    const ratio = usage / quota;
    if (ratio >= t.criticalUsageRatio) status = 'critical';
    else if (ratio >= t.warnUsageRatio) status = 'warn';
  }

  if (typeof free === 'number') {
    if (free < t.criticalFreeBytes && status !== 'critical') status = 'critical';
    else if (free < t.warnFreeBytes && status === 'ok') status = 'warn';
  }

  return {
    status,
    usageBytes: typeof usage === 'number' ? usage : undefined,
    quotaBytes: typeof quota === 'number' ? quota : undefined,
    freeBytes: free,
  };
}

/**
 * Best-effort storage-pressure estimate. Never throws: an unavailable or
 * misbehaving API yields `'unknown'` with a reason, so pressure UI can stay
 * quiet instead of crying wolf.
 */
export async function estimateStoragePressure(
  storageManager?: StorageManagerLike | null,
): Promise<StoragePressure> {
  const manager = storageManager === undefined ? resolveStorageManager() : storageManager;
  if (!manager || typeof manager.estimate !== 'function') {
    return { status: 'unknown', reason: 'unavailable' };
  }
  try {
    const estimate = await manager.estimate();
    const usage = typeof estimate?.usage === 'number' ? estimate.usage : undefined;
    const quota = typeof estimate?.quota === 'number' ? estimate.quota : undefined;
    if (usage === undefined && quota === undefined) {
      return { status: 'unknown', reason: 'incomplete' };
    }
    return pressureFromNumbers(usage, quota);
  } catch {
    return { status: 'unknown', reason: 'error' };
  }
}

export type PersistenceOutcome = 'granted' | 'already-granted' | 'denied' | 'unavailable' | 'error';

/**
 * One-shot persistence request, memoized per app run.
 *
 * UX contract: called at most once, at a justified moment (after a successful
 * bootstrap on a device that already holds user data). Chromium grants this
 * silently based on user engagement; other engines may show a single native
 * prompt. The app continues unchanged on every outcome — this is a durability
 * improvement request, never a gate. `already-granted` avoids even that prompt
 * when persistence is already in place.
 */
let persistenceRequest: Promise<PersistenceOutcome> | null = null;

export function requestPersistentStorage(
  storageManager?: StorageManagerLike | null,
): Promise<PersistenceOutcome> {
  if (!persistenceRequest) {
    const manager = storageManager === undefined ? resolveStorageManager() : storageManager;
    persistenceRequest = (async (): Promise<PersistenceOutcome> => {
      if (!manager || typeof manager.persist !== 'function') return 'unavailable';
      try {
        if (typeof manager.persisted === 'function') {
          const already = await manager.persisted();
          if (already) return 'already-granted';
        }
        const granted = await manager.persist();
        return granted ? 'granted' : 'denied';
      } catch {
        return 'error';
      }
    })();
  }
  return persistenceRequest;
}

/** Test seam: drop the one-shot memo so scenarios stay independent. */
export function resetPersistentStorageRequestForTests(): void {
  persistenceRequest = null;
}
