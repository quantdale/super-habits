import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';

const transactionTails = new WeakMap<object, Promise<void>>();

/**
 * Run a SQLite unit of work on one transaction connection.
 *
 * Native Expo SQLite has an exclusive transaction API; it is important for
 * read/modify/write boundaries because ordinary async queries can interleave
 * with another writer. Web SQLite does not expose that API, so the regular
 * transaction is the portable fallback used by the web build and the real
 * SQLite integration harness.
 */
export async function withSQLiteTransaction<T>(
  db: SQLite.SQLiteDatabase,
  task: (transactionDb: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  // Lightweight unit-test doubles may expose only the query methods. Real
  // Expo SQLite and the integration harness both provide withTransactionAsync;
  // this fallback keeps pure data-layer contract tests focused on SQL calls.
  if (typeof db.withTransactionAsync !== 'function') {
    return task(db);
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
