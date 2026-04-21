import { beforeEach, describe, expect, it, vi } from "vitest";

type RemoteRowsByEntity = Partial<Record<string, Array<Record<string, unknown>>>>;
type RemoteErrorByEntity = Partial<
  Record<string, { countError?: string; latestError?: string; rowsError?: string }>
>;

function buildSupabaseMock(
  remoteRowsByEntity: RemoteRowsByEntity,
  remoteErrorsByEntity: RemoteErrorByEntity = {},
) {
  return {
    from: vi.fn((entity: string) => {
      const rows = remoteRowsByEntity[entity] ?? [];
      const entityErrors = remoteErrorsByEntity[entity] ?? {};

      return {
        select: vi.fn((columns: string, options?: { head?: boolean }) => {
          const state = {
            onlyActiveRows: false,
          };
          const getRowsForQuery = () =>
            state.onlyActiveRows
              ? rows.filter((row) => row.deleted_at == null)
              : rows;

          if (options?.head) {
            return {
              is: vi.fn(() => {
                state.onlyActiveRows = true;
                if (entityErrors.countError) {
                  return Promise.resolve({
                    data: null,
                    count: null,
                    error: { message: entityErrors.countError },
                  });
                }
                return Promise.resolve({
                  data: null,
                  count: getRowsForQuery().length,
                  error: null,
                });
              }),
            };
          }

          const query = {
            is: vi.fn(() => {
              state.onlyActiveRows = true;
              return query;
            }),
            order: vi.fn(() => query),
            limit: vi.fn(() => {
              if (entityErrors.latestError) {
                return Promise.resolve({
                  data: null,
                  error: { message: entityErrors.latestError },
                });
              }

              const latest = [...getRowsForQuery()]
                .sort((a, b) =>
                  String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
                )[0] ?? null;

              return Promise.resolve({
                data: latest ? [{ updated_at: latest.updated_at ?? null }] : [],
                error: null,
              });
            }),
            range: vi.fn((from: number, to: number) => {
              if (entityErrors.rowsError) {
                return Promise.resolve({
                  data: null,
                  error: { message: entityErrors.rowsError },
                });
              }

              return Promise.resolve({
                data: getRowsForQuery().slice(from, to + 1),
                error: null,
              });
            }),
          };

          return query;
        }),
      };
    }),
  };
}

function buildDb(localCounts: Record<string, number>, initialMeta: Record<string, string> = {}) {
  const meta = { ...initialMeta };
  const committedWrites: Array<{ sql: string; params: unknown[] }> = [];
  let activeBuffer: Array<{ sql: string; params: unknown[] }> | null = null;
  let activeMetaBuffer: Record<string, string> | null = null;

  return {
    getFirstAsync: vi.fn(async (sql: string, params?: unknown[]) => {
      const countMatch = sql.match(
        /^SELECT COUNT\(\*\) AS total FROM ([a-z_]+) WHERE deleted_at IS NULL$/i,
      );
      if (countMatch) {
        const entity = countMatch[1] ?? "";
        return { total: localCounts[entity] ?? 0 };
      }

      if (sql === "SELECT value FROM app_meta WHERE key = ?") {
        const key = String(params?.[0] ?? "");
        if (activeMetaBuffer && key in activeMetaBuffer) {
          return { value: activeMetaBuffer[key] };
        }
        return key in meta ? { value: meta[key] } : null;
      }

      return null;
    }),
    runAsync: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (
        sql === "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)" &&
        activeMetaBuffer
      ) {
        activeMetaBuffer[String(params[0])] = String(params[1]);
      } else if (sql === "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)") {
        meta[String(params[0])] = String(params[1]);
      }

      if (activeBuffer) {
        activeBuffer.push({ sql, params });
      } else {
        committedWrites.push({ sql, params });
      }

      return undefined;
    }),
    withTransactionAsync: vi.fn(async (task: () => Promise<void>) => {
      activeBuffer = [];
      activeMetaBuffer = {};
      try {
        await task();
        committedWrites.push(...activeBuffer);
        Object.assign(meta, activeMetaBuffer);
      } finally {
        activeBuffer = null;
        activeMetaBuffer = null;
      }
    }),
    getCommittedWrites: () => committedWrites,
    getMeta: () => ({ ...meta }),
  };
}

async function loadCoordinator(options: {
  localCounts: Record<string, number>;
  remoteRowsByEntity: RemoteRowsByEntity;
  remoteErrorsByEntity?: RemoteErrorByEntity;
  initialMeta?: Record<string, string>;
  applyFailure?: { entity: "todos" | "habits" | "calorie_entries"; sql?: string };
  remoteEnabled?: boolean;
}) {
  vi.resetModules();

  const db = buildDb(options.localCounts, options.initialMeta);
  const supabaseMock = buildSupabaseMock(
    options.remoteRowsByEntity,
    options.remoteErrorsByEntity,
  );
  const applyRemoteTodos = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === "todos") {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ["todo_failure"]);
      }
      throw new Error("todo restore failed");
    }
    return rows;
  });
  const applyRemoteHabits = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === "habits") {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ["habit_failure"]);
      }
      throw new Error("habit restore failed");
    }
    return rows;
  });
  const applyRemoteCalorieEntries = vi.fn(async (database, rows) => {
    if (options.applyFailure?.entity === "calorie_entries") {
      if (options.applyFailure.sql) {
        await database.runAsync(options.applyFailure.sql, ["cal_failure"]);
      }
      throw new Error("calorie restore failed");
    }
    return rows;
  });

  vi.doMock("@/core/db/client", () => ({
    getDatabase: vi.fn().mockResolvedValue(db),
  }));
  vi.doMock("@/lib/time", () => ({
    nowIso: vi.fn(() => "2026-04-21T12:00:00.000Z"),
  }));
  vi.doMock("@/lib/supabase", () => ({
    supabase: supabaseMock,
    isRemoteEnabled: vi.fn(() => options.remoteEnabled ?? true),
  }));
  vi.doMock("@/features/todos/todos.data", () => ({
    applyRemoteTodos,
  }));
  vi.doMock("@/features/habits/habits.data", () => ({
    applyRemoteHabits,
  }));
  vi.doMock("@/features/calories/calories.data", () => ({
    applyRemoteCalorieEntries,
  }));

  const coordinator = await import("@/core/sync/restore.coordinator");
  return {
    db,
    supabaseMock,
    applyRemoteTodos,
    applyRemoteHabits,
    applyRemoteCalorieEntries,
    ...coordinator,
  };
}

describe("core/sync/restore.coordinator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the device as empty-device eligible only when all sync-backed tables are empty", async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility.kind).toBe("empty_device");
    expect(preview.remoteAvailable).toBe(true);
    expect(preview.startupPromptEligible).toBe(true);
  });

  it("blocks restore when active rows exist in sync-backed local tables", async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 1,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility).toMatchObject({
      kind: "blocked",
      reason: "local_data_present",
    });
    expect(preview.startupPromptEligible).toBe(false);
  });

  it("keeps empty-device eligibility when local synced tables have only tombstones", async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: null,
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.eligibility.kind).toBe("empty_device");
  });

  it("returns workout restore as excluded in phase one with a concrete reason", async () => {
    const { getRestorePreview } = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        workout_routines: [
          {
            id: "wrk_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });

    const preview = await getRestorePreview();

    expect(preview.entityStatuses.workout_routines).toMatchObject({
      phaseOneStatus: "excluded_in_phase_one",
      reason:
        "Workout routines are excluded in this phase because nested routine structure is not synced yet.",
    });
    expect(preview.warnings).toContain(
      "Workout routines are excluded in this phase because nested routine structure is not synced yet.",
    );
  });

  it("returns an unavailable restore preview when remote mode is disabled", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: null,
          },
        ],
      },
      remoteEnabled: false,
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(false);
    expect(preview.eligibility).toMatchObject({
      kind: "blocked",
      reason: "remote_disabled",
    });
    expect(preview.entityStatuses.todos.remoteState).toBe("unavailable");
    expect(loaded.supabaseMock.from).not.toHaveBeenCalled();
  });

  it("does not treat tombstone-only remote rows as restorable backup", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: "2026-04-20T13:00:00.000Z",
          },
        ],
      },
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(false);
    expect(preview.entityStatuses.todos.remoteState).toBe("empty");
    expect(preview.eligibility).toMatchObject({
      kind: "blocked",
      reason: "remote_backup_unavailable",
    });
  });

  it("treats mixed active and deleted remote rows as restorable backup", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: "2026-04-20T13:00:00.000Z",
          },
          {
            id: "todo_2",
            updated_at: "2026-04-21T12:00:00.000Z",
            created_at: "2026-04-21T10:00:00.000Z",
            deleted_at: null,
          },
        ],
      },
    });

    const preview = await loaded.getRestorePreview();

    expect(preview.remoteAvailable).toBe(true);
    expect(preview.entityStatuses.todos).toMatchObject({
      remoteState: "available",
      remoteRowCount: 1,
    });
    expect(preview.eligibility.kind).toBe("empty_device");
  });

  it("changes the freshness signature when remote backup metadata changes", async () => {
    const first = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });
    const second = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-21T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
          {
            id: "todo_2",
            updated_at: "2026-04-21T12:30:00.000Z",
            created_at: "2026-04-20T12:00:00.000Z",
          },
        ],
      },
    });

    const firstPreview = await first.getRestorePreview();
    const secondPreview = await second.getRestorePreview();

    expect(firstPreview.freshnessSignature).not.toBe(secondPreview.freshnessSignature);
  });

  it("dismisses only the matching current backup freshness signature", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });

    const firstPreview = await loaded.getRestorePreview();
    await loaded.dismissCurrentRestorePrompt(firstPreview.freshnessSignature);
    const dismissedPreview = await loaded.getRestorePreview();

    expect(dismissedPreview.dismissedForCurrentBackup).toBe(true);
    expect(dismissedPreview.startupPromptEligible).toBe(false);

    const changed = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-22T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
      initialMeta: loaded.db.getMeta(),
    });

    const changedPreview = await changed.getRestorePreview();
    expect(changedPreview.dismissedForCurrentBackup).toBe(false);
    expect(changedPreview.startupPromptEligible).toBe(true);
  });

  it("blocks restore execution on non-empty devices without importing rows", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 2,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result.status).toBe("blocked");
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
  });

  it("blocks restore execution when remote mode is disabled", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: null,
          },
        ],
      },
      remoteEnabled: false,
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result).toMatchObject({
      status: "blocked",
      preview: {
        eligibility: {
          kind: "blocked",
          reason: "remote_disabled",
        },
      },
    });
    expect(loaded.applyRemoteTodos).not.toHaveBeenCalled();
    expect(loaded.applyRemoteHabits).not.toHaveBeenCalled();
    expect(loaded.applyRemoteCalorieEntries).not.toHaveBeenCalled();
  });

  it("imports only todos, habits, and calorie entries during restore", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            title: "Ship restore",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
            deleted_at: null,
          },
          {
            id: "todo_2",
            title: "Deleted todo",
            updated_at: "2026-04-20T13:00:00.000Z",
            created_at: "2026-04-19T13:00:00.000Z",
            deleted_at: "2026-04-20T14:00:00.000Z",
          },
        ],
        habits: [
          {
            id: "habit_1",
            name: "Hydrate",
            updated_at: "2026-04-18T12:00:00.000Z",
            created_at: "2026-04-17T12:00:00.000Z",
            deleted_at: null,
          },
        ],
        calorie_entries: [
          {
            id: "cal_1",
            food_name: "Oats",
            updated_at: "2026-04-16T12:00:00.000Z",
            created_at: "2026-04-15T12:00:00.000Z",
            deleted_at: null,
          },
        ],
        workout_routines: [
          {
            id: "wrk_1",
            name: "Push day",
            updated_at: "2026-04-14T12:00:00.000Z",
            created_at: "2026-04-13T12:00:00.000Z",
          },
        ],
      },
    });

    const result = await loaded.restoreFromRemoteBackup();

    expect(result).toMatchObject({
      status: "restored",
      importedCounts: {
        todos: 2,
        habits: 1,
        calorie_entries: 1,
      },
    });
    expect(loaded.applyRemoteTodos).toHaveBeenCalledTimes(1);
    expect(loaded.applyRemoteHabits).toHaveBeenCalledTimes(1);
    expect(loaded.applyRemoteCalorieEntries).toHaveBeenCalledTimes(1);
    const metaWrites = loaded.db
      .getCommittedWrites()
      .filter((entry) => entry.sql === "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)");
    expect(metaWrites).toHaveLength(2);
  });

  it("uses a transaction so failed restore writes do not commit partial local changes", async () => {
    const loaded = await loadCoordinator({
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
      remoteRowsByEntity: {
        todos: [
          {
            id: "todo_1",
            updated_at: "2026-04-20T12:00:00.000Z",
            created_at: "2026-04-19T12:00:00.000Z",
          },
        ],
      },
      applyFailure: {
        entity: "todos",
        sql: "INSERT INTO todos VALUES (?)",
      },
    });

    await expect(loaded.restoreFromRemoteBackup()).rejects.toThrow("todo restore failed");

    expect(loaded.db.getCommittedWrites()).toEqual([]);
    expect(loaded.db.getMeta()).not.toHaveProperty("last_restore_at");
    expect(loaded.db.getMeta()).not.toHaveProperty("last_restore_signature");
  });
});
