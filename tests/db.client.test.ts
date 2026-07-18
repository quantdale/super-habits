import { describe, expect, it, vi } from 'vitest';

type MockDatabase = {
  execAsync: ReturnType<typeof vi.fn>;
  runAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  closeAsync: ReturnType<typeof vi.fn>;
  withTransactionAsync: ReturnType<typeof vi.fn>;
};

type LoadClientOptions = {
  platform?: 'ios' | 'web';
  schemaVersion?: string | null;
  openDatabaseAsync?: ReturnType<typeof vi.fn>;
};

function buildDb(version: string | null = '11'): MockDatabase {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue(undefined),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(version ? { value: version } : null),
    closeAsync: vi.fn().mockResolvedValue(undefined),
    // Pass-through that awaits the callback so rejections propagate exactly
    // like a rolled-back real transaction would (abort-on-failure paths in
    // runMigrations must not be stubbed into a no-op).
    withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  };
}

async function loadDbClient(options: LoadClientOptions = {}) {
  vi.resetModules();
  const platform = options.platform ?? 'ios';
  const schemaVersion = options.schemaVersion === undefined ? '11' : options.schemaVersion;
  const db = buildDb(schemaVersion);
  const openDatabaseAsync = options.openDatabaseAsync ?? vi.fn().mockResolvedValue(db);

  vi.doMock('react-native', () => ({
    Platform: {
      OS: platform,
      select: (obj: Record<string, unknown>) => obj[platform] ?? obj.default,
    },
  }));

  vi.doMock('expo-sqlite', () => ({
    openDatabaseAsync,
  }));

  const client = await import('@/core/db/client');
  return { client, db, openDatabaseAsync };
}

describe('core/db/client', () => {
  it('returns the same database instance for repeated getDatabase calls', async () => {
    const { client, openDatabaseAsync } = await loadDbClient();

    const [a, b] = await Promise.all([client.getDatabase(), client.getDatabase()]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('initializeDatabase delegates to getDatabase bootstrap', async () => {
    const { client, openDatabaseAsync } = await loadDbClient();

    await client.initializeDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it('resets cached promise after openDatabaseAsync fails so next call can retry', async () => {
    vi.resetModules();
    const db = buildDb('9');
    const openDatabaseAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error('open failed'))
      .mockResolvedValueOnce(db);

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
        select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
      },
    }));

    vi.doMock('expo-sqlite', () => ({
      openDatabaseAsync,
    }));

    const client = await import('@/core/db/client');
    await expect(client.getDatabase()).rejects.toThrow('open failed');
    await expect(client.getDatabase()).resolves.toBe(db);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('enables WAL on native platforms', async () => {
    const { client, db } = await loadDbClient({ platform: 'ios' });

    await client.getDatabase();

    expect(db.execAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
  });

  it('skips WAL pragma on web', async () => {
    const { client, db } = await loadDbClient({ platform: 'web' });

    await client.getDatabase();

    const allSql = db.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(allSql.some((sql) => sql.includes('PRAGMA journal_mode = WAL;'))).toBe(false);
  });

  it('runs soft-delete-safe todo ordering SQL in migration 6', async () => {
    const { client, db } = await loadDbClient({ schemaVersion: '5' });

    await client.getDatabase();

    const sqlCalls = db.runAsync.mock.calls.map(([sql]) => String(sql));
    const sortOrderMigration = sqlCalls.find((sql) =>
      sql.includes('UPDATE todos SET sort_order = ('),
    );

    expect(sortOrderMigration).toBeDefined();
    expect(sortOrderMigration).toContain('t2.deleted_at IS NULL');
    expect(sortOrderMigration).toContain(') WHERE deleted_at IS NULL');
  });

  it('records date key cutover metadata during migration 5', async () => {
    const { client, db } = await loadDbClient({ schemaVersion: '4' });

    await client.getDatabase();

    const dateFormatCall = db.runAsync.mock.calls.find(
      ([sql, args]) =>
        String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
        Array.isArray(args) &&
        args[0] === 'date_key_format' &&
        args[1] === 'local',
    );
    const cutoverCall = db.runAsync.mock.calls.find(
      ([sql, args]) =>
        String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
        Array.isArray(args) &&
        args[0] === 'date_key_cutover',
    );

    expect(dateFormatCall).toBeDefined();
    expect(cutoverCall).toBeDefined();
    expect(cutoverCall?.[1]).toEqual(['date_key_cutover', expect.any(String)]);
  });

  it('applies migrations from version 0 and bumps to schema version 11', async () => {
    const { client, db } = await loadDbClient({ schemaVersion: null });

    await client.getDatabase();

    const hasSchemaV10Write = db.runAsync.mock.calls.some(
      ([sql, args]) =>
        String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
        Array.isArray(args) &&
        args[0] === 'db_schema_version' &&
        args[1] === '11',
    );
    expect(hasSchemaV10Write).toBe(true);
  });

  it('adds linked action execution storage in migration 11', async () => {
    const { client, db } = await loadDbClient({ schemaVersion: '10' });

    await client.getDatabase();

    const sqlCalls = db.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(
      sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS linked_action_events')),
    ).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('idx_linked_action_rules_source_lookup'))).toBe(
      false,
    );
    expect(
      sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS linked_action_executions')),
    ).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes('idx_linked_action_executions_chain_guard'))).toBe(
      true,
    );
    expect(
      db.runAsync.mock.calls.some(
        ([sql, args]) =>
          String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
          Array.isArray(args) &&
          args[0] === 'db_schema_version' &&
          args[1] === '11',
      ),
    ).toBe(true);
  });

  it('does not rerun linked action execution migration when database is already at v11', async () => {
    const { client, db } = await loadDbClient({ schemaVersion: '11' });

    await client.getDatabase();

    const sqlCalls = db.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(
      sqlCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS linked_action_events')),
    ).toBe(false);
  });

  it('wraps each pending migration in a transaction and none when up to date', async () => {
    const pending = await loadDbClient({ schemaVersion: '9' });
    await pending.client.getDatabase();
    // v10 and v11 are outstanding -> one transaction per version block.
    expect(pending.db.withTransactionAsync).toHaveBeenCalledTimes(2);

    const upToDate = await loadDbClient({ schemaVersion: '11' });
    await upToDate.client.getDatabase();
    expect(upToDate.db.withTransactionAsync).not.toHaveBeenCalled();
  });

  it('aborts bootstrap and does not bump the schema version when a migration statement fails', async () => {
    vi.resetModules();
    const db = buildDb('8');
    db.runAsync.mockImplementation(async (sql: string) => {
      if (String(sql).includes('ADD COLUMN recurrence')) {
        throw new Error('disk I/O error');
      }
      return undefined;
    });
    const openDatabaseAsync = vi.fn().mockResolvedValue(db);

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
        select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
      },
    }));
    vi.doMock('expo-sqlite', () => ({ openDatabaseAsync }));

    const client = await import('@/core/db/client');
    await expect(client.getDatabase()).rejects.toThrow('disk I/O error');

    const versionBump = db.runAsync.mock.calls.find(
      ([sql, args]) =>
        String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
        Array.isArray(args) &&
        args[0] === 'db_schema_version' &&
        args[1] === '9',
    );
    expect(versionBump).toBeUndefined();
  });

  it('skips ALTER when the column already exists instead of swallowing errors', async () => {
    vi.resetModules();
    const db = buildDb('8');
    db.getAllAsync.mockImplementation(async (sql: string) => {
      if (String(sql).includes('PRAGMA table_info(todos)')) {
        return [{ name: 'recurrence' }, { name: 'recurrence_id' }];
      }
      return [];
    });
    const openDatabaseAsync = vi.fn().mockResolvedValue(db);

    vi.doMock('react-native', () => ({
      Platform: {
        OS: 'ios',
        select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
      },
    }));
    vi.doMock('expo-sqlite', () => ({ openDatabaseAsync }));

    const client = await import('@/core/db/client');
    await client.getDatabase();

    const alterCalls = db.runAsync.mock.calls.filter(([sql]) =>
      String(sql).includes('ALTER TABLE todos ADD COLUMN recurrence'),
    );
    expect(alterCalls).toHaveLength(0);

    const versionBump = db.runAsync.mock.calls.find(
      ([sql, args]) =>
        String(sql).includes('INSERT OR REPLACE INTO app_meta') &&
        Array.isArray(args) &&
        args[0] === 'db_schema_version' &&
        args[1] === '9',
    );
    expect(versionBump).toBeDefined();
  });
});
