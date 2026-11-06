import type * as SQLite from 'expo-sqlite';

const writerTails = new WeakMap<SQLite.SQLiteDatabase, Promise<void>>();
const transactionScopes = new WeakMap<SQLite.SQLiteDatabase, { active: boolean }>();

function assertActiveScope(scope: { active: boolean }): void {
  if (!scope.active) throw new Error('SQLite transaction capability has expired.');
}

/** FIFO for participating writers only; raw adapter calls do not acquire this gate. */
export function withSQLiteWriter<T>(db: SQLite.SQLiteDatabase, task: () => Promise<T>): Promise<T> {
  const scope = transactionScopes.get(db);
  if (scope) {
    assertActiveScope(scope);
    return task();
  }
  const previous = writerTails.get(db) ?? Promise.resolve();
  const current = previous.then(task);
  // A rejected writer must not poison subsequent work or create an unhandled tail.
  writerTails.set(
    db,
    current.then(
      () => undefined,
      () => undefined,
    ),
  );
  return current;
}

export function assertSQLiteTransactionRoot(db: SQLite.SQLiteDatabase): void {
  const scope = transactionScopes.get(db);
  if (!scope) return;
  assertActiveScope(scope);
  throw new Error('Nested SQLite transactions are not supported; use the caller transaction.');
}

/**
 * A distinct capability, even on web where the adapter reuses its base handle.
 * Metadata helpers can join this transaction without mistaking an unrelated
 * writer on the base handle for nested work. Always use this callback handle,
 * never a captured base handle, and await every operation before returning.
 */
export async function withSQLiteTransactionScope<T>(
  db: SQLite.SQLiteDatabase,
  task: (transactionDb: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const scope = { active: true };
  const capability = new Proxy({} as SQLite.SQLiteDatabase, {
    get(_target, property) {
      assertActiveScope(scope);
      if (
        property === 'withTransactionAsync' ||
        property === 'withExclusiveTransactionAsync' ||
        property === 'withTransactionSync' ||
        property === 'closeAsync' ||
        property === 'closeSync'
      ) {
        return () => {
          assertActiveScope(scope);
          throw new Error('Transaction lifecycle belongs to withSQLiteTransaction.');
        };
      }
      const value: unknown = Reflect.get(db, property, db);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        assertActiveScope(scope);
        const result: unknown = value.apply(db, args);
        return result;
      };
    },
  });
  transactionScopes.set(capability, scope);
  try {
    return await task(capability);
  } finally {
    scope.active = false;
  }
}
