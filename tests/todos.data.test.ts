import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDatabase } = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

const { linkedActionsEngine } = vi.hoisted(() => ({
  linkedActionsEngine: {
    processSourceAction: vi.fn(),
  },
}));

const linkedActionDataMocks = vi.hoisted(() => ({
  deleteLinkedActionRulesForTargetEntity: vi.fn(),
  listLinkedActionRulesForSourceEntity: vi.fn(),
  replaceLinkedActionRulesForSourceEntity: vi.fn(),
}));

const { syncEngine } = vi.hoisted(() => ({
  syncEngine: {
    enqueue: vi.fn(),
  },
}));

vi.mock("@/core/db/client", () => ({
  getDatabase,
}));

vi.mock("@/core/linked-actions/linkedActions.engine", () => ({
  linkedActionsEngine,
}));

vi.mock("@/core/linked-actions/linkedActions.data", () => linkedActionDataMocks);

vi.mock("@/core/sync/sync.engine", () => ({
  syncEngine,
}));

vi.mock("@/lib/time", async () => {
  const actual = await vi.importActual<typeof import("@/lib/time")>("@/lib/time");
  return {
    ...actual,
    nowIso: vi.fn(() => "2026-04-16T10:00:00.000Z"),
    toDateKey: vi.fn(() => "2026-04-16"),
  };
});

import {
  removeTodo,
  saveTodoLinkedActionRules,
  toggleTodo,
} from "@/features/todos/todos.data";

describe("features/todos/todos.data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity.mockResolvedValue(undefined);
    linkedActionDataMocks.deleteLinkedActionRulesForTargetEntity.mockResolvedValue(undefined);
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      mode: "apply",
      sourceEvent: {
        eventId: "levt_1",
        feature: "todos",
        entityType: "todo",
        entityId: "todo_1",
        triggerType: "todo.completed",
        sourceRecordId: "todo_1",
        sourceDateKey: "2026-04-16",
        occurredAt: "2026-04-16T10:00:00.000Z",
        label: "Source todo",
        payload: {},
        origin: {
          originKind: "user",
          originRuleId: null,
          originEventId: null,
        },
        chain: {
          chainId: "lchain_1",
          rootEventId: "levt_1",
          parentEventId: null,
          depth: 0,
        },
      },
      matchedRuleCount: 0,
      effects: [],
      notices: [],
    });
  });

  it("dispatches linked actions only on non-recurring 0->1 completion", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "todo_1",
        title: "Source todo",
        notes: null,
        completed: 0,
        due_date: null,
        priority: "normal",
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: "2026-04-16T09:00:00.000Z",
        updated_at: "2026-04-16T09:00:00.000Z",
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await toggleTodo({ id: "todo_1" } as never);

    expect(db.runAsync).toHaveBeenCalledWith(
      "UPDATE todos SET completed = ?, updated_at = ? WHERE id = ?",
      [1, "2026-04-16T10:00:00.000Z", "todo_1"],
    );
    expect(linkedActionsEngine.processSourceAction).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: "todos",
        entityType: "todo",
        entityId: "todo_1",
        triggerType: "todo.completed",
      }),
    );
    expect(result.completed).toBe(1);
  });

  it("does not dispatch on reopen (1->0)", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "todo_1",
        title: "Source todo",
        notes: null,
        completed: 1,
        due_date: null,
        priority: "normal",
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: "2026-04-16T09:00:00.000Z",
        updated_at: "2026-04-16T09:00:00.000Z",
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    const result = await toggleTodo({ id: "todo_1" } as never);

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      completed: 0,
      linkedActions: {
        matchedRuleCount: 0,
        notices: [],
      },
    });
  });

  it("does not dispatch for recurring todos and still creates follow-up instance", async () => {
    const db = {
      getFirstAsync: vi
        .fn()
        .mockResolvedValueOnce({
          id: "todo_1",
          title: "Recurring todo",
          notes: null,
          completed: 0,
          due_date: "2026-04-16",
          priority: "normal",
          sort_order: 1,
          recurrence: "daily",
          recurrence_id: "rec_1",
          created_at: "2026-04-16T09:00:00.000Z",
          updated_at: "2026-04-16T09:00:00.000Z",
          deleted_at: null,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ maxOrder: 1 }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await toggleTodo({ id: "todo_1" } as never);

    expect(linkedActionsEngine.processSourceAction).not.toHaveBeenCalled();
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO todos"),
      expect.arrayContaining(["rec_1"]),
    );
  });

  it("rejects saving non-empty source rules for recurring todos based on persisted row", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "todo_1",
        recurrence: "daily",
        deleted_at: null,
      }),
      runAsync: vi.fn(),
    };
    getDatabase.mockResolvedValue(db);

    await expect(
      saveTodoLinkedActionRules("todo_1", [
        {
          triggerType: "todo.completed",
          target: {
            feature: "todos",
            entityType: "todo",
            entityId: "todo_target",
            effect: {
              kind: "binary",
              type: "todo.complete",
            },
          },
        },
      ]),
    ).rejects.toThrow("Recurring todos cannot be linked-action sources yet.");
    expect(linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity).not.toHaveBeenCalled();
  });

  it("cleans source and target linked rules when removing a todo", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "todo_1",
        recurrence: null,
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);

    await removeTodo("todo_1");

    expect(linkedActionDataMocks.replaceLinkedActionRulesForSourceEntity).toHaveBeenCalledWith({
      feature: "todos",
      entityType: "todo",
      entityId: "todo_1",
      rules: [],
    });
    expect(linkedActionDataMocks.deleteLinkedActionRulesForTargetEntity).toHaveBeenCalledWith({
      feature: "todos",
      entityType: "todo",
      entityId: "todo_1",
      deletedAt: "2026-04-16T10:00:00.000Z",
    });
  });

  it("returns safe no-op notice metadata when engine reports self-target skip", async () => {
    const db = {
      getFirstAsync: vi.fn().mockResolvedValue({
        id: "todo_1",
        title: "Self target todo",
        notes: null,
        completed: 0,
        due_date: null,
        priority: "normal",
        sort_order: 1,
        recurrence: null,
        recurrence_id: null,
        created_at: "2026-04-16T09:00:00.000Z",
        updated_at: "2026-04-16T09:00:00.000Z",
        deleted_at: null,
      }),
      runAsync: vi.fn().mockResolvedValue(undefined),
    };
    getDatabase.mockResolvedValue(db);
    linkedActionsEngine.processSourceAction.mockResolvedValue({
      mode: "apply",
      sourceEvent: {
        eventId: "levt_2",
        feature: "todos",
        entityType: "todo",
        entityId: "todo_1",
        triggerType: "todo.completed",
        sourceRecordId: "todo_1",
        sourceDateKey: "2026-04-16",
        occurredAt: "2026-04-16T10:00:00.000Z",
        label: "Self target todo",
        payload: {},
        origin: {
          originKind: "user",
          originRuleId: null,
          originEventId: null,
        },
        chain: {
          chainId: "lchain_2",
          rootEventId: "levt_2",
          parentEventId: null,
          depth: 0,
        },
      },
      matchedRuleCount: 1,
      effects: [
        {
          executionId: null,
          ruleId: "link_self",
          status: "skipped",
          effectType: "todo.complete",
          effectFingerprint: "fp",
          targetFeature: "todos",
          targetEntityType: "todo",
          targetEntityId: "todo_1",
          producedEntityType: null,
          producedEntityId: null,
          reason: "self_target_noop",
          errorMessage: null,
          notice: null,
          noticePreview: null,
        },
      ],
      notices: [],
    });

    const result = await toggleTodo({ id: "todo_1" } as never);

    expect(result.linkedActions).toEqual({
      matchedRuleCount: 1,
      notices: [],
    });
  });
});
