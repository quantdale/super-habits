/**
 * Best-effort detection of a reset/evicted local database — CORR-A-02.
 *
 * WHY THIS EXISTS
 * ---------------
 * The web build stores its SQLite database in OPFS. Browsers may evict origin
 * storage (including OPFS) under storage pressure or when the user clears site
 * data — no API can prevent that, and `navigator.storage.persist()` only makes
 * it less likely. When it happens the app silently starts over with an empty
 * database, which a user can easily read as "my data is gone forever" or —
 * worse — as authoritative empty state.
 *
 * What CAN be done reliably: notice that the database store changed identity
 * while another store survived. localStorage and OPFS are separate stores with
 * separate eviction paths, so this module keeps
 *
 *   - an identity marker INSIDE the database (`app_meta.db.identity_marker`), and
 *   - a sentinel OUTSIDE it (localStorage `superhabits.db.sentinel`),
 *
 * and compares them after every bootstrap. Outcomes:
 *
 *   - 'fresh'          — neither side existed: a genuinely new install.
 *   - 'intact'         — both sides agree: nothing to report.
 *   - 'possible-reset' — the localStorage sentinel predates this database:
 *                        the previous database is no longer visible. The app
 *                        must say so ONCE, point at backup restore / portable
 *                        import, and never pretend to know what was lost.
 *   - 'unavailable'    — no comparable second store (native, or storage
 *                        blocked): detection is not possible, and none is
 *                        claimed.
 *
 * This is detection, not prevention. It cannot distinguish eviction from the
 * user deliberately clearing data (both are reported the same neutral way),
 * and it will not fire when BOTH stores were cleared together — which is the
 * common "clear site data" case and is honestly unobservable.
 */

import type * as SQLite from 'expo-sqlite';
import { appMetaKeys, getAppMetaJson, setAppMetaJson } from '@/core/db/appMeta';

export const STORAGE_SENTINEL_KEY = 'superhabits.db.sentinel';

/** Minimal localStorage surface (injectable for deterministic tests). */
export type WebStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type StorageResetVerdict = 'fresh' | 'intact' | 'possible-reset' | 'unavailable';

type DbIdentityMarker = { firstOpenAt: string };
type StorageSentinel = { schema: 1; lastSeenAt: string };

function resolveWebStorage(): WebStorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    // Access can itself be blocked (storage-access failures): treat as absent.
    return null;
  }
}

function readSentinel(webStorage: WebStorageLike): StorageSentinel | null {
  // NOTE: getItem exceptions are DELIBERATELY not caught here — a blocked
  // store (storage-access denial) must surface as 'unavailable', which is
  // observably different from an absent (null) or malformed sentinel.
  const raw = webStorage.getItem(STORAGE_SENTINEL_KEY);
  try {
    if (typeof raw !== 'string') return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as StorageSentinel).schema === 1 &&
      typeof (parsed as StorageSentinel).lastSeenAt === 'string'
    ) {
      return parsed as StorageSentinel;
    }
    return null;
  } catch {
    return null;
  }
}

function writeSentinel(webStorage: WebStorageLike, nowIso: string): void {
  try {
    const sentinel: StorageSentinel = { schema: 1, lastSeenAt: nowIso };
    webStorage.setItem(STORAGE_SENTINEL_KEY, JSON.stringify(sentinel));
  } catch {
    // Sentinel upkeep is best-effort; detection must never break bootstrap.
  }
}

/**
 * Reconcile the two stores after a successful bootstrap and return the
 * storage-reset verdict. Also refreshes both markers so the NEXT launch has a
 * consistent pair to compare. Never throws.
 */
export async function reconcileStorageSentinel(input: {
  db: SQLite.SQLiteDatabase;
  nowIso: string;
  webStorage?: WebStorageLike | null;
}): Promise<StorageResetVerdict> {
  const webStorage = input.webStorage === undefined ? resolveWebStorage() : input.webStorage;
  if (!webStorage) return 'unavailable';

  try {
    const identity = await getAppMetaJson<DbIdentityMarker>(input.db, appMetaKeys.dbIdentityMarker);
    const sentinel = readSentinel(webStorage);

    if (identity === null && sentinel === null) {
      // Genuinely new install: seed both sides.
      await setAppMetaJson<DbIdentityMarker>(input.db, appMetaKeys.dbIdentityMarker, {
        firstOpenAt: input.nowIso,
      });
      writeSentinel(webStorage, input.nowIso);
      return 'fresh';
    }

    if (identity === null && sentinel !== null) {
      // The sentinel outlived the database: the previous database store is no
      // longer visible. Seed a new identity and report — once, neutrally.
      await setAppMetaJson<DbIdentityMarker>(input.db, appMetaKeys.dbIdentityMarker, {
        firstOpenAt: input.nowIso,
      });
      writeSentinel(webStorage, input.nowIso);
      return 'possible-reset';
    }

    // Identity exists (DB is the same store as before). A missing sentinel is
    // unremarkable (localStorage cleared) — re-create it quietly.
    writeSentinel(webStorage, input.nowIso);
    return 'intact';
  } catch {
    return 'unavailable';
  }
}

/**
 * User-facing copy for a detected possible reset. Neutral about cause (the
 * platform cannot distinguish eviction from deliberate clearing), concrete
 * about the recovery path, and never claims to know what was lost.
 */
export function getStorageResetMessage(): string {
  return (
    'Your local database appears to have been reset since your last visit — this ' +
    'can happen when the browser reclaims storage. If you have a backup, restore it ' +
    'from Settings → Backup / Sync / Restore (or import a portable backup). Nothing ' +
    'was deleted by super-habits.'
  );
}
