import Database from 'better-sqlite3';
import { vi } from 'vitest';

/**
 * Real-SQLite integration harness backing `tests/integration/**`.
 *
 * The default Vitest project stubs `expo-sqlite` with an object that returns
 * no rows (`tests/setup.ts`), which erases every SQL behaviour the app's data
 * layer depends on. This helper instead exposes `core/db/client.ts`'s real
 * bootstrap DDL + `runMigrations()` verbatim against an in-process
 * better-sqlite3 database, so SQL-level facts (constraints, upserts, soft
 * deletes, transaction rollback) are asserted against the real engine.
 *
 * ## Wiring
 *
 * `tests/integration/setup.ts` mocks `expo-sqlite` so `openDatabaseAsync()`
 * returns `createTestDatabase()` — a fresh real database per call. The rest
 * of the integration tests then call the app's data layers unmodified.
 *
 * `core/db/client.ts` caches a module-level `dbPromise`, so a test that needs
 * a fresh database must reset that cache and re-import the module graph.
 * `freshDatabase()` does exactly that: `vi.resetModules()` followed by a
 * dynamic re-import of `@/core/db/client`, returning the bootstrapped DB.
 *
 * ## Usage pattern (one fresh database per test)
 *
 * ```ts
 * let db: TestDatabase;
 * beforeEach(async () => {
 *   db = await freshDatabase();
 * });
 *
 * it('...', async () => {
 *   // Data-layer modules must also be imported AFTER the reset (a static
 *   // top-level import would hold the previous test's module instance):
 *   const { addTodo, listTodos } = await import('@/features/todos/todos.data');
 *   await addTodo({ title: 'x' });
 *   expect(await listTodos()).toHaveLength(1);
 * });
 * ```
 */

/**
 * One in-process SQLite database presenting the async surface the app's data
 * layers consume (`execAsync` / `runAsync` / `getAllAsync` / `getFirstAsync`
 * / `withTransactionAsync` / `closeAsync`), with the raw better-sqlite3
 * handle available for row-level assertions.
 */
export interface TestDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ lastInsertRowId: number | bigint; changes: number }>;
  getAllAsync<T = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  getFirstAsync<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
  /** Raw better-sqlite3 handle for assertions beyond the async surface. */
  readonly raw: Database;
}

class SqliteTestDatabase implements TestDatabase {
  readonly raw: Database;
  private readonly filename: string;

  constructor(filenameOrMemory: string) {
    this.filename = filenameOrMemory;
    this.raw = new Database(filenameOrMemory === ':memory:' ? ':memory:' : filenameOrMemory, {
      // Keep the file-backed build (used by the migration rerun test) hermetic.
      timeout: 5000,
    });
  }

  async execAsync(sql: string): Promise<void> {
    this.raw.exec(sql);
  }

  async runAsync(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ lastInsertRowId: number | bigint; changes: number }> {
    const allParams = params ?? [];
    const result = this.raw.prepare(sql).run(...allParams);
    return { lastInsertRowId: result.lastInsertRowid, changes: result.changes };
  }

  async getAllAsync<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]> {
    const allParams = params ?? [];
    const rows = this.raw
      .prepare(sql)
      .all(...allParams)
      .map((row) => this.normalizeRow(row));
    return rows as T[];
  }

  async getFirstAsync<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T | null> {
    const allParams = params ?? [];
    const row = this.raw.prepare(sql).get(...allParams);
    if (row === undefined) return null;
    return this.normalizeRow(row) as T;
  }

  /**
   * Better-sqlite3 does not support async transaction functions (it throws
   * "Transaction function cannot return a promise"), so transactions are
   * driven with explicit BEGIN/COMMIT/ROLLBACK. The production transaction
   * helper serializes callers per database connection, matching SQLite's
   * single-writer behavior without allowing nested BEGIN statements.
   */
  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.raw.exec('BEGIN');
    try {
      await task();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }

  async closeAsync(): Promise<void> {
    // Windows can keep WAL/SHM handles alive long enough for the migration
    // tests' temporary-directory cleanup to observe EBUSY. Checkpoint and
    // switch file-backed fixtures back to the rollback journal before closing
    // so the test harness releases every sidecar deterministically.
    if (this.filename !== ':memory:') {
      this.raw.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE;');
    }
    this.raw.close();
  }

  /**
   * Better-sqlite3 returns BIGINT columns as `number | bigint`; expo-sqlite
   * returns plain numbers. The app's data layer only reads counts/booleans by
   * numeric equality or truthiness, so coerce bigint → number to keep the
   * integration rows shape-identical to what the real driver yields.
   */
  private normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    let needsCoercion = false;
    for (const value of Object.values(row)) {
      if (typeof value === 'bigint') {
        needsCoercion = true;
        break;
      }
    }
    if (!needsCoercion) return row;
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    return normalized;
  }
}

/**
 * Creates a fresh in-process database (no bootstrap, no migrations — that is
 * `core/db/client.ts`'s job). Every call returns an independent database, so
 * tests cannot share state by accident.
 *
 * Pass an optional absolute file path to create a persistent database (used
 * by the migration-rerun test to simulate an app restart over the same file).
 */
export function createTestDatabase(filename?: string): TestDatabase {
  return new SqliteTestDatabase(filename ?? ':memory:');
}

/**
 * Resets the Vitest module registry so the next imports of the app's modules
 * (data layers, `core/db/client.ts`, fixtures) are fresh. Used by
 * `freshDatabase()` and by the fixture seeders.
 */
export function resetTestModules(): void {
  vi.resetModules();
}

/**
 * Fresh, fully-migrated database for one test.
 *
 * Resets the module registry — clearing `core/db/client.ts`'s cached
 * `dbPromise` — then re-imports the client and runs the real bootstrap DDL +
 * `runMigrations()` (through the current schema version) against a new
 * in-process database.
 *
 * Data-layer modules must be dynamically imported AFTER calling this (see
 * the header comment); `freshDatabase` itself does not import them.
 */
export async function freshDatabase(filename?: string): Promise<TestDatabase> {
  resetTestModules();
  if (filename) {
    vi.doMock('expo-sqlite', () => ({
      openDatabaseAsync: vi.fn(() => createTestDatabase(filename)),
    }));
  } else {
    vi.doMock('expo-sqlite', () => ({
      openDatabaseAsync: vi.fn(() => createTestDatabase()),
    }));
  }
  const { getDatabase } = await import('@/core/db/client');
  return (await getDatabase()) as unknown as TestDatabase;
}
