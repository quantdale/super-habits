import { describe, expect, it } from 'vitest';
import type * as SQLite from 'expo-sqlite';
import { appMetaKeys } from '@/core/db/appMeta';
import {
  getStorageResetMessage,
  reconcileStorageSentinel,
  STORAGE_SENTINEL_KEY,
  type WebStorageLike,
} from '@/core/storage/storageSentinel';

/**
 * CORR-A-02 storage-reset detection contract: a localStorage sentinel that
 * outlives the database's identity marker proves the DB store was reset while
 * the rest of the origin survived — the one loss case that is reliably
 * observable. Every path is asserted for both the verdict AND the marker
 * upkeep that makes the NEXT launch comparable.
 */

function makeDb() {
  const meta = new Map<string, string>();
  const db = {
    meta,
    getFirstAsync: async (_sql: string, params?: readonly unknown[]) => {
      const value = meta.get(String(params?.[0]));
      return value === undefined ? null : { value };
    },
    runAsync: async (_sql: string, params?: readonly unknown[]) => {
      meta.set(String(params?.[0]), String(params?.[1]));
      return { changes: 1, lastInsertRowId: 1 };
    },
    getAllAsync: async () => [],
    withTransactionAsync: async (task: () => Promise<void>) => {
      await task();
    },
    execAsync: async () => undefined,
    closeAsync: async () => undefined,
  };
  return db as unknown as SQLite.SQLiteDatabase & { meta: Map<string, string> };
}

function makeStorage(initial: Record<string, string> = {}): WebStorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const identityKey = appMetaKeys.dbIdentityMarker.key;
const NOW = '2026-10-23T10:00:00.000Z';

describe('reconcileStorageSentinel', () => {
  it('reports fresh and seeds BOTH markers on a genuinely new install', async () => {
    const db = makeDb();
    const storage = makeStorage();

    const verdict = await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });

    expect(verdict).toBe('fresh');
    expect(db.meta.has(identityKey)).toBe(true);
    expect(storage.data.has(STORAGE_SENTINEL_KEY)).toBe(true);
  });

  it('reports intact and refreshes the sentinel when both stores agree', async () => {
    const db = makeDb();
    const storage = makeStorage();

    await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });
    const later = '2026-10-24T10:00:00.000Z';
    const verdict = await reconcileStorageSentinel({ db, nowIso: later, webStorage: storage });

    expect(verdict).toBe('intact');
    const sentinel = JSON.parse(storage.data.get(STORAGE_SENTINEL_KEY) ?? '{}');
    expect(sentinel.lastSeenAt).toBe(later);
  });

  it('reports possible-reset when the sentinel outlived the database identity (mandatory loss case)', async () => {
    const db = makeDb();
    // A sentinel from an earlier life of this origin, but the database is new
    // (no identity marker) — exactly what a reset/evicted DB store looks like.
    const storage = makeStorage({
      [STORAGE_SENTINEL_KEY]: JSON.stringify({ schema: 1, lastSeenAt: '2026-01-01T00:00:00Z' }),
    });

    const verdict = await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });

    expect(verdict).toBe('possible-reset');
    // Recovery state is reseeded so the next launch reads intact, not a loop.
    expect(db.meta.has(identityKey)).toBe(true);
    const next = await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });
    expect(next).toBe('intact');
  });

  it('treats a surviving database with a missing sentinel as intact (localStorage-only loss)', async () => {
    const db = makeDb();
    const storage = makeStorage();
    await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });

    const freshStorage = makeStorage();
    const verdict = await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: freshStorage });

    expect(verdict).toBe('intact');
    expect(freshStorage.data.has(STORAGE_SENTINEL_KEY)).toBe(true);
  });

  it('reports unavailable — and never crashes — when the second store is absent or blocked', async () => {
    const db = makeDb();
    await expect(reconcileStorageSentinel({ db, nowIso: NOW, webStorage: null })).resolves.toBe(
      'unavailable',
    );

    const blocked: WebStorageLike = {
      getItem: () => {
        throw new Error('storage access denied');
      },
      setItem: () => {
        throw new Error('storage access denied');
      },
    };
    await expect(reconcileStorageSentinel({ db, nowIso: NOW, webStorage: blocked })).resolves.toBe(
      'unavailable',
    );
  });

  it('ignores a malformed sentinel instead of reporting a false reset', async () => {
    const db = makeDb();
    const storage = makeStorage({ [STORAGE_SENTINEL_KEY]: 'not-json{{{' });

    const verdict = await reconcileStorageSentinel({ db, nowIso: NOW, webStorage: storage });

    expect(verdict).toBe('fresh');
  });
});

describe('getStorageResetMessage', () => {
  it('is neutral about cause, points at recovery, and never claims data was deleted', () => {
    const message = getStorageResetMessage();
    expect(message).toMatch(/restore/i);
    expect(message).toMatch(/appears to have been reset/i);
    expect(message).not.toMatch(/super-habits (deleted|cleared|lost)/i);
    expect(message).not.toMatch(/clear(ing)? (site|browser) data/i);
  });
});
