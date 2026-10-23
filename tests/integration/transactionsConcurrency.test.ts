import type * as SQLite from 'expo-sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Platform } from 'react-native';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/db';
import { withSQLiteTransaction } from '@/core/db/transactions';
import {
  appMetaKeys,
  deleteAppMetaKey,
  getAppMetaText,
  setAppMetaJson,
  setAppMetaText,
} from '@/core/db/appMeta';
import { StorageWriteError } from '@/core/storage/storageSafety';

function barrier() {
  let release!: () => void;
  const reached = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { reached, release };
}

function sqlite(db: TestDatabase): SQLite.SQLiteDatabase {
  return db as unknown as SQLite.SQLiteDatabase;
}

/** Native exclusive API supplies a DIFFERENT connection; web reuses the base. */
function adapter(db: TestDatabase, platform: 'web' | 'ios') {
  const root = sqlite(db);
  let exclusiveCalls = 0;
  if (platform === 'ios') {
    const transactionDb = Object.create(db) as TestDatabase;
    transactionDb.runAsync = async function (sql, params) {
      expect(this).toBe(transactionDb);
      return db.runAsync(sql, params);
    };
    root.withExclusiveTransactionAsync = async (task) => {
      exclusiveCalls += 1;
      await db.withTransactionAsync(() => task(sqlite(transactionDb)));
    };
  } else {
    root.withExclusiveTransactionAsync = async () => {
      throw new Error('Web must not use native exclusive API');
    };
  }
  return { root, exclusiveCalls: () => exclusiveCalls };
}

const schema = `
  CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE writes (id TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

describe.each(['web', 'ios'] as const)(
  'transactions + metadata FIFO (%s, real SQLite)',
  (platform) => {
    let db: TestDatabase;
    let root: SQLite.SQLiteDatabase;
    let exclusiveCalls: () => number;

    beforeEach(async () => {
      Platform.OS = platform;
      db = createTestDatabase();
      await db.execAsync(schema);
      ({ root, exclusiveCalls } = adapter(db, platform));
    });
    afterEach(async () => {
      await db.closeAsync();
      Platform.OS = 'ios';
    });

    it('serializes two read-dependent writers and binds the actual adapter connection', async () => {
      await db.runAsync("INSERT INTO writes VALUES ('counter', 0)");
      const entered = barrier();
      const resume = barrier();
      const order: string[] = [];
      const first = withSQLiteTransaction(root, async (tx) => {
        expect(tx).not.toBe(root);
        const row = await tx.getFirstAsync<{ value: number }>(
          "SELECT value FROM writes WHERE id='counter'",
        );
        entered.release();
        await resume.reached;
        await tx.runAsync("UPDATE writes SET value = ? WHERE id='counter'", [row!.value + 1]);
        order.push('first');
      });
      await entered.reached;
      const second = withSQLiteTransaction(root, async (tx) => {
        order.push('second');
        const row = await tx.getFirstAsync<{ value: number }>(
          "SELECT value FROM writes WHERE id='counter'",
        );
        expect(row!.value).toBe(1);
        await tx.runAsync("UPDATE writes SET value = ? WHERE id='counter'", [row!.value + 1]);
      });
      expect(order).toEqual([]);
      resume.release();
      await Promise.all([first, second]);
      expect(order).toEqual(['first', 'second']);
      expect(await db.getFirstAsync('SELECT value FROM writes')).toEqual({ value: 2 });
      expect(exclusiveCalls()).toBe(platform === 'ios' ? 2 : 0);
    });

    it('an unrelated metadata write cannot join and disappear in a rolling-back transaction', async () => {
      const entered = barrier();
      const resume = barrier();
      const interruption = new Error('controlled interruption');
      const transaction = withSQLiteTransaction(root, async (tx) => {
        await tx.runAsync("INSERT INTO writes VALUES ('aborted', 1)");
        await setAppMetaText(tx, appMetaKeys.backupDirty, 'inside');
        entered.release();
        await resume.reached;
        // The unrelated value must not have entered this open transaction.
        expect(await getAppMetaText(tx, appMetaKeys.syncStatus)).toBeNull();
        throw interruption;
      }).catch((error: unknown) => error);
      await entered.reached;
      const metadata = setAppMetaJson(root, appMetaKeys.syncStatus, { saved: true });
      resume.release();
      expect(await transaction).toBe(interruption);
      await metadata;
      expect(await getAppMetaText(root, appMetaKeys.backupDirty)).toBeNull();
      expect(await getAppMetaText(root, appMetaKeys.syncStatus)).toBe('{"saved":true}');
      expect(await db.getAllAsync('SELECT * FROM writes')).toEqual([]);
    });

    it('queues standalone metadata deletion after the committing transaction', async () => {
      const entered = barrier();
      const resume = barrier();
      const transaction = withSQLiteTransaction(root, async (tx) => {
        await setAppMetaText(tx, appMetaKeys.backupDirty, 'inside');
        entered.release();
        await resume.reached;
        expect(await getAppMetaText(tx, appMetaKeys.backupDirty)).toBe('inside');
      });
      await entered.reached;
      const deletion = deleteAppMetaKey(root, appMetaKeys.backupDirty);
      resume.release();
      await Promise.all([transaction, deletion]);
      expect(await getAppMetaText(root, appMetaKeys.backupDirty)).toBeNull();
    });

    it('rolls dependent data and metadata back when a later metadata write hits quota', async () => {
      const original = db.runAsync.bind(db);
      const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
      db.runAsync = async (sql, params) => {
        if (params?.[0] === appMetaKeys.backupPendingManifest.key) throw quota;
        return original(sql, params);
      };
      const error = await withSQLiteTransaction(root, async (tx) => {
        await tx.runAsync("INSERT INTO writes VALUES ('dependent', 1)");
        await setAppMetaText(tx, appMetaKeys.backupDirty, '1');
        await setAppMetaJson(tx, appMetaKeys.backupPendingManifest, { generation: 1 });
      }).catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(StorageWriteError);
      expect((error as StorageWriteError).kind).toBe('quota');
      expect((error as { cause: unknown }).cause).toBe(quota);
      expect(await db.getAllAsync('SELECT * FROM writes')).toEqual([]);
      expect(await db.getAllAsync('SELECT * FROM app_meta')).toEqual([]);
      // A rejected transaction must not poison the connection's queue.
      await setAppMetaText(root, appMetaKeys.backupDirty, 'retry');
      expect(await getAppMetaText(root, appMetaKeys.backupDirty)).toBe('retry');
    });

    it('classifies standalone quota rejection and drains mixed writers in invocation FIFO', async () => {
      const entered = barrier();
      const resume = barrier();
      const events: string[] = [];
      const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
      const original = db.runAsync.bind(db);
      db.runAsync = async (sql, params) => {
        if (params?.[1] === 'quota') throw quota;
        if (params?.[1] === 'metadata') events.push('metadata');
        return original(sql, params);
      };
      const head = withSQLiteTransaction(root, async () => {
        entered.release();
        await resume.reached;
        events.push('head');
      });
      await entered.reached;
      const rejected = setAppMetaText(root, appMetaKeys.backupDirty, 'quota').catch(
        (error: unknown) => error,
      );
      const second = withSQLiteTransaction(root, async () => {
        events.push('second');
      });
      const metadata = setAppMetaText(root, appMetaKeys.backupDirty, 'metadata');
      const last = withSQLiteTransaction(root, async (tx) => {
        expect(await getAppMetaText(tx, appMetaKeys.backupDirty)).toBe('metadata');
        events.push('last');
      });
      resume.release();
      await Promise.all([head, second, metadata, last]);
      const error = await rejected;
      expect(error).toBeInstanceOf(StorageWriteError);
      expect((error as { cause: unknown }).cause).toBe(quota);
      expect(events).toEqual(['head', 'second', 'metadata', 'last']);
    });

    it('fails nested/lifecycle calls immediately and expires retained capabilities and methods', async () => {
      let retained!: SQLite.SQLiteDatabase;
      let retainedWrite!: SQLite.SQLiteDatabase['runAsync'];
      let syncLifecycleCalls = 0;
      root.withTransactionSync = () => {
        syncLifecycleCalls += 1;
        throw new Error('Adapter synchronous lifecycle must never execute');
      };
      await withSQLiteTransaction(root, async (tx) => {
        retained = tx;
        retainedWrite = tx.runAsync;
        await expect(withSQLiteTransaction(tx, async () => undefined)).rejects.toThrow(
          'Nested SQLite',
        );
        await setAppMetaText(tx, appMetaKeys.backupDirty, '1');
        expect(() => tx.withTransactionAsync(async () => undefined)).toThrow('lifecycle');
        expect(() => tx.withTransactionSync(() => undefined)).toThrow('lifecycle');
        expect(syncLifecycleCalls).toBe(0);
        expect(() => tx.closeAsync()).toThrow('lifecycle');
        expect(await getAppMetaText(tx, appMetaKeys.backupDirty)).toBe('1');
      });
      await expect(setAppMetaText(retained, appMetaKeys.backupDirty, 'late')).rejects.toThrow(
        'expired',
      );
      await expect(withSQLiteTransaction(retained, async () => undefined)).rejects.toThrow(
        'expired',
      );
      expect(() => retainedWrite("INSERT INTO writes VALUES ('late', 1)")).toThrow('expired');
      expect(await getAppMetaText(root, appMetaKeys.backupDirty)).toBe('1');
    });

    it('recovers an interrupted file-backed write once, with no duplicates after reopen/retry', async () => {
      const directory = mkdtempSync(join(tmpdir(), 'transactions-concurrency-'));
      const filename = join(directory, 'recovery.sqlite');
      let fileDb = createTestDatabase(filename);
      try {
        await fileDb.execAsync(schema);
        const entered = barrier();
        const resume = barrier();
        const interrupted = withSQLiteTransaction(adapter(fileDb, platform).root, async (tx) => {
          await tx.runAsync("INSERT INTO writes VALUES ('intent', 1)");
          await setAppMetaText(tx, appMetaKeys.backupDirty, '1');
          entered.release();
          await resume.reached;
          throw new Error('injected interruption before commit');
        }).catch((error: unknown) => error);
        await entered.reached;
        resume.release();
        expect(await interrupted).toEqual(new Error('injected interruption before commit'));
        await fileDb.closeAsync();
        fileDb = createTestDatabase(filename);
        expect(await fileDb.getAllAsync('SELECT * FROM writes')).toEqual([]);
        expect(await fileDb.getAllAsync('SELECT * FROM app_meta')).toEqual([]);
        const recovered = adapter(fileDb, platform).root;
        async function retry() {
          await withSQLiteTransaction(recovered, async (tx) => {
            const existing = await tx.getFirstAsync("SELECT id FROM writes WHERE id='intent'");
            if (existing) return;
            await tx.runAsync("INSERT INTO writes VALUES ('intent', 1)");
            await setAppMetaText(tx, appMetaKeys.backupDirty, '1');
          });
        }
        await Promise.all([retry(), retry()]);
        expect(await fileDb.getAllAsync('SELECT * FROM writes')).toEqual([
          { id: 'intent', value: 1 },
        ]);
        expect(await getAppMetaText(recovered, appMetaKeys.backupDirty)).toBe('1');
      } finally {
        await fileDb.closeAsync();
        rmSync(directory, { recursive: true });
      }
    });
  },
);
