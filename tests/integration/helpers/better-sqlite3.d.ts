/**
 * Minimal local type declaration for `better-sqlite3`.
 *
 * `better-sqlite3` ships no bundled TypeScript types and the integration
 * harness is intentionally constrained to a single new devDependency (D12),
 * so the handful of driver methods the adapter (`tests/integration/helpers/db.ts`)
 * relies on are declared here instead of pulling in `@types/better-sqlite3`.
 *
 * Only the surface used by the adapter is covered; the full driver API is
 * richer, but that is out of scope for this test-only declaration.
 */
declare module 'better-sqlite3' {
  type BindValues = unknown[] | readonly unknown[];

  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement {
    run(...params: BindValues): RunResult;
    all(...params: BindValues): Record<string, unknown>[];
    get(...params: BindValues): Record<string, unknown> | undefined;
  }

  interface Options {
    /**
     * When true, the database is opened read-only (default false).
     */
    readonly?: boolean;
    /**
     * Busy timeout in milliseconds before OPEN/UPGRADE/CLOSE operations
     * throw SQLITE_BUSY (default 5000 in better-sqlite3). Mirrors the
     * option the adapter constructor passes.
     */
    timeout?: number;
  }

  class Database {
    constructor(filename: string | Buffer, options?: Options);
    exec(source: string): this;
    prepare(source: string): Statement;
    transaction<F extends (...args: never[]) => unknown>(fn: F): F;
    close(): void;
  }

  export = Database;
}
