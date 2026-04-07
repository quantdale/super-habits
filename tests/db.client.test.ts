import { describe, expect, it, vi } from "vitest";

type MockDatabase = {
  execAsync: ReturnType<typeof vi.fn>;
  runAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  closeAsync: ReturnType<typeof vi.fn>;
};

type LoadClientOptions = {
  platform?: "ios" | "web";
  schemaVersion?: string | null;
  openDatabaseAsync?: ReturnType<typeof vi.fn>;
};

function buildDb(version: string | null = "9"): MockDatabase {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue(undefined),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(version ? { value: version } : null),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };
}

async function loadDbClient(options: LoadClientOptions = {}) {
  vi.resetModules();
  const platform = options.platform ?? "ios";
  const schemaVersion = options.schemaVersion === undefined ? "9" : options.schemaVersion;
  const db = buildDb(schemaVersion);
  const openDatabaseAsync = options.openDatabaseAsync ?? vi.fn().mockResolvedValue(db);

  vi.doMock("react-native", () => ({
    Platform: {
      OS: platform,
      select: (obj: Record<string, unknown>) => obj[platform] ?? obj.default,
    },
  }));

  vi.doMock("expo-sqlite", () => ({
    openDatabaseAsync,
  }));

  const client = await import("@/core/db/client");
  return { client, db, openDatabaseAsync };
}

describe("core/db/client", () => {
  it("returns the same database instance for repeated getDatabase calls", async () => {
    const { client, openDatabaseAsync } = await loadDbClient();

    const [a, b] = await Promise.all([client.getDatabase(), client.getDatabase()]);

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("initializeDatabase delegates to getDatabase bootstrap", async () => {
    const { client, openDatabaseAsync } = await loadDbClient();

    await client.initializeDatabase();

    expect(openDatabaseAsync).toHaveBeenCalledTimes(1);
  });

  it("resets cached promise after openDatabaseAsync fails so next call can retry", async () => {
    vi.resetModules();
    const db = buildDb("9");
    const openDatabaseAsync = vi
      .fn()
      .mockRejectedValueOnce(new Error("open failed"))
      .mockResolvedValueOnce(db);

    vi.doMock("react-native", () => ({
      Platform: {
        OS: "ios",
        select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
      },
    }));

    vi.doMock("expo-sqlite", () => ({
      openDatabaseAsync,
    }));

    const client = await import("@/core/db/client");
    await expect(client.getDatabase()).rejects.toThrow("open failed");
    await expect(client.getDatabase()).resolves.toBe(db);
    expect(openDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it("enables WAL on native platforms", async () => {
    const { client, db } = await loadDbClient({ platform: "ios" });

    await client.getDatabase();

    expect(db.execAsync).toHaveBeenCalledWith("PRAGMA journal_mode = WAL;");
  });

  it("skips WAL pragma on web", async () => {
    const { client, db } = await loadDbClient({ platform: "web" });

    await client.getDatabase();

    const allSql = db.execAsync.mock.calls.map(([sql]) => String(sql));
    expect(allSql.some((sql) => sql.includes("PRAGMA journal_mode = WAL;"))).toBe(false);
  });

  it("runs soft-delete-safe todo ordering SQL in migration 6", async () => {
    const { client, db } = await loadDbClient({ schemaVersion: "5" });

    await client.getDatabase();

    const sqlCalls = db.runAsync.mock.calls.map(([sql]) => String(sql));
    const sortOrderMigration = sqlCalls.find((sql) => sql.includes("UPDATE todos SET sort_order = ("));

    expect(sortOrderMigration).toBeDefined();
    expect(sortOrderMigration).toContain("t2.deleted_at IS NULL");
    expect(sortOrderMigration).toContain(") WHERE deleted_at IS NULL");
  });

  it("records date key cutover metadata during migration 5", async () => {
    const { client, db } = await loadDbClient({ schemaVersion: "4" });

    await client.getDatabase();

    const dateFormatCall = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes("('date_key_format', 'local')"),
    );
    const cutoverCall = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes("('date_key_cutover', ?)"),
    );

    expect(dateFormatCall).toBeDefined();
    expect(cutoverCall).toBeDefined();
    expect(cutoverCall?.[1]).toEqual([expect.any(String)]);
  });

  it("applies migrations from version 0 and bumps to schema version 9", async () => {
    const { client, db } = await loadDbClient({ schemaVersion: null });

    await client.getDatabase();

    const hasSchemaV9Write = db.runAsync.mock.calls.some(([sql]) =>
      String(sql).includes("('db_schema_version', '9')"),
    );
    expect(hasSchemaV9Write).toBe(true);
  });

  it("does not rerun recurrence migration when database is already at v9", async () => {
    const { client, db } = await loadDbClient({ schemaVersion: "9" });

    await client.getDatabase();

    const sqlCalls = db.runAsync.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.some((sql) => sql.includes("ADD COLUMN recurrence"))).toBe(false);
    expect(sqlCalls.some((sql) => sql.includes("ADD COLUMN recurrence_id"))).toBe(false);
  });
});
