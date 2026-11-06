import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';
import { rethrowDurableWriteError } from '@/core/storage/storageSafety';

import {
  assertSQLiteTransactionRoot,
  withSQLiteTransactionScope,
  withSQLiteWriter,
} from '@/core/db/sqliteWriter';

/**
 * Raised when an adapter cannot run real transactions. Fail-closed on purpose:
 * every production caller of `withSQLiteTransaction` depends on atomicity
 * (multi-row writes, migration blocks, backup checkpoints, outbox intents),
 * and a silent non-transactional fallback would let a partial write survive a
 * failure while looking successful.
 */
export class SQLiteTransactionUnavailableError extends Error {
  constructor() {
    super(
      'withSQLiteTransaction: the database adapter does not implement withTransactionAsync. ' +
        'Refusing to execute non-transactionally because callers depend on atomicity. ' +
        'Production adapters (Expo SQLite native + web, the integration harness) all ' +
        'implement withTransactionAsync; a test double must implement it too.',
    );
    this.name = 'SQLiteTransactionUnavailableError';
  }
}

/**
 * Run a SQLite unit of work on one transaction connection.
 *
 * Native Expo SQLite has an exclusive transaction API; it is important for
 * read/modify/write boundaries because ordinary async queries can interleave
 * with another writer. Web SQLite does not expose that API, so the regular
 * transaction is the portable fallback used by the web build and the real
 * SQLite integration harness. The callback receives a scoped, method-bound
 * capability: pass it to dependent helpers and await their work. Do not use a
 * captured base handle inside the callback (queued metadata would wait on its
 * own transaction), retain the capability after return, or start nested
 * transactions. Standalone app_meta writes share this FIFO; raw SQL does not.
 *
 * CORR-A-04: the old `return task(db)` fallback for adapters without
 * `withTransactionAsync` was reachable only by unit-test doubles, but it was a
 * silent atomicity downgrade for any real adapter that ever lost the API. The
 * compatibility seam now lives in the doubles (they implement
 * `withTransactionAsync`), not in production behavior: an adapter without the
 * API fails closed.
 */
export async function withSQLiteTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (transactionDb: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  assertSQLiteTransactionRoot(db);
  if (typeof db.withTransactionAsync !== 'function') {
    throw new SQLiteTransactionUnavailableError();
  }

  try {
    return await withSQLiteWriter(db, async () => {
      let result!: T;
      if (Platform.OS !== 'web' && typeof db.withExclusiveTransactionAsync === 'function') {
        await db.withExclusiveTransactionAsync(async (transactionDb) => {
          result = await withSQLiteTransactionScope(transactionDb, task);
        });
      } else {
        await db.withTransactionAsync(async () => {
          result = await withSQLiteTransactionScope(db, task);
        });
      }
      return result;
    });
  } catch (error) {
    // Central durable-write failure classification (CORR-A-02): EVERY
    // transactional write (data-layer mutations, backup capture, portable
    // import/export, account ownership) funnels through this gate, so a
    // storage-caused rejection is classified once and surfaces as actionable
    // copy at any UI catch site that reads `error.message`. Non-storage errors
    // are rethrown UNWRAPPED — the exact original error.
    rethrowDurableWriteError(error, 'transactional write');
  }
}
