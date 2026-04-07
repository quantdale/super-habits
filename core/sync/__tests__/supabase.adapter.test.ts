import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SyncRecord } from "@/core/sync/sync.engine";

type AdapterSetupOptions = {
  supabase?: { from: ReturnType<typeof vi.fn> } | null;
};

async function setupAdapter(options: AdapterSetupOptions) {
  vi.resetModules();

  const db = {
    getAllAsync: vi.fn(),
  };
  const getDatabase = vi.fn().mockResolvedValue(db);
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });

  vi.doMock("@/core/db/client", () => ({
    getDatabase,
  }));

  const supabase = options.supabase === undefined ? { from } : options.supabase;
  vi.doMock("@/lib/supabase", () => ({ supabase }));

  const { SupabaseSyncAdapter } = await import("@/core/sync/supabase.adapter");
  return {
    adapter: new SupabaseSyncAdapter(),
    db,
    getDatabase,
    from,
    upsert,
  };
}

function record(entity: string, id: string): SyncRecord {
  return {
    entity,
    id,
    updatedAt: "2026-04-07T12:00:00.000Z",
    operation: "update",
  };
}

describe("SupabaseSyncAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns early for an empty push batch", async () => {
    const { adapter, getDatabase } = await setupAdapter({});

    await adapter.push([]);

    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("returns early when supabase is unavailable", async () => {
    const { adapter, getDatabase } = await setupAdapter({
      supabase: null,
    });

    await adapter.push([record("todos", "todo_1")]);

    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("warns and skips unknown entities", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { adapter, db, from } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([]);

    await adapter.push([record("unknown_table", "row_1")]);

    expect(warnSpy).toHaveBeenCalledWith("[sync] skip unknown entity: unknown_table");
    expect(db.getAllAsync).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("deduplicates IDs per entity when building the SQL query", async () => {
    const { adapter, db } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([{ id: "todo_1" }, { id: "todo_2" }]);

    await adapter.push([
      record("todos", "todo_1"),
      record("todos", "todo_1"),
      record("todos", "todo_2"),
    ]);

    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, ids] = db.getAllAsync.mock.calls[0];
    expect(sql).toContain("SELECT * FROM todos WHERE id IN (?, ?)");
    expect(ids).toEqual(["todo_1", "todo_2"]);
  });

  it("calls upsert with selected rows and onConflict id", async () => {
    const { adapter, db, from, upsert } = await setupAdapter({});
    const rows = [{ id: "todo_1", title: "Ship tests" }];
    db.getAllAsync.mockResolvedValue(rows);

    await adapter.push([record("todos", "todo_1")]);

    expect(from).toHaveBeenCalledWith("todos");
    expect(upsert).toHaveBeenCalledWith(rows, { onConflict: "id" });
  });

  it("skips upsert when the local SELECT returns no rows", async () => {
    const { adapter, db, from } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([]);

    await adapter.push([record("todos", "todo_1")]);

    expect(from).not.toHaveBeenCalled();
  });

  it("logs Supabase upsert errors without throwing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const upsertError = new Error("timeout");
    const supabase = { from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: upsertError }) }) };
    const { adapter, db } = await setupAdapter({ supabase });
    db.getAllAsync.mockResolvedValue([{ id: "todo_1" }]);

    await expect(adapter.push([record("todos", "todo_1")])).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[sync] Supabase upsert failed for todos", upsertError);
  });

  it("handles thrown push errors (like network timeout) without crashing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const timeoutError = new Error("network timeout");
    const supabase = { from: vi.fn().mockReturnValue({ upsert: vi.fn().mockRejectedValue(timeoutError) }) };
    const { adapter, db } = await setupAdapter({ supabase });
    db.getAllAsync.mockResolvedValue([{ id: "habit_1" }]);

    await expect(adapter.push([record("habits", "habit_1")])).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[sync] push failed for habits", timeoutError);
  });

  it("handles database read failures without crashing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dbError = new Error("db read failed");
    const { adapter, db, from } = await setupAdapter({});
    db.getAllAsync.mockRejectedValue(dbError);

    await expect(adapter.push([record("todos", "todo_1")])).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[sync] push failed for todos", dbError);
    expect(from).not.toHaveBeenCalled();
  });

  it("processes each known entity in the same batch separately", async () => {
    const supabase = { from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) };
    const { adapter, db } = await setupAdapter({ supabase });
    db.getAllAsync
      .mockResolvedValueOnce([{ id: "todo_1" }])
      .mockResolvedValueOnce([{ id: "cal_1" }]);

    await adapter.push([record("todos", "todo_1"), record("calorie_entries", "cal_1")]);

    expect(db.getAllAsync).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenNthCalledWith(1, "todos");
    expect(supabase.from).toHaveBeenNthCalledWith(2, "calorie_entries");
  });

  it("pull currently returns an empty array", async () => {
    const { adapter } = await setupAdapter({});

    await expect(adapter.pull(null)).resolves.toEqual([]);
    await expect(adapter.pull("2026-04-07T00:00:00.000Z")).resolves.toEqual([]);
  });
});
