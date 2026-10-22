import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';

const transactionTails = new WeakMap<object, Promise<void>>();

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
 * SQLite integration harness.
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
  if (typeof db.withTransactionAsync !== 'function') {
    throw new SQLiteTransactionUnavailableError();
  }

  const key = db as unknown as object;
  const previous = transactionTails.get(key) ?? Promise.resolve();
  let result!: T;
  const current = previous.then(async () => {
    if (Platform.OS !== 'web' && typeof db.withExclusiveTransactionAsync === 'function') {
      await db.withExclusiveTransactionAsync(async (transactionDb) => {
        result = await task(transactionDb);
      });
      return;
    }

    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
  });
  transactionTails.set(
    key,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  await current;
  return result;
}
