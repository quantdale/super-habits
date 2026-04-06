import { describe, expect, it, vi } from "vitest";
import { SyncEngine, type SyncRecord } from "@/core/sync/sync.engine";

describe("SyncEngine", () => {
  it("preserves records enqueued while a flush is in flight", async () => {
    const pushedBatches: SyncRecord[][] = [];
    let releasePush: (() => void) | undefined;
    const pushBlocked = new Promise<void>((resolve) => {
      releasePush = resolve;
    });

    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        pushedBatches.push(records);
        await pushBlocked;
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    const first: SyncRecord = {
      entity: "todos",
      id: "todo_1",
      updatedAt: "2026-04-06T10:00:00.000Z",
      operation: "create",
    };
    const second: SyncRecord = {
      entity: "todos",
      id: "todo_2",
      updatedAt: "2026-04-06T10:00:01.000Z",
      operation: "update",
    };

    engine.enqueue(first);
    const flushing = engine.flush();
    engine.enqueue(second);

    releasePush?.();
    await flushing;
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    expect(pushedBatches).toEqual([[first], [second]]);
  });

  it("restores original records when push fails after adapter mutates the batch array", async () => {
    const first: SyncRecord = {
      entity: "todos",
      id: "todo_1",
      updatedAt: "2026-04-06T10:00:00.000Z",
      operation: "create",
    };
    const during: SyncRecord = {
      entity: "todos",
      id: "todo_2",
      updatedAt: "2026-04-06T10:00:01.000Z",
      operation: "update",
    };

    const batchesAtPushStart: SyncRecord[][] = [];
    let attempt = 0;

    let engine!: SyncEngine;
    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        attempt += 1;
        batchesAtPushStart.push([...records]);
        if (attempt === 1) {
          records.length = 0;
          engine.enqueue(during);
          throw new Error("push failed");
        }
      }),
      pull: vi.fn(async () => []),
    };

    engine = new SyncEngine(adapter);

    engine.enqueue(first);
    await expect(engine.flush()).rejects.toThrow("push failed");
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    expect(batchesAtPushStart[0]).toEqual([first]);
    expect(batchesAtPushStart[1]).toEqual([first, during]);
  });
});
